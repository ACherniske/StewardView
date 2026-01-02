import { useState, useRef } from 'react';
import { processImageMetadata } from '../services/imageProcessor';
import { uploadPhoto } from '../services/api';
import { Upload } from 'lucide-react';
import '../styles/components/FileUpload.css';

function FileUpload({ orgName, trailName, onUploadStart, onUploadSuccess, onUploadError }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

  //handle file selection
    const handleFileSelect = (file) => {
        //validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }

        //validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; //10MB
        if (file.size > maxSize) {
            alert('File size exceeds 10MB limit.');
            return;
        }

        setSelectedFile(file);

        //create preview URL
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
    };

    //handle file input change
    const handleInputChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    //handle drag events
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    //clear selected file
    const clearSelection = () => {
        setSelectedFile(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    //submit selected file
    const submitFile = async () => {
        if (!selectedFile) return;

        try {
            onUploadStart();

            //process image with metadata
            const processedImage = await processImageMetadata(
                selectedFile,
                trailName
            );

            //upload to backend with correct parameter order
            // uploadPhoto(processedImage, orgName, trailName, onRetry)
            await uploadPhoto(
                processedImage,
                orgName,        // Organization name
                trailName,      // Trail name
                (errorMsg, retryCount) => {  // onRetry callback
                    console.log(`Retry attempt ${retryCount}: ${errorMsg}`);
                    // You can add UI feedback here if needed
                }
            );

            onUploadSuccess();

            //clean up
            clearSelection();
        } catch (error) {
            onUploadError(error.message);
            console.error('Error uploading file:', error);
        }
    };

  return (
    <div className="file-upload-card">
      <h2 className="file-upload-title">File Upload</h2>
      <div className="file-upload-divider" />
      {!selectedFile ? (
        <>
          <div
            className={`upload-area ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="upload-icon-box">
              <Upload size={40} color="#7bb661" />
            </div>
            <div className="upload-area-text">
              <span className="upload-area-main">Drag files to upload</span>
              <span className="upload-area-or">or</span>
            </div>
            <button
              className="choose-file-btn"
              type="button"
              onClick={e => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Choose File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              style={{ display: 'none' }}
            />
            <div className="upload-requirements">
              Accepted: JPEG, PNG &nbsp;|&nbsp; Max: 10MB
            </div>
          </div>
        </>
      ) : (
        <div className="file-preview">
          <div className="preview-container">
            <img
              src={previewUrl}
              alt="Selected file preview"
              className="preview-image"
            />
          </div>
          <div className="preview-controls">
            <button className="btn btn-secondary" onClick={clearSelection}>
              Remove
            </button>
            <button className="btn btn-primary" onClick={submitFile}>
              Submit Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileUpload;