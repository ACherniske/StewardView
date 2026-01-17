import { useState, useRef } from 'react';
import { processImageMetadata } from '../services/imageProcessor';
import { uploadPhoto } from '../services/api';
import { Camera } from 'lucide-react';
import '../styles/components/MobileCamera.css';

function MobileCamera({ orgName, trailName, onUploadStart, onUploadSuccess, onUploadError }) {
    const [capturedImage, setCapturedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);

    //trigger native camera app
    const openCamera = () => {
        fileInputRef.current?.click();
    };

    //handle image capture
    const handlePhotoCapture = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        //validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please capture a valid image file.');
            return;
        }

        //create preview URL
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setCapturedImage(file);
    };

    //retake image
    const retakeImage = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        setCapturedImage(null);

        //clear file file
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    //submit captured image
    const submitPhoto = async () => {
        if (!capturedImage) return;

        try {
            onUploadStart();

            //process image with metadata
            const ProcessedImage = await processImageMetadata(
                capturedImage,
                trailName
            );

            //upload to backend with correct parameter order
            // uploadPhoto(processedImage, orgName, trailName, onRetry)
            await uploadPhoto(
                ProcessedImage, 
                orgName,        // Organization name
                trailName,      // Trail name
                (errorMsg, retryCount) => {  // onRetry callback
                    console.log(`Retry attempt ${retryCount}: ${errorMsg}`);
                    // You can add UI feedback here if needed
                }
            );

            onUploadSuccess();

            //clean up
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setCapturedImage(null);
            setPreviewUrl(null);
        } catch (error) {
            console.error('Error submitting image:', error);
            onUploadError(error.message);
        }
    };

  return (
    <div className="mobile-camera-card">
      <h2 className="mobile-camera-title">Take a Photo</h2>
      <div className="mobile-camera-divider" />
      {!capturedImage ? (
        <div className="camera-prompt">
          <div className="mobile-camera-icon-box">
            <Camera size={40} color="#7bb661" />
          </div>
          <div className="mobile-camera-area-text">
            <span className="mobile-camera-area-main">Tap below to open your camera</span>
            <span className="mobile-camera-area-or">and capture the trail view</span>
          </div>
          <button className="mobile-camera-choose-btn" onClick={openCamera}>
            <Camera size={16} color="#fff" />
            Open Camera
          </button>
          {/* Hidden file input that triggers native camera */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className="mobile-camera-preview">
          <div className="mobile-camera-preview-container">
            <img
              src={previewUrl}
              alt="Captured trail"
              className="mobile-camera-preview-image"
            />
          </div>
          <div className="mobile-camera-preview-controls">
            <button className="mobile-camera-btn mobile-camera-btn-secondary" onClick={retakeImage}>
              Retake
            </button>
            <button className="mobile-camera-btn mobile-camera-btn-primary" onClick={submitPhoto}>
              Submit Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileCamera;