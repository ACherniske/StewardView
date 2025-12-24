const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

//load config  
const config = require('./config/config');

//services
const driveService = require('./services/driveService');

//middleware
const {
    requestLogger,
    rateLimiter,
    errorHandler,
    notFoundHandler,
} = require('./middleware');

//routes
const apiRoutes = require('./routes/api');

//initialize express app
const app = express();

//middleware setup
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(compression());

app.use(cors({
    origin: (origin, callback) => {
        //allow requests with no origin
        if (!origin) return callback(null, true);

        if (config.allowedOrigins.includes(origin) || config.allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST'],
    credentials: true,
}));

//body parser
app.use(express.json({ limit : '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

//logging
if (config.nodeEnv === 'development') {
    app.use(morgan('dev'));
}
app.use(requestLogger);

//rate limiting
app.use('/api/', rateLimiter);

//api routes
app.use('/api', apiRoutes);

//root endpoint
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
        uploadPhoto: 'POST /api/:orgName/:trail/upload',
        generateTimelapse: 'POST /api/:orgName/generate-timelapse',
        generateTrailTimelapse: 'POST /api/:orgName/:trail/generate-timelapse',
    },
    docs: 'https://github.com/stewardview/stewardview',
  });
});

//error handling

app.use(notFoundHandler);
app.use(errorHandler);

//server initialization

async function startServer() {
    try {
        console.log('');
        console.log('Starting StewardView API Server...');
        console.log('Eyes on the Land');
        console.log('-----------------------');

        //create required directories
        const dirs = [config.uploadDir, config.tempDir];
        dirs.forEach(dir => {
            const dirPath = path.join(process.cwd(), dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        });

        //initialize Google Drive service
        await driveService.initialize();

        // Start server
        app.listen(config.port, () => {
        console.log('');
        console.log('StewardView API is running!');
        console.log(`Server: http://localhost:${config.port}`);
        console.log(`Environment: ${config.nodeEnv}`);
        console.log(`Health check: http://localhost:${config.port}/api/health`);
        console.log('');
        console.log('Available endpoints:');
        console.log('  GET  /              - API information');
        console.log('  GET  /api/health    - Service status');

        console.log('  GET  /api/organizations   - List all organizations');
        console.log('  GET  /api/:orgName/trails   - List trails');

        console.log('  POST /api/:orgName/:trailName/upload - Upload photo');

        console.log('  POST /api/:orgName/generate-timelapse - Create organization timelapse');
        console.log('  POST /api/:orgName/:trailName/generate-timelapse - Create trail timelapse');

        console.log('');
        console.log('CORS Origins:', config.allowedOrigins.join(', '));
        console.log('Rate Limit:', `${config.rateLimitMaxRequests} requests per ${config.rateLimitWindowMs / 60000} minutes`);
        console.log('Max Upload Size:', `${config.maxFileSizeMB}MB`);
        console.log('');
        console.log('Press Ctrl+C to stop');
        console.log('');
        });
    } catch (error) {
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
        process.exit(1);
    }
}

//shutdown
function gracefulShutdown(signal) {
  console.log('');
  console.log(`${signal} received. Shutting down gracefully...`);
  
  // Clean up temporary directories
  const dirs = [config.uploadDir, config.tempDir];
  dirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      files.forEach(file => {
        try {
          fs.unlinkSync(path.join(dirPath, file));
        } catch (err) {
          console.error(`Failed to delete ${file}:`, err.message);
        }
      });
    }
  });

  console.log('Cleanup complete');
  console.log('Goodbye!');
  console.log('');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
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

//start the server
startServer();