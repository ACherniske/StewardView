const config = require('../config/config');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
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

//configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), config.uploadDir);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: config.maxFileSizeBytes },
    fileFilter: (req, file, cb) => {
        if (config.allowedFileTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    },
});

/**
 * health: 'GET /api/health',
 * organizations: 'GET /api/organizations',
 * trails: 'GET /api/:orgName/trails',
 * uploadPhoto: 'POST /api/:orgName/:trailName/upload',
 * generateTimelapse: 'POST /api/:orgName/generate-timelapse',
 * generateTrailTimelapse: 'POST /api/:orgName/:trailName/generate-timelapse',
 */

/**
 * Health check endpoint
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
 * 'GET /api/organizations',
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
router.get('/:orgName/trails', validateOrganization, logOrganizationAccess, async (req, res, next) => {
    const { orgName } = req.params;
    try {
        const trails = await driveService.listTrailsInOrganization(req.organization.slug);
        res.json({ organization: req.organization, trails });
    }
    catch (error) {
        next(error);
    }
});

/**
 * Upload photo to a trail
 * POST /api/:orgName/:trailName/upload
 */

router.post('/:orgName/:trailName/upload',
    validateOrganization,
    validateTrailName,
    logOrganizationAccess,
    upload.single('photo'),
    validateUpload,
    async (req, res, next) => {
        console.log(`Photo upload request for ${req.organization.slug} / ${req.trailName}`);

        try {
            const { timestamp } = req.body;
            const file = req.file;
            const orgSlug = req.organization.slug;
            const trailName = req.trailName;

            //format filename: TrailName_YYYY_MM_DD_HH-MM-SS.jpg
            const date = new Date(timestamp);
            const dateStr = date.toISOString().split('T')[0];
            const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
            const safeTraileName = driveService.sanitizeName(trailName);
            const filename = `${safeTraileName}_${dateStr}_${timeStr}${path.extname(file.originalname)}`;

            console.log(`Uploading file: ${filename}`);

            //upload to Google Drive (creates trail folder if needed)
            const description = `StewardView observation at ${trailName} on ${timestamp}`;
            const driveFile = await driveService.uploadFile(
                orgSlug,
                trailName,
                file.path,
                filename,
                file.mimetype,
                description
            );

            //delete local temp file
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }

            console.log(`Upload successful: ${driveFile.name} (ID: ${driveFile.id})`);

            res.json({
                success: true,
                message: 'Photo uploaded successfully',
                organization: req.organization.name,
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
            console.error('Error uploading photo:', error.message);
            
            //cleanup if exists
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            res.status(500).json({
                error: 'Upload failed',
                message: error.message,
            });
        }
    }
);

/**
 * Generate timelapse for an organization
 * POST /api/:orgName/generate-timelapse
 * Body: { trails: [trailName1, trailName2, ...] }
 * If trails is empty or missing, include all trails in the organization
 */

router.post('/:orgName/generate-timelapse',
    validateOrganization,
    logOrganizationAccess,
    validateTimelapseRequest,
    async (req, res, next) => {
        console.log(`Timelapse generation request for organization: ${req.organization.slug}`);

        let result = null;

        try {
            const { trailNames } = req.body;
            const orgSlug = req.organization.slug;

            console.log(`Generating timelapse for trails: ${trailNames && trailNames.length > 0 ? trailNames.join(', ') : 'ALL'}`);

            result = await timelapseService.generateTimeLapse(orgSlug, trailNames);

            console.log(`Timelapse generation successful: ${result.path}`);

            res.sendFile(result.path, err => {
                if (err) {
                    console.error('Error sending timelapse file:', err.message);
                }

                //cleanup after sending
                if (result) {
                    timelapseService.cleanup(result.tempFiles, result.path);
                }
            });
        } catch (error) {
            console.error('Error generating timelapse:', error.message);
            //cleanup on error
            if (result) {
                timelapseService.cleanup(result.tempFiles, result.path);
            }
            res.status(500).json({
                error: 'Timelapse generation failed',
                message: error.message,
            });
        }
    }
);

module.exports = router;