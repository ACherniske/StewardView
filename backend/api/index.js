const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();

// Basic middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root endpoint
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
        docs: 'https://github.com/ACherniske/StewardView',
    });
});

// Lazy load services
let initialized = false;
let driveService = null;

// Load routes at startup (but services initialize lazily)
const apiRoutes = require('../routes/api');

async function initializeServices() {
    if (initialized) return;
    
    try {
        console.log('Initializing services...');
        
        // Create temp directories in /tmp for Vercel
        const tmpDir = '/tmp';
        const uploadDir = path.join(tmpDir, 'uploads');
        const tempDir = path.join(tmpDir, 'temp');
        
        [uploadDir, tempDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Load and initialize Drive service
        driveService = require('../services/driveService');
        await driveService.initialize();
        
        initialized = true;
        console.log('StewardView API services initialized');
    } catch (error) {
        console.error('Service initialization error:', error);
        throw error;
    }
}

// Middleware to ensure Drive services are initialized before API routes that need them
app.use('/api', async (req, res, next) => {
    // Skip initialization for endpoints that don't need Drive
    const noInitPaths = ['/health', '/organizations'];
    if (noInitPaths.includes(req.path)) {
        return next();
    }
    
    try {
        await initializeServices();
        next();
    } catch (error) {
        console.error('Initialization failed:', error);
        res.status(503).json({ 
            error: 'Service initialization failed',
            message: error.message 
        });
    }
});

// Mount all API routes at /api
app.use('/api', apiRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({ 
        error: 'Internal server error', 
        message: err.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
});

// Export for Vercel
module.exports = app;
