#!/usr/bin/env node

/**
 * OAuth2 Authentication Script
 * Run this once to authenticate with your Google account
 * 
 * Usage: node authenticate.js
 */

const oauth2Service = require('../services/oauth2Service');

const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
];

async function main() {
    console.log('StewardView OAuth2 Authentication\n');
    
    try {
        await oauth2Service.authenticate(SCOPES);
        console.log('✓ Authentication complete!');
        console.log('✓ You can now start the server with: npm run dev\n');
        process.exit(0);
    } catch (error) {
        console.error('✗ Authentication failed:', error.message);
        process.exit(1);
    }
}

main();