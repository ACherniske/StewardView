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

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:3001';
const TEST_ORG = 'kent-land-trust'; // Change to your test organization
const TEST_TRAIL = 'test-trail';
const TEST_IMAGE_PATH = './test-image.jpg'; // Path to a test image file

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
    tests: []
};

/**
 * Helper function to make HTTP requests
 */
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
        } else {
            data = await response.text();
        }

        return {
            status: response.status,
            ok: response.ok,
            data,
            headers: Object.fromEntries(response.headers.entries())
        };
    } catch (error) {
        return {
            status: 0,
            ok: false,
            error: error.message
        };
    }
}

/**
 * Helper function to upload file using form-data with http module
 */
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

/**
 * Create a test image if it doesn't exist
 */
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

/**
 * Print test result
 */
function logTest(name, passed, message = '', data = null) {
    const status = passed ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
    console.log(`  ${status} ${name}`);
    
    if (message) {
        console.log(`    ${colors.yellow}${message}${colors.reset}`);
    }
    
    if (data && !passed) {
        console.log(`    ${colors.cyan}Response:${colors.reset}`, JSON.stringify(data, null, 2));
    }

    results.tests.push({ name, passed, message, data });
    if (passed) {
        results.passed++;
    } else {
        results.failed++;
    }
}

/**
 * Test Suite
 */
async function runTests() {
    console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}  StewardView API Endpoint Tests${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
    console.log(`Testing API at: ${colors.cyan}${BASE_URL}${colors.reset}\n`);

    // Test 1: Root endpoint
    console.log(`${colors.yellow}Test Group: Basic Connectivity${colors.reset}`);
    const rootResponse = await makeRequest('GET', '/');
    logTest(
        'GET / (Root endpoint)',
        rootResponse.ok && rootResponse.data.service === 'StewardView API',
        rootResponse.ok ? 'API is responding' : 'API is not responding',
        rootResponse.data
    );

    // Test 2: Health check
    const healthResponse = await makeRequest('GET', '/api/health');
    logTest(
        'GET /api/health',
        healthResponse.ok && healthResponse.data.status === 'ok',
        healthResponse.ok ? `Uptime: ${Math.floor(healthResponse.data.uptime)}s` : 'Health check failed',
        healthResponse.data
    );

    // Test 3: List organizations
    console.log(`\n${colors.yellow}Test Group: Organizations${colors.reset}`);
    const orgsResponse = await makeRequest('GET', '/api/organizations');
    const hasOrgs = orgsResponse.ok && Array.isArray(orgsResponse.data.organizations);
    logTest(
        'GET /api/organizations',
        hasOrgs,
        hasOrgs ? `Found ${orgsResponse.data.organizations.length} organizations` : 'Failed to list organizations',
        orgsResponse.data
    );

    // Test 4: List trails for organization
    console.log(`\n${colors.yellow}Test Group: Trails${colors.reset}`);
    const trailsResponse = await makeRequest('GET', `/api/${TEST_ORG}/trails`);
    const hasTrails = trailsResponse.ok && Array.isArray(trailsResponse.data.trails);
    logTest(
        `GET /api/${TEST_ORG}/trails`,
        hasTrails,
        hasTrails ? `Found ${trailsResponse.data.trails.length} trails` : 'Failed to list trails',
        trailsResponse.data
    );

    // Test 5: Invalid organization
    const invalidOrgResponse = await makeRequest('GET', '/api/invalid-org/trails');
    logTest(
        'GET /api/invalid-org/trails (should fail)',
        !invalidOrgResponse.ok && invalidOrgResponse.status === 400,
        'Correctly rejected invalid organization',
        invalidOrgResponse.data
    );

    // Test 6: Upload photo (requires test image)
    console.log(`\n${colors.yellow}Test Group: Photo Upload${colors.reset}`);
    
    if (fs.existsSync(TEST_IMAGE_PATH)) {
        try {
            const FormData = (await import('form-data')).default;
            const formData = new FormData();
            
            // Use createReadStream for proper streaming
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
        } catch (error) {
            logTest(
                `POST /api/${TEST_ORG}/${TEST_TRAIL}/upload`,
                false,
                `Error: ${error.message}`
            );
        }
    } else {
        console.log(`  ${colors.yellow}⊘ SKIP${colors.reset} Photo upload test (no test image)`);
        results.skipped++;
    }

    // Test 7: Upload without timestamp (should fail)
    if (fs.existsSync(TEST_IMAGE_PATH)) {
        try {
            const FormData = (await import('form-data')).default;
            const formData = new FormData();
            
            // Use createReadStream for proper streaming
            formData.append('photo', fs.createReadStream(TEST_IMAGE_PATH), {
                filename: 'test-image.jpg',
                contentType: 'image/jpeg'
            });
            // Intentionally not adding timestamp

            const invalidUploadResponse = await uploadFile(`/api/${TEST_ORG}/${TEST_TRAIL}/upload`, formData);

            logTest(
                'POST upload without timestamp (should fail)',
                !invalidUploadResponse.ok && invalidUploadResponse.status === 400,
                'Correctly rejected upload without timestamp',
                invalidUploadResponse.data
            );
        } catch (error) {
            logTest(
                'POST upload without timestamp (should fail)',
                false,
                `Error: ${error.message}`
            );
        }
    } else {
        console.log(`  ${colors.yellow}⊘ SKIP${colors.reset} Upload validation test (no test image)`);
        results.skipped++;
    }

    // Test 8: Generate timelapse
    console.log(`\n${colors.yellow}Test Group: Timelapse Generation${colors.reset}`);
    console.log(`  ${colors.yellow}⊘ SKIP${colors.reset} Timelapse tests (requires images in Drive)`);
    console.log(`  ${colors.cyan}Note: To test timelapse, manually POST to:${colors.reset}`);
    console.log(`  ${colors.cyan}${BASE_URL}/api/${TEST_ORG}/generate-timelapse${colors.reset}`);
    console.log(`  ${colors.cyan}Body: { "trailNames": ["${TEST_TRAIL}"] }${colors.reset}`);
    results.skipped += 2;

    // Test 9: 404 endpoint
    console.log(`\n${colors.yellow}Test Group: Error Handling${colors.reset}`);
    const notFoundResponse = await makeRequest('GET', '/api/nonexistent');
    logTest(
        'GET /api/nonexistent (should 404)',
        notFoundResponse.status === 404,
        'Correctly returned 404 for invalid endpoint',
        notFoundResponse.data
    );

    // Test 10: Rate limiting (optional - makes many requests)
    console.log(`  ${colors.yellow}⊘ SKIP${colors.reset} Rate limiting test (requires 100+ requests)`);
    results.skipped++;

    // Print summary
    printSummary();
}

/**
 * Print test summary
 */
function printSummary() {
    console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}  Test Summary${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
    
    const total = results.passed + results.failed + results.skipped;
    console.log(`  Total Tests: ${total}`);
    console.log(`  ${colors.green}Passed: ${results.passed}${colors.reset}`);
    console.log(`  ${colors.red}Failed: ${results.failed}${colors.reset}`);
    console.log(`  ${colors.yellow}Skipped: ${results.skipped}${colors.reset}`);
    
    const passRate = total > 0 ? ((results.passed / (results.passed + results.failed)) * 100).toFixed(1) : 0;
    console.log(`  Pass Rate: ${passRate}%\n`);

    if (results.failed > 0) {
        console.log(`${colors.red}Some tests failed. Check the output above for details.${colors.reset}\n`);
        process.exit(1);
    } else {
        console.log(`${colors.green}All tests passed!${colors.reset}\n`);
        process.exit(0);
    }
}

/**
 * Main execution
 */
async function main() {
    console.log(`${colors.cyan}Checking for form-data package...${colors.reset}`);
    
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