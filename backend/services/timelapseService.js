const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage } = require('canvas');
const config = require('../config/config');
const driveService = require('./driveService');

class TimelapseService {
 
    /**
     * Create timelapse GIF from images with improved error handling
     */
    async createGif(imagePaths, outputPath) {
        return new Promise(async (resolve, reject) => {
            try {
                if (imagePaths.length === 0) {
                    return reject(new Error('No images provided for timelapse creation.'));
                }

                console.log(`Creating timelapse GIF with ${imagePaths.length} images...`);

                // Load first image to get dimensions
                const firstImage = await loadImage(imagePaths[0]);
                const maxWidth = config.timelapseMaxWidth || 800;
                const width = Math.min(firstImage.width, maxWidth);
                const height = Math.round((firstImage.height / firstImage.width) * width);

                console.log('GIF dimensions:', width, 'x', height);

                // Setup encoder and canvas
                const encoder = new GIFEncoder(width, height);
                const canvas = createCanvas(width, height);
                const ctx = canvas.getContext('2d');

                // Setup file writing
                const writeStream = fsSync.createWriteStream(outputPath);
                encoder.createReadStream().pipe(writeStream);

                // Handle stream events
                writeStream.on('error', (err) => {
                    console.error('Write stream error:', err);
                    reject(err);
                });

                writeStream.on('finish', () => {
                    console.log('Timelapse GIF created successfully at:', outputPath);
                    resolve(outputPath);
                });

                // Start encoding
                encoder.start();
                encoder.setRepeat(0);
                encoder.setDelay(config.timelapseFrameDelayMs || 500);
                encoder.setQuality(config.timelapseGifQuality || 10);

                // Add frames
                for (let i = 0; i < imagePaths.length; i++) {
                    try {
                        const image = await loadImage(imagePaths[i]);
                        ctx.clearRect(0, 0, width, height);
                        ctx.drawImage(image, 0, 0, width, height);
                        encoder.addFrame(ctx);

                        if ((i + 1) % 5 === 0 || i === imagePaths.length - 1) {
                            console.log(`Processed frame ${i + 1}/${imagePaths.length}`);
                        }
                    } catch (err) {
                        console.error(`Error loading image ${imagePaths[i]}:`, err.message);
                        // Continue with other images
                    }
                }

                encoder.finish();
                console.log('Encoder finished, waiting for file write to complete...');

            } catch (error) {
                console.error('Error in GIF creation:', error);
                reject(error);
            }
        });
    }

    /**
     * Generate timelapse from trails for a specific organization
     */
    async generateTimeLapse(orgSlug, trailNames) {
        const tempDir = path.join(process.cwd(), config.tempDir);
        const imageMetadata = []; // Store path with creation time
        let outputPath = null;

        try {
            // Create temp dir if needed
            if (!fsSync.existsSync(tempDir)) {
                fsSync.mkdirSync(tempDir, { recursive: true });
            }

            console.log(`Fetching images from ${trailNames.length} trail(s) for organization '${orgSlug}'`);

            for (const trailName of trailNames) {
                try {
                    const files = await driveService.listFilesInTrail(orgSlug, trailName, 'createdTime');

                    if (files.length === 0) {
                        console.log(`No images found in trail '${trailName}'`);
                        continue;
                    }

                    console.log(`Downloading ${files.length} images from trail '${trailName}'`);

                    for (const file of files) {
                        try {
                            const destPath = path.join(tempDir, `${orgSlug}_${trailName}_${file.id}.jpg`);
                            await driveService.downloadFile(file.id, destPath);
                            
                            // Store path with creation time for proper sorting
                            imageMetadata.push({
                                path: destPath,
                                createdTime: new Date(file.createdTime).getTime()
                            });
                        } catch (err) {
                            console.error(`Error downloading file ${file.id}:`, err.message);
                        }
                    }
                } catch (err) {
                    console.error(`Error processing trail ${trailName}:`, err.message);
                }
            }

            if (imageMetadata.length === 0) {
                throw new Error('No images found in the specified trails.');
            }

            console.log(`Total images downloaded: ${imageMetadata.length}`);

            // Sort by creation time (oldest to newest for chronological timelapse)
            imageMetadata.sort((a, b) => a.createdTime - b.createdTime);
            
            // Extract sorted paths
            const allImages = imageMetadata.map(img => img.path);

            // Create GIF
            outputPath = path.join(tempDir, `${orgSlug}_timelapse_${Date.now()}.gif`);
            await this.createGif(allImages, outputPath);

            return {
                path: outputPath,
                imageCount: allImages.length,
                tempFiles: allImages,
            };
        } catch (error) {
            // Cleanup on error
            const allImages = imageMetadata.map(img => img.path);
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
                if (fsSync.existsSync(img)) {
                    try {
                        fsSync.unlinkSync(img);
                    } catch (err) {
                        console.error(`Error deleting temp image file '${img}':`, err.message);
                    }
                }
            });
        }

        if (outputPath && fsSync.existsSync(outputPath)) {
            try {
                fsSync.unlinkSync(outputPath);
            } catch (err) {
                console.error(`Error deleting temp output file '${outputPath}':`, err.message);
            }
        }
    }
}

module.exports = new TimelapseService();
