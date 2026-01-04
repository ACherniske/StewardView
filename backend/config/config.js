require('dotenv').config();
const path = require('path');

// Use /tmp for serverless environments like Vercel
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

const config = {
    //server
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',

    //google drive
    googleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json',
    driveScopes : ['https://www.googleapis.com/auth/drive.file'],

    //CORS
    allowedOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000'],

    //rate limiting
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, //15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, //100 requests per window

    //file uploads
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB) || 10, //10 MB
    maxFileSizeBytes: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024,
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES
        ? process.env.ALLOWED_FILE_TYPES.split(',')
        : ['image/jpeg', 'image/png', 'image/webp'],
    uploadDir: isServerless ? '/tmp/uploads' : process.env.UPLOAD_DIR || 'uploads',
    tempDir: isServerless ? '/tmp/temp' : process.env.TEMP_DIR || 'temp',

    //timelapse
    timelapseMaxWidth: parseInt(process.env.TIMELAPSE_MAX_WIDTH) || 800, //800px
    timelapseFrameDelayMs: parseInt(process.env.TIMELAPSE_FRAME_DELAY_MS) || 500, //500ms
    timelapseGifQuality: parseInt(process.env.TIMELAPSE_GIF_QUALITY) || 10 //10 (1-20, lower is better)
};

module.exports = config;