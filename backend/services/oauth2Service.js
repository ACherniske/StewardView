const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class OAuth2Service {
    constructor() {
        this.oauth2Client = null;
        this.credentials = null;
        this.tokenPath = path.join(process.cwd(), 'token.json');
        this.credentialsPath = path.join(process.cwd(), 'oauth2-credentials.json');
    }

    /**
     * Load OAuth2 credentials from environment or file
     */
    loadCredentials() {
        // Try to load from environment variable first (for Vercel/production)
        if (process.env.OAUTH2_CREDENTIALS) {
            try {
                this.credentials = JSON.parse(process.env.OAUTH2_CREDENTIALS);
                console.log('Loaded OAuth2 credentials from environment variable');
            } catch (error) {
                throw new Error('Failed to parse OAUTH2_CREDENTIALS environment variable');
            }
        } 
        // Fall back to file (for local development)
        else if (fs.existsSync(this.credentialsPath)) {
            const content = fs.readFileSync(this.credentialsPath, 'utf8');
            this.credentials = JSON.parse(content);
            console.log('Loaded OAuth2 credentials from file');
        } 
        else {
            throw new Error(`OAuth2 credentials not found. Set OAUTH2_CREDENTIALS env var or create ${this.credentialsPath}`);
        }
        
        const { client_secret, client_id, redirect_uris } = this.credentials.installed || this.credentials.web;
        
        this.oauth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris[0]
        );

        return this.oauth2Client;
    }

    /**
     * Get stored token from environment or file
     */
    getStoredToken() {
        // Only use file-based token storage
        if (fs.existsSync(this.tokenPath)) {
            const token = fs.readFileSync(this.tokenPath, 'utf8');
            console.log('Loaded OAuth2 token from file');
            return JSON.parse(token);
        }
        return null;
    }

    /**
     * Save token to file
     */
    saveToken(token) {
        let tokenToSave = { ...token };
        // Preserve existing refresh_token if not present in new token
        if (!token.refresh_token && fs.existsSync(this.tokenPath)) {
            try {
                const existingToken = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
                if (existingToken.refresh_token) {
                    tokenToSave.refresh_token = existingToken.refresh_token;
                }
            } catch (err) {
                console.warn('Could not read existing token for refresh_token preservation:', err);
            }
        }
        fs.writeFileSync(this.tokenPath, JSON.stringify(tokenToSave));
        console.log('Token stored to', this.tokenPath);
    }

    /**
     * Generate auth URL for user to visit
     */
    getAuthUrl(scopes) {
        const authUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent', // Force to get refresh token
        });
        return authUrl;
    }

    /**
     * Get token from authorization code
     */
    async getTokenFromCode(code) {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        this.saveToken(tokens);
        return tokens;
    }

    /**
     * Interactive authentication flow
     */
    async authenticate(scopes) {
        this.loadCredentials();

        // Check if we already have a token
        const token = this.getStoredToken();
        if (token) {
            this.oauth2Client.setCredentials(token);
            
            // Test if token is still valid
            try {
                await this.oauth2Client.getAccessToken();
                console.log('Using existing authentication token.');
                return this.oauth2Client;
            } catch (error) {
                console.log('Stored token is invalid or expired. Re-authenticating...');
            }
        }

        // Need to authenticate
        const authUrl = this.getAuthUrl(scopes);
        console.log('\n=================================================================');
        console.log('AUTHORIZATION REQUIRED');
        console.log('=================================================================');
        console.log('\nPlease visit this URL to authorize the application:');
        console.log('\n' + authUrl + '\n');
        console.log('After authorization, you will receive a code.');
        console.log('=================================================================\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve, reject) => {
            rl.question('Enter the authorization code: ', async (code) => {
                rl.close();
                try {
                    await this.getTokenFromCode(code);
                    console.log('Authentication successful!\n');
                    resolve(this.oauth2Client);
                } catch (error) {
                    reject(new Error('Error retrieving access token: ' + error.message));
                }
            });
        });
    }

    /**
     * Get authenticated client (non-interactive)
     * Use this in your API after initial authentication
     */
    async getClient(scopes) {
        this.loadCredentials();
        
        const token = this.getStoredToken();
        if (!token) {
            throw new Error('No stored token found. Please run authentication first.');
        }

        this.oauth2Client.setCredentials(token);
        
        // Refresh token if needed
        try {
            await this.oauth2Client.getAccessToken();
        } catch (error) {
            throw new Error('Token is invalid. Please re-authenticate.');
        }

        return this.oauth2Client;
    }

    /**
     * Revoke token (logout)
     */
    async revokeToken() {
        if (this.oauth2Client && this.oauth2Client.credentials.access_token) {
            await this.oauth2Client.revokeCredentials();
            if (fs.existsSync(this.tokenPath)) {
                fs.unlinkSync(this.tokenPath);
            }
            console.log('Token revoked and deleted.');
        }
    }
}

module.exports = new OAuth2Service();