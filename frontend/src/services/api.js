// services/api.js
import { retryWithBackoff } from './retryHandler.js';
import { storageService, UploadStatus } from './storage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// ============================================================================
// UPLOAD OPERATIONS
// ============================================================================

/**
 * Upload photo to backend with retry logic and queue management
 * @param {Object} processedImage - Processed photo data
 * @param {string} orgName - Organization name (e.g., 'riverbend-land-trust')
 * @param {string} trailName - Trail identifier
 * @param {Function} onRetry - Optional callback on retry attempt
 * @returns {Promise<Object>} Upload result
 */
export async function uploadPhoto(processedImage, orgName, trailName, onRetry) {
    const { file, filename, metadata } = processedImage;

    // Validate required fields
    if (!file) {
        throw new Error('File is required for upload');
    }
    if (!orgName) {
        throw new Error('Organization name is required');
    }
    if (!trailName) {
        throw new Error('Trail name is required');
    }

    // Generate unique upload ID
    const uploadId = generateUploadID();

    // Create queued upload entry (only serializable data)
    const queuedUpload = {
        id: uploadId,
        file: file,
        metadata: sanitizeMetadata(metadata),
        filename: filename || 'photo.jpg',
        orgName,
        trailName,
        retryCount: 0,
        status: UploadStatus.PENDING,
        createdAt: new Date().toISOString()
    };

    try {
        // Add to queue
        await storageService.addUpload(queuedUpload);

        // Update status to uploading
        await storageService.updateUpload(uploadId, {
            status: UploadStatus.UPLOADING,
            lastAttempt: new Date().toISOString()
        });

        // Attempt upload with retry logic
        const result = await retryWithBackoff(
            () => performUpload(file, filename, metadata, orgName, trailName),
            {
                maxRetries: 5,
                onRetry: async (attempt, error) => {
                    console.log(`Upload attempt ${attempt} failed:`, error.message);
                    
                    // Update queue status
                    await storageService.updateUpload(uploadId, {
                        status: UploadStatus.RETRYING,
                        retryCount: attempt,
                        lastAttempt: new Date().toISOString(),
                        error: error.message
                    });

                    // Call UI callback if provided
                    if (onRetry) {
                        onRetry(error.message, attempt);
                    }
                }
            }
        );

        // Success - update queue
        await storageService.updateUpload(uploadId, {
            status: UploadStatus.SUCCESS,
            lastAttempt: new Date().toISOString(),
            result: result
        });

        // Clean up successful upload after 1 minute
        setTimeout(() => {
            storageService.deleteUpload(uploadId).catch(console.error);
        }, 60000);

        return result;

    } catch (error) {
        console.error('Upload failed after all retries:', error);

        // Mark as failed in queue
        await storageService.updateUpload(uploadId, {
            status: UploadStatus.FAILED,
            lastAttempt: new Date().toISOString(),
            error: error.message
        });

        throw error;
    }
}

/**
 * Perform the actual upload to backend
 * @private
 */
async function performUpload(file, filename, metadata, orgName, trailName) {
    const formData = new FormData();
    formData.append('photo', file, filename);
    
    // Backend expects timestamp in the body
    const timestamp = metadata?.timestamp || new Date().toISOString();
    formData.append('timestamp', timestamp);

    // POST /api/:orgName/:trailName/upload
    const response = await fetch(`${API_BASE_URL}/${orgName}/${trailName}/upload`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Upload failed');
    }

    return await response.json();
}

/**
 * Sanitize metadata to only include serializable properties
 * @private
 */
function sanitizeMetadata(metadata) {
    const serializable = {};
    
    if (!metadata || typeof metadata !== 'object') {
        return serializable;
    }

    for (const [key, value] of Object.entries(metadata)) {
        // Skip functions and undefined
        if (typeof value === 'function' || value === undefined) {
            continue;
        }

        // Handle primitives
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            serializable[key] = value;
            continue;
        }

        // Handle objects (but skip Files, Blobs, and non-serializable objects)
        if (typeof value === 'object' && value !== null && 
            !(value instanceof File) && !(value instanceof Blob)) {
            try {
                JSON.parse(JSON.stringify(value));
                serializable[key] = value;
            } catch (e) {
                console.warn(`Skipping non-serializable metadata property: ${key}`);
            }
        }
    }

    return serializable;
}

/**
 * Generate unique upload ID
 * @private
 */
function generateUploadID() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// UPLOAD QUEUE MANAGEMENT
// ============================================================================

/**
 * Get pending uploads from queue
 * @returns {Promise<Array>}
 */
export async function getPendingUploads() {
    try {
        return await storageService.getPendingUploads();
    } catch (error) {
        console.error('Error getting pending uploads:', error);
        return [];
    }
}

/**
 * Retry a failed upload
 * @param {string} uploadId - Upload ID to retry
 * @param {Function} onRetry - Optional callback for retry attempts
 * @returns {Promise<Object>}
 */
export async function retryUpload(uploadId, onRetry) {
    try {
        const upload = await storageService.getUpload(uploadId);
        
        if (!upload) {
            throw new Error('Upload not found in queue');
        }

        return await uploadPhoto(
            {
                file: upload.file,
                filename: upload.filename,
                metadata: upload.metadata
            },
            upload.orgName,
            upload.trailName,
            onRetry
        );
    } catch (error) {
        console.error('Error retrying upload:', error);
        throw error;
    }
}

/**
 * Clear completed uploads from queue
 * @returns {Promise<void>}
 */
export async function clearCompletedUploads() {
    try {
        const uploads = await storageService.getAllUploads();
        const completed = uploads.filter(u => 
            u.status === UploadStatus.SUCCESS || u.status === UploadStatus.FAILED
        );

        for (const upload of completed) {
            await storageService.deleteUpload(upload.id);
        }
    } catch (error) {
        console.error('Error clearing completed uploads:', error);
    }
}

// ============================================================================
// ORGANIZATION OPERATIONS
// ============================================================================

/**
 * Get all organizations
 * @returns {Promise<Array>} Array of organization objects
 */
export async function getOrganizations() {
    try {
        const response = await fetch(`${API_BASE_URL}/organizations`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch organizations: ${response.status}`);
        }

        const data = await response.json();
        return data.organizations || [];
    } catch (error) {
        console.error('Error fetching organizations:', error);
        return [];
    }
}

/**
 * Get organization statistics
 * @param {string} orgName - Organization name
 * @returns {Promise<Object|null>} Organization stats or null
 */
export async function getOrganizationStats(orgName) {
    try {
        const response = await fetch(`${API_BASE_URL}/${orgName}/stats`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch organization stats: ${response.status}`);
        }

        const data = await response.json();
        return data.stats || null;
    } catch (error) {
        console.error('Error fetching organization stats:', error);
        return null;
    }
}

// ============================================================================
// TRAIL OPERATIONS
// ============================================================================

/**
 * Get trails for an organization with stats
 * @param {string} orgName - Organization name
 * @returns {Promise<Array>} Array of trail objects with stats
 */
export async function getTrails(orgName) {
    try {
        const response = await fetch(`${API_BASE_URL}/${orgName}/trails`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch trails: ${response.status}`);
        }

        const data = await response.json();
        return data.trails || [];
    } catch (error) {
        console.error('Error fetching trails:', error);
        return [];
    }
}

/**
 * Get specific trail information
 * @param {string} orgName - Organization name
 * @param {string} trailName - Trail name
 * @returns {Promise<Object|null>} Trail info or null
 */
export async function getTrailInfo(orgName, trailName) {
    try {
        const response = await fetch(`${API_BASE_URL}/${orgName}/${trailName}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch trail info: ${response.status}`);
        }

        const data = await response.json();
        return {
            name: data.trail,
            organization: data.organization,
            stats: data.stats,
            folderId: data.folderId
        };
    } catch (error) {
        console.error('Error fetching trail info:', error);
        return null;
    }
}

/**
 * Get all photos for a trail
 * @param {string} orgName - Organization name
 * @param {string} trailName - Trail name
 * @returns {Promise<Array>} Array of photo objects with metadata
 */
export async function getTrailPhotos(orgName, trailName) {
    try {
        const response = await fetch(`${API_BASE_URL}/${orgName}/${trailName}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch trail photos: ${response.status}`);
        }

        const data = await response.json();
        
        // Backend returns files array with metadata
        return (data.files || []).map(file => ({
            id: file.id,
            name: file.name,
            url: file.webViewLink,
            downloadUrl: file.webContentLink,
            thumbnail: file.thumbnailLink || file.webViewLink,
            createdTime: file.createdTime,
            size: file.size,
            // Parse timestamp from filename if possible
            // Format: TrailName_YYYY-MM-DD_HH-MM-SS.jpg
            timestamp: parseTimestampFromFilename(file.name)
        }));
    } catch (error) {
        console.error('Error fetching trail photos:', error);
        return [];
    }
}

/**
 * Get photos for multiple trails (for gallery view)
 * @param {string} orgName - Organization name
 * @param {Array<string>} trailNames - Array of trail names (empty = all trails)
 * @returns {Promise<Array>} Array of photo objects from all trails
 */
export async function getPhotosForTrails(orgName, trailNames = []) {
    try {
        // If no trails specified, get all trails first
        if (!trailNames || trailNames.length === 0) {
            const trails = await getTrails(orgName);
            trailNames = trails.map(t => t.name);
        }

        // Fetch photos from all trails in parallel
        const photoPromises = trailNames.map(trailName => 
            getTrailPhotos(orgName, trailName)
        );

        const photoArrays = await Promise.all(photoPromises);
        
        // Flatten and sort by timestamp (newest first)
        const allPhotos = photoArrays.flat();
        allPhotos.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.createdTime).getTime();
            const timeB = new Date(b.timestamp || b.createdTime).getTime();
            return timeB - timeA; // Newest first
        });

        return allPhotos;
    } catch (error) {
        console.error('Error fetching photos for trails:', error);
        return [];
    }
}

/**
 * Parse timestamp from filename
 * @private
 * @param {string} filename - Filename to parse
 * @returns {string|null} ISO timestamp or null
 */
function parseTimestampFromFilename(filename) {
    try {
        // Format: TrailName_YYYY-MM-DD_HH-MM-SS.jpg
        const match = filename.match(/(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/);
        if (match) {
            const [, date, time] = match;
            const timeFormatted = time.replace(/-/g, ':');
            return new Date(`${date}T${timeFormatted}`).toISOString();
        }
    } catch (e) {
        console.warn('Could not parse timestamp from filename:', filename);
    }
    return null;
}

// ============================================================================
// TIMELAPSE OPERATIONS
// ============================================================================

/**
 * Generate timelapse for organization
 * @param {string} orgName - Organization name
 * @param {Array<string>} trailNames - Optional array of trail names (empty = all trails)
 * @returns {Promise<Blob>} GIF file blob
 */
export async function generateTimelapse(orgName, trailNames = []) {
    try {
        const response = await fetch(`${API_BASE_URL}/${orgName}/generate-timelapse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ trailNames })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || 'Timelapse generation failed');
        }

        // Response is a GIF file
        return await response.blob();
    } catch (error) {
        console.error('Error generating timelapse:', error);
        throw error;
    }
}

/**
 * Generate timelapse for a specific trail
 * @param {string} orgName - Organization name
 * @param {string} trailName - Trail name
 * @returns {Promise<Blob>} GIF file blob
 */
export async function generateTrailTimelapse(orgName, trailName) {
    return generateTimelapse(orgName, [trailName]);
}

/**
 * Download timelapse to user's device
 * @param {Blob} blob - GIF blob
 * @param {string} filename - Filename for download
 */
export function downloadTimelapse(blob, filename = `timelapse-${Date.now()}.gif`) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check API health
 * @returns {Promise<boolean>} True if API is healthy
 */
export async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Get full API health status
 * @returns {Promise<Object|null>} Health status object or null
 */
export async function getApiHealthStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        
        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching API health:', error);
        return null;
    }
}

/**
 * Validate organization exists
 * @param {string} orgName - Organization name to validate
 * @returns {Promise<boolean>} True if organization exists
 */
export async function validateOrganization(orgName) {
    try {
        const orgs = await getOrganizations();
        return orgs.some(org => org.slug === orgName);
    } catch (error) {
        console.error('Error validating organization:', error);
        return false;
    }
}

/**
 * Validate trail exists for organization
 * @param {string} orgName - Organization name
 * @param {string} trailName - Trail name to validate
 * @returns {Promise<boolean>} True if trail exists
 */
export async function validateTrail(orgName, trailName) {
    try {
        const trails = await getTrails(orgName);
        return trails.some(trail => trail.name === trailName);
    } catch (error) {
        console.error('Error validating trail:', error);
        return false;
    }
}