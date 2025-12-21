import { useState, useRef } from 'react';
import { processImageMetadata } from '../services/imageProcessor';
import { uploadPhoto } from '../services/api';
import '../styles/MobileCamera.css';

function MobileCamera() {
    const [capturedImage, setCapturedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);

    //trigger native camera app
    const openCamera = () => {
        fileInputRef.current?.click();
    };

    //handle image capture
    const handleImageCapture = (e) => {
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

            //upload to backend
            await uploadPhoto(ProcessedImage, trailName, onUploadError);

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
    <div className="mobile-camera-container">
      {!capturedImage ? (
        <div className="camera-prompt">
          <div className="camera-icon">📸</div>
          <h3>Take a Photo</h3>
          <p className="camera-instructions">
            Tap the button below to open your camera and capture the trail view.
          </p>
          <button className="btn btn-camera" onClick={openCamera}>
            <span className="camera-emoji">📷</span>
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
        <div className="photo-preview">
          <div className="preview-container">
            <img
              src={previewUrl}
              alt="Captured trail"
              className="preview-image"
            />
          </div>

          <div className="photo-info">
            <p className="photo-name">{capturedImage.name}</p>
            <p className="photo-size">
              {(capturedImage.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>

          <div className="preview-controls">
            <button className="btn btn-secondary" onClick={retakePhoto}>
              Retake
            </button>
            <button className="btn btn-primary" onClick={submitPhoto}>
              Submit Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileCamera;