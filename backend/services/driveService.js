const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const oauth2Service = require('./oauth2Service');

const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
];

class DriveService {
    constructor() {
        this.drive = null;
        // Cache for organization folders: orgSlug -> folderId
        this.orgFolderCache = new Map();
        // Cache for trail folders: "orgSlug/trailName" -> folderId
        this.trailFolderCache = new Map();
    }

    /**
     * Initialize Google Drive client with OAuth2
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            const authClient = await oauth2Service.getClient(SCOPES);
            this.drive = google.drive({ version: 'v3', auth: authClient });
            console.log('Google Drive service initialized with OAuth2.');
            return true;
        } catch (error) {
            console.error('Error initializing Google Drive service:', error.message);
            console.error('\nPlease run: node authenticate.js\n');
            throw error;
        }
    }

    /**
     * Sanitize folder/file name
     * @return string
     * Replaces invalid characters with underscores
     */
    sanitizeName(name) {
        return name.replace(/[^a-zA-Z0-9-_ ]/g, '_');
    }

    /**
     * Get organization folder
     * Structure: root/orgSlug
     */
    async getOrgFolder(orgSlug) {
        // Get organization config
        const { getOrganization } = require('../config/organizations');
        let orgConfig;
        try {
            orgConfig = getOrganization(orgSlug);
        } catch (error) {
            throw new Error(`Organization '${orgSlug}' is not active or not found.`);
        }

        if (!orgConfig || !orgConfig.driveFolderId) {
            throw new Error(`Organization folder ID for '${orgSlug}' not found in config.`);
        }

        // Cache and return folder ID
        this.orgFolderCache.set(orgSlug, orgConfig.driveFolderId);
        return orgConfig.driveFolderId;
    }

    /**
     * Get trail folder
     * Structure: root/orgSlug/trailName
     */
    async getOrCreateTrailFolder(orgSlug, trailName) {
        const safeTrailName = this.sanitizeName(trailName);
        const cacheKey = `${orgSlug}/${safeTrailName}`;

        //check cache first
        if (this.trailFolderCache.has(cacheKey)) {
            return this.trailFolderCache.get(cacheKey);
        }

        try {
            //first get org folder
            const orgFolderId = await this.getOrgFolder(orgSlug);

            //search for trail folder
            const response = await this.drive.files.list({
                q: `name='${safeTrailName}' and mimeType='application/vnd.google-apps.folder' and '${orgFolderId}' in parents and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive',
            });

            let folderId;

            if (response.data.files.length > 0) {
                //folder exists
                folderId = response.data.files[0].id;
                console.log(`Found existing folder for trail '${trailName}' in organization '${orgSlug}': ${folderId}`);
            } else {
                //create trail folder
                const folderMetadata = {
                    name: safeTrailName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [orgFolderId],
                };

                const folder = await this.drive.files.create({
                    requestBody: folderMetadata,
                    fields: 'id',
                });

                folderId = folder.data.id;
                console.log(`Created new folder for trail '${trailName}' in organization '${orgSlug}': ${folderId}`);
            }

            //cache and return
            this.trailFolderCache.set(cacheKey, folderId);
            return folderId;
        } catch (error) {
            console.error(`Error getting/creating folder for trail '${trailName}' in organization '${orgSlug}':`, error.message);
            throw error;
        }
    }

    /**
     * Upload file to Google Drive
     * @return uploaded file metadata
     * @throws error on failure
     */
    async uploadFile(orgSlug, trailName, filePath, filename, mimeType, description) {
        try {
            //get or create trail folder
            const trailFolderId = await this.getOrCreateTrailFolder(orgSlug, trailName);

            const fileMetadata = {
                name: filename,
                parents: [trailFolderId],
                description: description || `StewardView observation - ${filename}`,
            };

            const media = {
                mimeType: mimeType,
                body: fs.createReadStream(filePath),
            };

            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink, webContentLink, createdTime, size',
            });

            console.log(`File '${filename}' uploaded to Google Drive in trail '${trailName}' of organization '${orgSlug}'. File ID: ${response.data.id}`);
            return response.data;

        } catch (error) {
            console.error(`Error uploading file '${filename}' to trail '${trailName}' in organization '${orgSlug}':`, error.message);
            throw error;
        }
    }

    /**
     * List trails (folders) in an organization
     * @return array of trail names
     * @throws error on failure
     */
    async listTrailsInOrganization(orgSlug, orderBy = 'name') {
        try {
            const orgFolderId = await this.getOrgFolder(orgSlug);
            const response = await this.drive.files.list({
                q: `mimeType='application/vnd.google-apps.folder' and '${orgFolderId}' in parents and trashed=false`,
                fields: 'files(id, name)',
                orderBy: orderBy || 'name',
                spaces: 'drive',
            });
            return response.data.files.map(file => file.name);
        } catch (error) {
            console.error(`Error listing trails in organization '${orgSlug}':`, error.message);
            throw error;
        }
    }

    /**
     * List files in a trail folder
     * @return array of files
     * @throws error on failure
     */
    async listFilesInTrail(orgSlug, trailName, orderBy = 'name') {
        try {
            const trailFolderId = await this.getOrCreateTrailFolder(orgSlug, trailName);
            const response = await this.drive.files.list({
                q: `'${trailFolderId}' in parents and trashed=false`,
                fields: 'files(id, name, mimeType, createdTime, size, webViewLink, webContentLink)',
                orderBy: orderBy || 'name',
            });
            return response.data.files; //array of file objects
        } catch (error) {
            console.error(`Error listing files in trail '${trailName}' of organization '${orgSlug}':`, error.message);
            throw error;
        }
    }

    /**
     * Download file from Google Drive
     * @return void
     * @throws error on failure
     */
    async downloadFile(fileId, destinationPath) {
        try {
            const dest = fs.createWriteStream(destinationPath);

            const response = await this.drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );

            return new Promise((resolve, reject) => {
                let streamEnded = false;
                let writeFinished = false;

                const checkComplete = () => {
                    if (streamEnded && writeFinished) {
                        console.log(`File downloaded to ${destinationPath}`);
                        resolve();
                    }
                };

                response.data
                    .on('end', () => {
                        streamEnded = true;
                        checkComplete();
                    })
                    .on('error', (err) => {
                        dest.destroy();
                        reject(err);
                    })
                    .pipe(dest);

                dest.on('finish', () => {
                    writeFinished = true;
                    checkComplete();
                });

                dest.on('error', (err) => {
                    response.data.destroy();
                    reject(err);
                });
            });
        } catch (error) {
            console.error(`Error downloading file ID '${fileId}':`, error.message);
            throw error;
        }
    }

    /**
     * Get file as buffer (for thumbnails and in-memory processing)
     * @param {string} fileId - Google Drive file ID
     * @returns {Promise<Buffer>} File content as buffer
     */
    async getFileBuffer(fileId) {
        try {
            const response = await this.drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            
            // Collect stream data into buffer
            const chunks = [];
            
            return new Promise((resolve, reject) => {
                response.data
                    .on('data', (chunk) => chunks.push(chunk))
                    .on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        console.log(`File buffer retrieved: ${fileId} (${buffer.length} bytes)`);
                        
                        // Debug: Check the first few bytes to identify file type
                        const header = buffer.slice(0, 16).toString('hex');
                        console.log(`Buffer header: ${header}`);
                        
                        // Check for common image formats
                        const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
                        const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
                        const isGIF = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
                        
                        console.log(`File type detection: PNG=${isPNG}, JPEG=${isJPEG}, GIF=${isGIF}`);
                        
                        if (!isPNG && !isJPEG && !isGIF) {
                            console.warn('WARNING: Buffer does not appear to be a valid image format');
                            // Log first 100 chars as string to see if it's HTML/text
                            console.log('Buffer start (as text):', buffer.slice(0, 100).toString('utf8'));
                        }
                        
                        resolve(buffer);
                    })
                    .on('error', (error) => {
                        console.error(`Stream error for file ${fileId}:`, error.message);
                        reject(error);
                    });
            });
        } catch (error) {
            console.error(`Error getting file buffer for ID '${fileId}':`, error.message);
            throw error;
        }
    }

    /**
     * Clear caches
     */
    clearCache() {
        this.orgFolderCache.clear();
        this.trailFolderCache.clear();
        console.log('Google Drive folder caches cleared.');
    }
}

module.exports = new DriveService();