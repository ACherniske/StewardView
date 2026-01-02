const config = require('../config/config');
const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const sharp = require('sharp');
const { listActiveOrganizations } = require('../config/organizations');
const driveService = require('../services/driveService');
const timelapseService = require('../services/timelapseService');
const {
    validateUpload,
    validateTimelapseRequest,
} = require('../middleware');
const {
    validateOrganization,
    validateTrailName,
    logOrganizationAccess,
} = require('../middleware/organizationMiddleware');

const router = express.Router();

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), config.uploadDir);
        if (!fsSync.existsSync(uploadDir)) {
            fsSync.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const extension = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${extension}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: config.maxFileSizeBytes },
    fileFilter: (req, file, cb) => {
        const isValidType = config.allowedFileTypes.includes(file.mimetype);
        if (isValidType) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateFilename = (trailName, timestamp, extension) => {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    const safeTrailName = driveService.sanitizeName(trailName);
    return `${safeTrailName}_${dateStr}_${timeStr}${extension}`;
};

const deleteFileIfExists = async (filePath) => {
    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error deleting file:', error.message);
        }
    }
};

const cleanupTempFile = (req) => {
    if (req.file?.path && fsSync.existsSync(req.file.path)) {
        fsSync.unlinkSync(req.file.path);
    }
};

const getOrgSlug = (req) => req.organization.slug;

const sendError = (res, statusCode, error, message = null) => {
    console.error(`Error (${statusCode}):`, message || error);
    res.status(statusCode).json({
        error: typeof error === 'string' ? error : error.message,
        message: message || (typeof error === 'string' ? error : error.message),
    });
};

const cleanupTimelapseResult = (result) => {
    if (result) {
        timelapseService.cleanup(result.tempFiles, result.path);
    }
};

// ============================================================================
// MIDDLEWARE CHAINS
// ============================================================================

const orgMiddleware = [validateOrganization, logOrganizationAccess];
const trailMiddleware = [...orgMiddleware, validateTrailName];

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'StewardView API',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        organizations: listActiveOrganizations().length,
    });
});

/**
 * List active organizations
 * GET /api/organizations
 */
router.get('/organizations', async (req, res, next) => {
    try {
        const organizations = await listActiveOrganizations();
        res.json({ organizations });
    } catch (error) {
        next(error);
    }
});

/**
 * List trails for an organization
 * GET /api/:orgName/trails
 */
router.get('/:orgName/trails', orgMiddleware, async (req, res, next) => {
    try {
        const trails = await driveService.listTrailsInOrganization(getOrgSlug(req));
        res.json({
            organization: req.organization,
            trails,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * Get all photos for a trail
 * GET /api/:orgName/:trailName
 */
router.get('/:orgName/:trailName', trailMiddleware, async (req, res, next) => {
    try {
        // First check if trail exists
        const trails = await driveService.listTrailsInOrganization(getOrgSlug(req));
        const trailExists = trails.includes(req.trailName);
        
        if (!trailExists) {
            return sendError(res, 404, 'Trail not found', `Trail '${req.trailName}' does not exist in organization`);
        }

        const files = await driveService.listFilesInTrail(
            getOrgSlug(req),
            req.trailName
        );
        res.json({ files });
    } catch (error) {
        next(error);
    }
});

/**
 * Serve a thumbnail for a trail image
 * GET /api/:orgName/:trailName/thumbnail/:fileId
 * Query: size (default 256)
 */
router.get(
    '/:orgName/:trailName/thumbnail/:fileId',
    trailMiddleware,
    async (req, res, next) => {
        const { fileId } = req.params;
        const size = parseInt(req.query.size, 10) || 256;

        try {
            const files = await driveService.listFilesInTrail(
                getOrgSlug(req),
                req.trailName
            );
            
            const file = files.find(f => f.id === fileId);
            if (!file) {
                return sendError(res, 404, 'File not found');
            }

            console.log(`[THUMBNAIL] Generating thumbnail for: ${file.name} (${fileId})`);

            // Get image buffer directly from Google Drive
            const imageBuffer = await driveService.getFileBuffer(fileId);
            
            if (!imageBuffer || imageBuffer.length === 0) {
                console.error('[THUMBNAIL] Empty or null buffer received');
                return sendError(res, 500, 'Failed to download image from Drive');
            }

            console.log(`[THUMBNAIL] Creating thumbnail with Sharp (size: ${size}px)`);
            const thumbnail = await sharp(imageBuffer)
                .resize(size, size, { fit: 'cover' })
                .jpeg({ quality: 85 })
                .toBuffer();

            console.log(`[THUMBNAIL] Thumbnail generated: ${thumbnail.length} bytes`);

            res.set('Content-Type', 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=86400');
            res.send(thumbnail);
        } catch (error) {
            console.error('[THUMBNAIL] Error:', error.message);
            sendError(res, 500, 'Thumbnail generation failed', error.message);
        }
    }
);

/**
 * Upload photo to a trail
 * POST /api/:orgName/:trailName/upload
 */
router.post(
    '/:orgName/:trailName/upload',
    trailMiddleware,
    upload.single('photo'),
    validateUpload,
    async (req, res, next) => {
        const { organization, trailName, file, body } = req;
        const { timestamp } = body;
        const orgSlug = getOrgSlug(req);

        console.log(`Photo upload request for ${orgSlug} / ${trailName}`);

        try {
            const filename = generateFilename(
                trailName,
                timestamp,
                path.extname(file.originalname)
            );

            console.log(`Uploading file: ${filename}`);

            const description = `StewardView observation at ${trailName} on ${timestamp}`;
            const driveFile = await driveService.uploadFile(
                orgSlug,
                trailName,
                file.path,
                filename,
                file.mimetype,
                description
            );

            await deleteFileIfExists(file.path);

            console.log(
                `Upload successful: ${driveFile.name} (ID: ${driveFile.id})`
            );

            // Trigger timelapse regeneration in the background (don't wait for it)
            console.log(`Triggering timelapse regeneration for trail '${trailName}'`);
            timelapseService.regenerateAndStore(orgSlug, trailName)
                .then(success => {
                    if (success) {
                        console.log(`Background timelapse regeneration completed for '${trailName}'`);
                    } else {
                        console.log(`Background timelapse regeneration skipped or failed for '${trailName}'`);
                    }
                })
                .catch(err => {
                    console.error(`Background timelapse regeneration error for '${trailName}':`, err.message);
                });

            res.json({
                success: true,
                message: 'Photo uploaded successfully',
                organization: organization.name,
                trail: trailName,
                file: {
                    id: driveFile.id,
                    name: driveFile.name,
                    link: driveFile.webViewLink,
                    downloadLink: driveFile.webContentLink,
                    createdTime: driveFile.createdTime,
                    size: driveFile.size,
                },
            });
        } catch (error) {
            cleanupTempFile(req);
            sendError(res, 500, 'Upload failed', error.message);
        }
    }
);

/**
 * Generate timelapse for an organization
 * POST /api/:orgName/generate-timelapse
 * Body: { trails: [trailName1, trailName2, ...] }
 * If trails is empty or missing, includes all trails in the organization
 */
router.post(
    '/:orgName/generate-timelapse',
    orgMiddleware,
    validateTimelapseRequest,
    async (req, res, next) => {
        const { body } = req;
        const { trailNames } = body;
        const orgSlug = getOrgSlug(req);

        console.log(`Timelapse generation request for organization: ${orgSlug}`);

        const trailsDisplay =
            trailNames && trailNames.length > 0
                ? trailNames.join(', ')
                : 'ALL';
        console.log(`Generating timelapse for trails: ${trailsDisplay}`);

        // For single trail requests, check if cached GIF exists in Drive
        if (trailNames && trailNames.length === 1) {
            const trailName = trailNames[0];
            
            try {
                const existingGif = await driveService.getTimelapseGif(orgSlug, trailName);
                
                if (existingGif) {
                    console.log(`Found cached timelapse GIF for trail '${trailName}', serving from Drive`);
                    
                    // Download the GIF and send it
                    const tempDir = path.join(process.cwd(), config.tempDir);
                    if (!fsSync.existsSync(tempDir)) {
                        fsSync.mkdirSync(tempDir, { recursive: true });
                    }
                    
                    const tempGifPath = path.join(tempDir, `${orgSlug}_${trailName}_cached_${Date.now()}.gif`);
                    await driveService.downloadFile(existingGif.id, tempGifPath);
                    
                    res.sendFile(tempGifPath, (err) => {
                        if (err) {
                            console.error('Error sending cached timelapse file:', err.message);
                        }
                        // Cleanup temp file
                        deleteFileIfExists(tempGifPath);
                    });
                    
                    return;
                }
                
                console.log(`No cached timelapse found for trail '${trailName}', generating new one`);
            } catch (error) {
                console.error(`Error checking for cached timelapse:`, error.message);
                // Continue to generation if check fails
            }
        }

        // Generate new timelapse (for multi-trail or if no cached version exists)
        let result = null;

        try {
            result = await timelapseService.generateTimeLapse(
                orgSlug,
                trailNames
            );

            console.log(`Timelapse generation successful: ${result.path}`);

            res.sendFile(result.path, (err) => {
                if (err) {
                    console.error('Error sending timelapse file:', err.message);
                }
                cleanupTimelapseResult(result);
            });
        } catch (error) {
            cleanupTimelapseResult(result);
            sendError(res, 500, 'Timelapse generation failed', error.message);
        }
    }
);

module.exports = router;