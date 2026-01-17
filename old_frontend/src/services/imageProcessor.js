/**
 * Process image with metadata before upload
 * @param {Blob|File} imageFile - image file to Process
 * @param {string} trailName - trail identifier
 * @returns {Promise<Object>} - processed image data with metadata
 */

export async function processImageMetadata(imageFile, trailName) {
    const timestamp = new Date().toISOString();

    //generate filename: trailName_YYYY-MM-DD_HH-MM-SS.jpg
    const filename = generateFilename(trailName, timestamp);

    //extract any existing EXIF data if available
    let exifData = {};
    try {
        //try to extract
        if (typeof ExifReader !== 'undefined') {
            const tags = await ExifReader.load(imageFile);
            exifData = extractRelevantExif(tags);
        }
    } catch (error) {
        console.log('EXIF extraction skipped:', error.message);
    }

    //get geolocation if available
    const location = await getGeolocation();

    //prepare metadata
    const metadata = {
        trailName: formatTrailName(trailName),
        trailId: trailName,
        timestamp,
        ...location,
        ...exifData,
        uploadedAt: timestamp
    };

    return {
        file: imageFile,
        filename,
        metadata
    };
}

/**
 * Generate standardized filename
 * @param {string} trailName - trail identifier
 * @param {string} timestamp - ISO timestamp
 * @returns {string} - generated filename
 */

function generateFilename(trailName, timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${trailName}_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.jpg`;
}

/** 
 * Format trail name for display
 * @param {string} trailName - raw trail name
 * @returns {string} - formatted trail name
 */

function formatTrailName(trailName) {
    return trailName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}


/**
 * Extract relevant EXIF data from tags
 * @param {Object} tags 
 * @returns {Object}
 */

function extractRelevantExif(tags) {
  const relevant = {};

  // Camera info
  if (tags.Make?.description) {
    relevant.cameraMake = tags.Make.description;
  }
  if (tags.Model?.description) {
    relevant.cameraModel = tags.Model.description;
  }

  // GPS data
  if (tags.GPSLatitude?.description && tags.GPSLongitude?.description) {
    relevant.gpsLatitude = tags.GPSLatitude.description;
    relevant.gpsLongitude = tags.GPSLongitude.description;
  }

  // Orientation
  if (tags.Orientation?.description) {
    relevant.orientation = tags.Orientation.description;
  }

  return relevant;
}

/**
 * Get current geolocation from browser API
 * @returns {Promise<Object>}
 */
async function getGeolocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({});
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        console.log('Geolocation not available:', error.message);
        resolve({});
      },
      {
        timeout: 5000,
        maximumAge: 0
      }
    );
  });
}