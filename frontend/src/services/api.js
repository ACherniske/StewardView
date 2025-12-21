import { retryWithBackoff } from './retryHandler.js'; 
import {storageService, UploadStatus } from './storage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Upload photo to backend with retry logic
 * @param {Object} processedImage - Processed photo data
 * @param {string} trailName - Trail identifier
 * @param {Function} onRetry - Callback on retry attempt
 * @returns {Promise<Object>}
 */

export async function uploadPhoto() {
    const { file, filename, metadata } = processedImage;

    //generate unique upload id
    const uploadID = generateUploadID();

    //create queued upload entry
    const queuedUpload = {
        id: uploadID,
        file,
        metadata,
        filename,
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
      () => performUpload(file, filename, metadata, trailName),
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

          // Call UI callback
          if (onRetry) {
            onRetry(error.message, attempt);
          }
        }
      }
    );

    // Success - update queue
    await storageService.updateUpload(uploadId, {
      status: UploadStatus.SUCCESS,
      lastAttempt: new Date().toISOString()
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
 * @param {string} trailName - Trail identifier
 * @returns {Promise<Object>}
 */

async function performUpload(file, filename, metadata, trailName) {
    const formData = new FormData();
    formData.append('photo', file, filename);
    formData.append('trailName', trailName);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Upload failed');
    }

    return await response.json();
}

/**
 * Fetch trail information
 * @param {string} trailName - Trail identifier
 * @returns {Promise<Object>}
*/

export async function getTrailInfo(trailName) {
  try {
    const response = await fetch(`${API_BASE_URL}/trail/${trailName}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch trail info: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching trail info:', error);
    return null;
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