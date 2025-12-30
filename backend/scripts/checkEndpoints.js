#!/usr/bin/env node

/**
 * StewardView API Endpoint Testing Script
 * Tests all API endpoints to verify backend functionality
 * 
 * Usage: node checkEndpoints.js [BASE_URL]
 * Example: node checkEndpoints.js http://localhost:3001
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = process.argv[2] || 'http://localhost:5000';
const TEST_ORG = 'kent-land-trust'; // Change to your test organization
const TEST_TRAIL = 'test-trail';
const TEST_IMAGE_PATH = './test-image.jpg';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

// Test results tracking
const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: [],
    uploadedFileId: null, // Store uploaded file ID for thumbnail test
};

// ============================================================================
// HTTP REQUEST HELPERS
// ============================================================================

async function makeRequest(method, endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    
    try {
        const fetchOptions = {
            method,
            headers: options.headers || {},
            ...options
        };

        const response = await fetch(url, fetchOptions);
        const contentType = response.headers.get('content-type');
        
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else if (contentType && contentType.includes('image/')) {
            // For image responses (thumbnails)
            data = await response.arrayBuffer();
        } else {
            data = await response.text();
        }

        return {
            status: response.status,
            ok: response.ok,
            data,
            headers: Object.fromEntries(response.headers.entries()),
            contentType
        };
    } catch (error) {
        return {
            status: 0,
            ok: false,
            error: error.message
        };
    }
}

async function uploadFile(endpoint, formData) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${BASE_URL}${endpoint}`);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: formData.getHeaders()
        };

        const req = httpModule.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        data: jsonData
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        data: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        formData.pipe(req);
    });
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createTestImage() {
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
        // Create a simple 1x1 pixel PNG
        const pngBuffer = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
            0x42, 0x60, 0x82
        ]);
        fs.writeFileSync(TEST_IMAGE_PATH, pngBuffer);
        console.log(`${colors.cyan}Created test image: ${TEST_IMAGE_PATH}${colors.reset}`);
    }
}

function logTest(name, passed, message = '', data = null) {
    const status = passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
    console.log(`  [${status}] ${name}`);
    
    if (message) {
        console.log(`        ${colors.yellow}${message}${colors.reset}`);
    }
    
    if (data && !passed) {
        console.log(`        ${colors.cyan}Response:${colors.reset}`, JSON.stringify(data, null, 2));
    }

    results.tests.push({ name, passed, message, data });
    if (passed) {
        results.passed++;
    } else {
        results.failed++;
    }
}

function logSkip(name, reason = '') {
    console.log(`  ${colors.yellow}[SKIP]${colors.reset} ${name}`);
    if (reason) {
        console.log(`        ${colors.cyan}${reason}${colors.reset}`);
    }
    results.skipped++;
}

function logGroup(name) {
    console.log(`\n${colors.blue}━━━ ${name} ━━━${colors.reset}`);
}

// ============================================================================
// TEST SUITE
// ============================================================================

async function testBasicConnectivity() {
    logGroup('Basic Connectivity');

    // Test: Root endpoint
    const rootResponse = await makeRequest('GET', '/');
    logTest(
        'GET /',
        rootResponse.ok && rootResponse.data.service === 'StewardView API',
        rootResponse.ok ? 'API is responding' : 'API is not responding',
        rootResponse.data
    );

    // Test: Health check
    const healthResponse = await makeRequest('GET', '/api/health');
    logTest(
        'GET /api/health',
        healthResponse.ok && healthResponse.data.status === 'ok',
        healthResponse.ok ? `Uptime: ${Math.floor(healthResponse.data.uptime)}s` : 'Health check failed',
        healthResponse.data
    );
}

async function testOrganizations() {
    logGroup('Organizations');

    // Test: List organizations
    const orgsResponse = await makeRequest('GET', '/api/organizations');
    const hasOrgs = orgsResponse.ok && Array.isArray(orgsResponse.data.organizations);
    logTest(
        'GET /api/organizations',
        hasOrgs,
        hasOrgs ? `Found ${orgsResponse.data.organizations.length} organizations` : 'Failed to list organizations',
        orgsResponse.data
    );

    // Test: Invalid organization
    const invalidOrgResponse = await makeRequest('GET', '/api/invalid-org-12345/trails');
    logTest(
        'GET /api/invalid-org-12345/trails',
        !invalidOrgResponse.ok && invalidOrgResponse.status === 400,
        'Correctly rejected invalid organization',
        invalidOrgResponse.data
    );
}

async function testTrails() {
    logGroup('Trails');

    // Test: List trails for organization
    const trailsResponse = await makeRequest('GET', `/api/${TEST_ORG}/trails`);
    const hasTrails = trailsResponse.ok && Array.isArray(trailsResponse.data.trails);
    logTest(
        `GET /api/${TEST_ORG}/trails`,
        hasTrails,
        hasTrails ? `Found ${trailsResponse.data.trails.length} trails` : 'Failed to list trails',
        trailsResponse.data
    );

    // Test: Get photos for a trail
    const photosResponse = await makeRequest('GET', `/api/${TEST_ORG}/${TEST_TRAIL}`);
    const hasPhotos = photosResponse.ok && Array.isArray(photosResponse.data.files);
    logTest(
        `GET /api/${TEST_ORG}/${TEST_TRAIL}`,
        hasPhotos,
        hasPhotos ? `Found ${photosResponse.data.files.length} photos` : 'Failed to get trail photos',
        photosResponse.data
    );

    // Store a file ID for thumbnail testing if available
    if (hasPhotos && photosResponse.data.files.length > 0) {
        results.uploadedFileId = photosResponse.data.files[0].id;
    }
}

async function testPhotoUpload() {
    logGroup('Photo Upload');

    if (!fs.existsSync(TEST_IMAGE_PATH)) {
        logSkip('Photo upload tests', 'No test image found');
        logSkip('Upload validation test', 'No test image found');
        return;
    }

    // Test: Valid upload
    try {
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        
        formData.append('photo', fs.createReadStream(TEST_IMAGE_PATH), {
            filename: 'test-image.jpg',
            contentType: 'image/jpeg'
        });
        formData.append('timestamp', new Date().toISOString());

        const uploadResponse = await uploadFile(`/api/${TEST_ORG}/${TEST_TRAIL}/upload`, formData);

        logTest(
            `POST /api/${TEST_ORG}/${TEST_TRAIL}/upload`,
            uploadResponse.ok && uploadResponse.data.success,
            uploadResponse.ok ? `Photo uploaded: ${uploadResponse.data.file?.name}` : 'Upload failed',
            uploadResponse.data
        );

        // Store file ID for thumbnail test
        if (uploadResponse.ok && uploadResponse.data.file?.id) {
            results.uploadedFileId = uploadResponse.data.file.id;
        }
    } catch (error) {
        logTest(
            `POST /api/${TEST_ORG}/${TEST_TRAIL}/upload`,
            false,
            `Error: ${error.message}`
        );
    }

    // Test: Upload without timestamp (should fail)
    try {
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        
        formData.append('photo', fs.createReadStream(TEST_IMAGE_PATH), {
            filename: 'test-image.jpg',
            contentType: 'image/jpeg'
        });
        // Intentionally not adding timestamp

        const invalidUploadResponse = await uploadFile(`/api/${TEST_ORG}/${TEST_TRAIL}/upload`, formData);

        logTest(
            'POST upload without timestamp',
            !invalidUploadResponse.ok && invalidUploadResponse.status === 400,
            'Correctly rejected upload without timestamp',
            invalidUploadResponse.data
        );
    } catch (error) {
        logTest(
            'POST upload without timestamp',
            false,
            `Error: ${error.message}`
        );
    }
}

async function testThumbnails() {
    logGroup('Thumbnails');

    if (!results.uploadedFileId) {
        logSkip('Thumbnail tests', 'No file ID available (upload a photo first or ensure trail has photos)');
        return;
    }

    console.log(`        ${colors.cyan}Testing with file ID: ${results.uploadedFileId}${colors.reset}`);

    // Test: Get thumbnail (default size)
    const thumbnailResponse = await makeRequest(
        'GET',
        `/api/${TEST_ORG}/${TEST_TRAIL}/thumbnail/${results.uploadedFileId}`
    );
    
    const isValidThumbnail = thumbnailResponse.ok && 
                            thumbnailResponse.contentType?.includes('image/') &&
                            thumbnailResponse.data instanceof ArrayBuffer &&
                            thumbnailResponse.data.byteLength > 0;
    
    logTest(
        `GET /api/${TEST_ORG}/${TEST_TRAIL}/thumbnail/:fileId`,
        isValidThumbnail,
        isValidThumbnail 
            ? `Thumbnail generated (${thumbnailResponse.data.byteLength} bytes)` 
            : 'Failed to generate thumbnail',
        isValidThumbnail ? null : thumbnailResponse.data
    );

    // Test: Get thumbnail with custom size
    const customSizeResponse = await makeRequest(
        'GET',
        `/api/${TEST_ORG}/${TEST_TRAIL}/thumbnail/${results.uploadedFileId}?size=512`
    );
    
    const isValidCustomThumbnail = customSizeResponse.ok && 
                                   customSizeResponse.contentType?.includes('image/') &&
                                   customSizeResponse.data instanceof ArrayBuffer &&
                                   customSizeResponse.data.byteLength > 0;
    
    logTest(
        `GET thumbnail with size=512`,
        isValidCustomThumbnail,
        isValidCustomThumbnail 
            ? `Custom thumbnail generated (${customSizeResponse.data.byteLength} bytes)` 
            : 'Failed to generate custom size thumbnail',
        isValidCustomThumbnail ? null : customSizeResponse.data
    );

    // Test: Invalid file ID
    const invalidThumbnailResponse = await makeRequest(
        'GET',
        `/api/${TEST_ORG}/${TEST_TRAIL}/thumbnail/invalid-file-id-12345`
    );
    
    logTest(
        'GET thumbnail with invalid file ID',
        !invalidThumbnailResponse.ok && invalidThumbnailResponse.status === 404,
        'Correctly rejected invalid file ID',
        invalidThumbnailResponse.data
    );

    // Test: Very small size
    const smallSizeResponse = await makeRequest(
        'GET',
        `/api/${TEST_ORG}/${TEST_TRAIL}/thumbnail/${results.uploadedFileId}?size=64`
    );
    
    const isValidSmallThumbnail = smallSizeResponse.ok && 
                                  smallSizeResponse.contentType?.includes('image/') &&
                                  smallSizeResponse.data instanceof ArrayBuffer &&
                                  smallSizeResponse.data.byteLength > 0;
    
    logTest(
        `GET thumbnail with size=64`,
        isValidSmallThumbnail,
        isValidSmallThumbnail 
            ? `Small thumbnail generated (${smallSizeResponse.data.byteLength} bytes)` 
            : 'Failed to generate small thumbnail',
        isValidSmallThumbnail ? null : smallSizeResponse.data
    );

    // Test: Large size
    const largeSizeResponse = await makeRequest(
        'GET',
        `/api/${TEST_ORG}/${TEST_TRAIL}/thumbnail/${results.uploadedFileId}?size=1024`
    );
    
    const isValidLargeThumbnail = largeSizeResponse.ok && 
                                  largeSizeResponse.contentType?.includes('image/') &&
                                  largeSizeResponse.data instanceof ArrayBuffer &&
                                  largeSizeResponse.data.byteLength > 0;
    
    logTest(
        `GET thumbnail with size=1024`,
        isValidLargeThumbnail,
        isValidLargeThumbnail 
            ? `Large thumbnail generated (${largeSizeResponse.data.byteLength} bytes)` 
            : 'Failed to generate large thumbnail',
        isValidLargeThumbnail ? null : largeSizeResponse.data
    );
}

async function testTimelapse() {
    logGroup('Timelapse Generation');

    logSkip(
        `POST /api/${TEST_ORG}/generate-timelapse`,
        'Requires multiple images in Google Drive'
    );
    
    console.log(`        ${colors.cyan}To test manually:${colors.reset}`);
    console.log(`        ${colors.cyan}curl -X POST ${BASE_URL}/api/${TEST_ORG}/generate-timelapse \\${colors.reset}`);
    console.log(`        ${colors.cyan}     -H "Content-Type: application/json" \\${colors.reset}`);
    console.log(`        ${colors.cyan}     -d '{"trailNames": ["${TEST_TRAIL}"]}'${colors.reset}`);
}

async function testErrorHandling() {
    logGroup('Error Handling');

    // Test: 404 endpoint
    const notFoundResponse = await makeRequest('GET', '/api/nonexistent-endpoint-12345');
    logTest(
        'GET /api/nonexistent-endpoint-12345',
        notFoundResponse.status === 404,
        'Correctly returned 404 for invalid endpoint',
        notFoundResponse.data
    );

    // Test: Invalid trail name
    const invalidTrailResponse = await makeRequest('GET', `/api/${TEST_ORG}/invalid-trail-12345`);
    logTest(
        `GET /api/${TEST_ORG}/invalid-trail-12345`,
        !invalidTrailResponse.ok && (invalidTrailResponse.status === 400 || invalidTrailResponse.status === 404),
        'Correctly rejected invalid trail name',
        invalidTrailResponse.data
    );
}

async function testRateLimiting() {
    logGroup('Rate Limiting');
    
    logSkip(
        'Rate limiting test',
        'Requires 100+ requests (run manually if needed)'
    );
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
    console.log(`\n${colors.blue}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}  StewardView API Endpoint Tests${colors.reset}`);
    console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}\n`);
    console.log(`Testing API at: ${colors.cyan}${BASE_URL}${colors.reset}`);
    console.log(`Organization: ${colors.cyan}${TEST_ORG}${colors.reset}`);
    console.log(`Trail: ${colors.cyan}${TEST_TRAIL}${colors.reset}`);

    await testBasicConnectivity();
    await testOrganizations();
    await testTrails();
    await testPhotoUpload();
    await testThumbnails();
    await testTimelapse();
    await testErrorHandling();
    await testRateLimiting();

    printSummary();
}

function printSummary() {
    console.log(`\n${colors.blue}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}  Test Summary${colors.reset}`);
    console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}\n`);
    
    const total = results.passed + results.failed + results.skipped;
    console.log(`  Total Tests:   ${total}`);
    console.log(`  ${colors.green}Passed:        ${results.passed}${colors.reset}`);
    console.log(`  ${colors.red}Failed:        ${results.failed}${colors.reset}`);
    console.log(`  ${colors.yellow}Skipped:       ${results.skipped}${colors.reset}`);
    
    const totalRun = results.passed + results.failed;
    const passRate = totalRun > 0 ? ((results.passed / totalRun) * 100).toFixed(1) : 0;
    console.log(`\n  Pass Rate:     ${passRate}%\n`);

    if (results.failed > 0) {
        console.log(`${colors.red}Some tests failed. Check the output above for details.${colors.reset}\n`);
        process.exit(1);
    } else {
        console.log(`${colors.green}All tests passed!${colors.reset}\n`);
        process.exit(0);
    }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main() {
    console.log(`${colors.cyan}Checking dependencies...${colors.reset}`);
    
    try {
        await import('form-data');
    } catch (error) {
        console.log(`${colors.yellow}Installing form-data package...${colors.reset}`);
        const { execSync } = require('child_process');
        execSync('npm install form-data', { stdio: 'inherit' });
    }

    createTestImage();
    await runTests();
}

// Run tests
main().catch(error => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
});