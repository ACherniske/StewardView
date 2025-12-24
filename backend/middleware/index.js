// backend/middleware/index.js
// Middleware functions for request handling

const rateLimit = require('express-rate-limit');
const config = require('../config/config');

/**
 * Request logging middleware
 * Logs method, URL, timestamp, and IP address
 * @returns {Function} Express middleware function
*/

const requestLogger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
}

/**
 * Rate limiting middleware
 * Limits number of requests per IP within a time window
 * @returns {Function} Express middleware function
 */

const rateLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    message: {
        status: 429,
        error: 'Too many requests',
        message: 'Please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Validation middleware for photo upload
 * Validates presence of file and required metadata
 * @returns {Function} Express middleware function
 */

const validateUpload = (req, res, next) => {
    const { timestamp } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).json({
            status: 400,
            error: 'Validation failed',
            message: 'No photo provided'
        });
    }

    if (!timestamp || isNaN(Date.parse(timestamp))) {
        return res.status(400).json({
            status: 400,
            error: 'Validation failed',
            message: 'Missing or invalid timestamp'
        });
    }

    //check file type
    if (!config.allowedFileTypes.includes(file.mimetype)) {
        return res.status(400).json({
            status: 400,
            error: 'Validation failed',
            message: 'Unsupported file type'
        });
    }

    //check file sizes
    if (file.size > config.maxFileSizeBytes) {
        return res.status(400).json({
            status: 400,
            error: 'Validation failed',
            message: `File size exceeds limit. Must be less than ${config.maxFileSizeMB} MB`
        });
    }

    next();
};

/**
 * Validation middleware for timelapse generation
 * @returns {Function} Express middleware function
 */

const validateTimelapseRequest = (req, res, next) => {
    /**
     * Expected body:
     * {
     *  trailName: [string]
     * }
     * 
     * Generate for all trails in trailName array
     * If no trailName provided, generate for all trails in organization
     */
    const { trailNames } = req.body;

    if (!trailNames) {
        return res.status(400).json({
            status: 400,
            error: 'Validation failed',
            message: 'Missing trailName in request body'
        });
    }

    if (!Array.isArray(trailNames) || trailNames.length === 0) {
        return res.status(400).json({
            status: 400,
            error: 'Validation failed',
            message: 'trailName must be a non-empty array'
        });
    }

    for (const name of trailNames) {
        if (typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({
                status: 400,
                error: 'Validation failed',
                message: 'Each trailName must be a non-empty string'
            });
        }
    }
    next();
};

/**
 * Error handling middleware
 * @returns {Function} Express middleware function
 */

const errorHandler = (err, req, res, next) => {
    console.error('Server Error:', err);

    //check if headers already sent
    if (res.headersSent) {
        return next(err);
    }

    //default error response
    const statusCode = err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        error: err.name || 'ServerError',
        message: message,
        ...(config.nodeEnv === 'development' && { stack: err.stack }),
    });
};

/**
 * 404 Not Found handler
 * @returns {Function} Express middleware function
 */

const notFoundHandler = (req, res) => {
    res.status(404).json({
        status: 404,
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} does not exist`
    });
};

module.exports = {
    requestLogger,
    rateLimiter,
    validateUpload,
    validateTimelapseRequest,
    errorHandler,
    notFoundHandler
};