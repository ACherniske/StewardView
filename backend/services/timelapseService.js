const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage } = require('canvas');
const config = require('../config/config');
const driveService = require('./driveService');

class TimelapseService {
    constructor() {
        // Track ongoing regenerations to prevent race conditions
        this.regenerationLocks = new Map();
    }
 
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
        // Use absolute path from config (already handles serverless vs local)
        const tempDir = config.tempDir;
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

                    // Filter out the cached timelapse GIF and non-image files
                    const imageFiles = files.filter(file => 
                        file.mimeType && 
                        file.mimeType.startsWith('image/') && 
                        file.name !== '_timelapse.gif'
                    );

                    if (imageFiles.length === 0) {
                        console.log(`No images found in trail '${trailName}'`);
                        continue;
                    }

                    console.log(`Downloading ${imageFiles.length} images from trail '${trailName}'`);

                    for (const file of imageFiles) {
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
     * Generate and store timelapse for a trail (called after photo upload)
     * Returns true if successful, false otherwise
     */
    async regenerateAndStore(orgSlug, trailName) {
        const lockKey = `${orgSlug}:${trailName}`;
        
        // Check if already regenerating for this trail
        if (this.regenerationLocks.get(lockKey)) {
            console.log(`Timelapse regeneration already in progress for '${trailName}', skipping duplicate request`);
            return false;
        }

        // Set lock
        this.regenerationLocks.set(lockKey, true);

        // Use absolute path from config (already handles serverless vs local)
        const tempDir = config.tempDir;
        const imageMetadata = [];
        let outputPath = null;

        try {
            // Create temp dir if needed
            if (!fsSync.existsSync(tempDir)) {
                fsSync.mkdirSync(tempDir, { recursive: true });
            }

            console.log(`Regenerating timelapse for trail '${trailName}' in organization '${orgSlug}'`);

            // Step 1: Delete ALL old GIFs if they exist (handle duplicates)
            const existingGifs = await driveService.getAllTimelapseGifs(orgSlug, trailName);
            if (existingGifs.length > 0) {
                console.log(`Deleting ${existingGifs.length} old timelapse GIF(s)`);
                for (const gif of existingGifs) {
                    try {
                        await driveService.deleteFile(gif.id);
                        console.log(`Deleted GIF: ${gif.id}`);
                    } catch (err) {
                        console.error(`Failed to delete GIF ${gif.id}:`, err.message);
                    }
                }
                // Wait a moment for Drive API to propagate deletions
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Step 2: Get all image files from the trail
            const files = await driveService.listFilesInTrail(orgSlug, trailName, 'createdTime');

            // Filter to only include image files (GIF should already be deleted, but filter just in case)
            const imageFiles = files.filter(file => 
                file.mimeType && 
                file.mimeType.startsWith('image/') && 
                file.name !== '_timelapse.gif'
            );

            if (imageFiles.length === 0) {
                console.log(`No images found in trail '${trailName}', skipping timelapse generation`);
                return false;
            }

            console.log(`Downloading ${imageFiles.length} images from trail '${trailName}'`);

            // Download all images
            for (const file of imageFiles) {
                try {
                    const destPath = path.join(tempDir, `${orgSlug}_${trailName}_${file.id}.jpg`);
                    await driveService.downloadFile(file.id, destPath);
                    
                    imageMetadata.push({
                        path: destPath,
                        createdTime: new Date(file.createdTime).getTime()
                    });
                } catch (err) {
                    console.error(`Error downloading file ${file.id}:`, err.message);
                }
            }

            if (imageMetadata.length === 0) {
                console.log('No images successfully downloaded, skipping timelapse generation');
                return false;
            }

            // Step 3: Sort by creation time and generate new GIF
            imageMetadata.sort((a, b) => a.createdTime - b.createdTime);
            const allImages = imageMetadata.map(img => img.path);

            outputPath = path.join(tempDir, `${orgSlug}_${trailName}_timelapse.gif`);
            await this.createGif(allImages, outputPath);

            // Step 4: Upload new GIF to Google Drive
            await driveService.uploadTimelapseGif(orgSlug, trailName, outputPath);

            console.log(`Timelapse GIF successfully generated and stored for trail '${trailName}'`);

            // Cleanup temp files
            this.cleanup(allImages, outputPath);

            return true;
        } catch (error) {
            console.error(`Error regenerating timelapse for trail '${trailName}':`, error.message);
            
            // Cleanup on error
            const allImages = imageMetadata.map(img => img.path);
            this.cleanup(allImages, outputPath);
            
            return false;
        } finally {
            // Release lock
            this.regenerationLocks.delete(lockKey);
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
