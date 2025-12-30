const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Load config
const config = require('./config/config');

// Services
const driveService = require('./services/driveService');

// Middleware
const {
    requestLogger,
    rateLimiter,
    errorHandler,
    notFoundHandler,
} = require('./middleware');

// Routes
const apiRoutes = require('./routes/api');

// Initialize Express app
const app = express();

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(compression());

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        const isAllowed = config.allowedOrigins.includes(origin) || 
                         config.allowedOrigins.includes('*');
        
        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST'],
    credentials: true,
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.nodeEnv === 'development') {
    app.use(morgan('dev'));
}
app.use(requestLogger);

// Rate limiting
app.use('/api/', rateLimiter);

// API routes
app.use('/api', apiRoutes);

// ============================================================================
// ROOT ENDPOINT
// ============================================================================

app.get('/', (req, res) => {
    res.json({
        service: 'StewardView API',
        version: '1.0.0',
        description: 'Open-source trail monitoring for land trusts and stewardship organizations',
        tagline: 'Eyes on the Land',
        endpoints: {
            health: 'GET /api/health',
            organizations: 'GET /api/organizations',
            trails: 'GET /api/:orgName/trails',
            trailPhotos: 'GET /api/:orgName/:trailName',
            thumbnail: 'GET /api/:orgName/:trailName/thumbnail/:fileId',
            uploadPhoto: 'POST /api/:orgName/:trailName/upload',
            generateTimelapse: 'POST /api/:orgName/generate-timelapse',
        },
        docs: 'https://github.com/stewardview/stewardview',
    });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createRequiredDirectories = () => {
    const dirs = [config.uploadDir, config.tempDir];
    
    dirs.forEach(dir => {
        const dirPath = path.join(process.cwd(), dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
};

const cleanupDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        try {
            fs.unlinkSync(path.join(dirPath, file));
        } catch (err) {
            console.error(`Failed to delete ${file}:`, err.message);
        }
    });
};

const cleanupTempDirectories = () => {
    const dirs = [config.uploadDir, config.tempDir];
    dirs.forEach(dir => {
        const dirPath = path.join(process.cwd(), dir);
        cleanupDirectory(dirPath);
    });
};

const logServerInfo = () => {
    console.log('');
    console.log('StewardView API is running!');
    console.log(`Server: http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Health check: http://localhost:${config.port}/api/health`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET  /                                        - API information');
    console.log('  GET  /api/health                              - Service status');
    console.log('  GET  /api/organizations                       - List all organizations');
    console.log('  GET  /api/:orgName/trails                     - List trails');
    console.log('  GET  /api/:orgName/:trailName                 - Get trail photos');
    console.log('  GET  /api/:orgName/:trailName/thumbnail/:id   - Get thumbnail');
    console.log('  POST /api/:orgName/:trailName/upload          - Upload photo');
    console.log('  POST /api/:orgName/generate-timelapse         - Create timelapse');
    console.log('');
    console.log('CORS Origins:', config.allowedOrigins.join(', '));
    console.log('Rate Limit:', `${config.rateLimitMaxRequests} requests per ${config.rateLimitWindowMs / 60000} minutes`);
    console.log('Max Upload Size:', `${config.maxFileSizeMB}MB`);
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');
};

const logStartupError = (error) => {
    console.error('');
    console.error('Failed to start StewardView API');
    console.error('Error:', error.message);
    console.error('');
    console.error('Please check:');
    console.error('  1. credentials.json file exists in the correct location');
    console.error('  2. Google Drive API is enabled in Google Cloud Console');
    console.error('  3. Service account has proper permissions');
    console.error('  4. Environment variables are set correctly');
    console.error('');
};

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

async function startServer() {
    try {
        console.log('');
        console.log('Starting StewardView API Server...');
        console.log('Eyes on the Land');
        console.log('─────────────────────────────────');

        createRequiredDirectories();

        // Initialize Google Drive service
        await driveService.initialize();

        // Start server
        app.listen(config.port, () => {
            logServerInfo();
        });
    } catch (error) {
        logStartupError(error);
        process.exit(1);
    }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

function gracefulShutdown(signal) {
    console.log('');
    console.log(`${signal} received. Shutting down gracefully...`);
    
    cleanupTempDirectories();

    console.log('Cleanup complete');
    console.log('Goodbye!');
    console.log('');
    process.exit(0);
}

// ============================================================================
// PROCESS EVENT HANDLERS
// ============================================================================

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    console.error('');
    console.error('Uncaught Exception:', error);
    console.error('');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('');
    console.error('Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    console.error('');
    process.exit(1);
});

// ============================================================================
// START THE SERVER
// ============================================================================

startServer();