const fs = require('fs');
const path = require('path');
const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage } = require('canvas');
const config = require('../config/config');
const driveService = require('./driveService');

class TimelapseService {
    /**
     * Create timelapse GIF from images stored in Google Drive
     */

    async createGif(imagePaths, outputPath) {
        try {
            if (imagePaths.length === 0) {
                throw new Error('No images provided for timelapse creation.');
            }

            console.log(`Creating timelapse GIF with ${imagePaths.length} images...`);

            
            //calculate dimensions maintaining aspect ratio
            const firstImage = await loadImage(imagePaths[0]);
            const maxWidth = config.timelapseMaxWidth;
            const width = Math.min(firstImage.width, maxWidth);
            const height = Math.round((firstImage.height / firstImage.width) * width);

            console.log('Gif dimensions:', width, 'x', height);

            const encoder = new GIFEncoder(width, height);
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            const stream = encoder.createReadStream();
            stream.pipe(fs.createWriteStream(outputPath));

            encoder.start();
            encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
            encoder.setDelay(config.timelapseFrameDelay);  // frame delay in ms
            encoder.setQuality(config.timelapseQuality); // image quality, 10 is default

            for (let i = 0; i < imagePaths.length; i++) {
                const image = await loadImage(imagePaths[i]);

                //draw image to canvas
                ctx.drawImage(image, 0, 0, width, height);
                encoder.addFrame(ctx);

                //progress logging
                if ((i + 1) % 10 === 0 || i === imagePaths.length - 1) {
                    console.log(`Added ${i + 1}/${imagePaths.length} frames to GIF`);
                }
            }

            encoder.finish();

            //wait for encoder
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log('Timelapse GIF created at:', outputPath);
            return outputPath;
        } catch (error) {
            console.error('Error creating timelapse GIF:', error.message);
            throw error;
        }
    }

    /**
     * Generate timelapse from trails for a specific organization and trail
     */

    async generateTimeLapse(orgSlug, trailNames) {
        const tempDir = path.join(process.cwd(), config.tempDir);
        const allImages = [];
        let outputPath = null;

        try {
            //create temp dir if needed
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            console.log(`Downloading images from ${trailNames.length} trails for organization '${orgSlug}'`);

            for (const trailName of trailNames) {
                const folderID = await driveService.getOrCreateTrailFolder(orgSlug, trailName);
                const files = await driveService.listFilesInTrail(orgSlug, trailName, 'createdTime');

                if (files.length === 0) {
                    console.log(`No images found in trail '${trailName}'`);
                    continue;
                }

                console.log(`Downloading ${files.length} images from trail '${trailName}'`);

                for (const file of files) {
                    const destPath = path.join(tempDir, `${orgSlug}_${Date.now()}_${file.name}`);
                    await driveService.downloadFile(file.id, destPath);
                    allImages.push(destPath);
                }
            }

            if (allImages.length === 0) {
                throw new Error('No images found in the specified trails.');
            }

            allImages.sort();

            //create GIF
            outputPath = path.join(tempDir, `${orgSlug}_timelapse_${Date.now()}.gif`);
            await this.createGif(allImages, outputPath);

            return {
                path: outputPath,
                imageCount: allImages.length,
                tempFiles: allImages,
            };
        } catch (error) {
            //cleanup on error
            this.cleanup(allImages, outputPath);
            throw error;
            }
    }

    /**
     * Cleanup temporary files
     */

    cleanup(imagePaths, outputPath) {
        console.log('Cleaning up temporary files...');

        if (imagePaths && Array.isArray(imagePaths)) {
            imagePaths.forEach(img => {
                if (fs.existsSync(img)) {
                    try {
                        fs.unlinkSync(img);
                    } catch (err) {
                        console.error(`Error deleting temp image file '${img}':`, err.message);
                    }
                }
            });
        }

        if (outputPath && fs.existsSync(outputPath)) {
            try {
                fs.unlinkSync(outputPath);
            } catch (err) {
                console.error(`Error deleting temp output file '${outputPath}':`, err.message);
            }
        }
    }
}

module.exports = new TimelapseService();
