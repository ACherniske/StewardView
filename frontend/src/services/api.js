import { retryWithBackoff } from './retryHandler.js'; 
import { storageService, UploadStatus } from './storage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Upload photo to backend with retry logic
 * @param {Object} processedImage - Processed photo data
 * @param {string} orgName - Organization name (e.g., 'kent-land-trust')
 * @param {string} trailName - Trail identifier
 * @param {Function} onRetry - Callback on retry attempt
 * @returns {Promise<Object>}
 */
export async function uploadPhoto(processedImage, orgName, trailName, onRetry) {
    // Destructure ONLY the properties we need, ignoring any callbacks
    const { file, filename, metadata } = processedImage;

    // Validate required fields
    if (!file) {
        throw new Error('File is required for upload');
    }

    // Generate unique upload id
    const uploadId = generateUploadID();

    // Create queued upload entry (only store cloneable data)
    // Extract only serializable properties from metadata
    const serializableMetadata = {};
    if (metadata && typeof metadata === 'object') {
        // Only copy primitive values and plain objects, skip functions
        for (const [key, value] of Object.entries(metadata)) {
            if (typeof value !== 'function' && value !== undefined) {
                // Handle nested objects carefully
                if (typeof value === 'object' && value !== null && !(value instanceof File) && !(value instanceof Blob)) {
                    try {
                        // Test if it's serializable
                        JSON.parse(JSON.stringify(value));
                        serializableMetadata[key] = value;
                    } catch (e) {
                        console.warn(`Skipping non-serializable metadata property: ${key}`);
                    }
                } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    // Store primitives directly
                    serializableMetadata[key] = value;
                }
            }
        }
    }

    // Create upload entry with ONLY serializable data
    const queuedUpload = {
        id: uploadId,
        file: file, // File/Blob objects are cloneable
        metadata: serializableMetadata,
        filename: filename || 'upload.jpg',
        orgName,
        trailName,
        retryCount: 0,
        status: UploadStatus.PENDING,
        createdAt: new Date().toISOString()
    };

    // Debug: Log what we're trying to store
    console.log('Attempting to store upload:', {
        id: uploadId,
        hasFile: !!file,
        fileType: file?.type,
        metadataKeys: Object.keys(serializableMetadata),
        filename,
        orgName,
        trailName
    });

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
        setTimeout(async () => {
            await storageService.deleteUpload(uploadId);
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
 * @param {Blob|File} file - Image file to upload
 * @param {string} filename - Filename for upload
 * @param {Object} metadata - Metadata to include
 * @param {string} orgName - Organization name
 * @param {string} trailName - Trail identifier
 * @returns {Promise<Object>}
 */
async function performUpload(file, filename, metadata, orgName, trailName) {
    const formData = new FormData();
    formData.append('photo', file, filename);
    
    // Backend expects timestamp in the body
    // Use metadata.timestamp if available, otherwise use current time
    const timestamp = metadata?.timestamp || new Date().toISOString();
    formData.append('timestamp', timestamp);

    // Backend endpoint: POST /api/:orgName/:trailName/upload
    const response = await fetch(`${API_BASE_URL}/${orgName}/${trailName}/upload`, {
        method: 'POST',
        body: formData
        // Note: Don't set Content-Type header, browser will set it with boundary
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Upload failed');
    }

    return await response.json();
}

/**
 * Get all organizations
 * @returns {Promise<Array>}
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
 * Get trails for an organization
 * @param {string} orgName - Organization name
 * @returns {Promise<Array>}
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
 * Fetch trail information (compatibility function)
 * @param {string} orgName - Organization name
 * @param {string} trailName - Trail identifier
 * @returns {Promise<Object>}
 */
export async function getTrailInfo(orgName, trailName) {
    try {
        // You can extend this to get specific trail info
        // For now, just return basic info
        const trails = await getTrails(orgName);
        const trail = trails.find(t => t === trailName);
        
        if (!trail) {
            return null;
        }

        return {
            name: trail,
            organization: orgName
        };
    } catch (error) {
        console.error('Error fetching trail info:', error);
        return null;
    }
}

/**
 * Generate timelapse for organization
 * @param {string} orgName - Organization name
 * @param {Array<string>} trailNames - Optional array of trail names (empty = all trails)
 * @returns {Promise<Blob>} - Video file blob
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
            throw new Error(errorData.message || 'Timelapse generation failed');
        }

        // Response is a video file
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
 * @returns {Promise<Blob>} - Video file blob
 */
export async function generateTrailTimelapse(orgName, trailName) {
    return generateTimelapse(orgName, [trailName]);
}

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
            throw new Error('Upload not found');
        }

        // Create a clean processedImage object with only serializable data
        return await uploadPhoto(
            {
                file: upload.file,
                filename: upload.filename,
                metadata: upload.metadata
            },
            upload.orgName,
            upload.trailName,
            onRetry // Pass the callback as a separate parameter
        );
    } catch (error) {
        console.error('Error retrying upload:', error);
        throw error;
    }
}

/**
 * Generate unique upload ID
 * @returns {string}
 */
function generateUploadID() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check API health
 * @returns {Promise<boolean>}
 */
export async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        return response.ok;
    } catch (error) {
        return false;
    }
}