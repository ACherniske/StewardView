import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Wifi, WifiOff, Smartphone, Monitor, Camera, Upload, ArrowLeft } from 'lucide-react';
import MobileCamera from '../components/MobileCamera';
import FileUpload from '../components/FileUpload';
import UploadModal from '../components/UploadModal';
import PlantBackground from '../components/PlantBackground';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import '../styles/CapturePage.css';

function CapturePage() {
  // Extract BOTH orgName and trailName from URL params
  const { orgName, trailName } = useParams();
  const [activeTab, setActiveTab] = useState('camera');
  const [uploadFeedback, setUploadFeedback] = useState({
    show: false,
    status: '',
    message: '',
    retryCount: 0,
    maxRetries: 5
  });
  const networkStatus = useNetworkStatus();
  const deviceInfo = useDeviceDetection();

  // Format trail name for display (convert hyphens to spaces, capitalize)
  const formatTrailName = (name) => {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const displayTrailName = formatTrailName(trailName);
  const displayOrgName = formatTrailName(orgName);

  const handleUploadStart = () => {
    setUploadFeedback({
      show: true,
      status: 'uploading',
      message: 'Uploading your photo...',
      retryCount: 0,
      maxRetries: 5
    });
  };

  const handleUploadSuccess = () => {
    setUploadFeedback({
      show: true,
      status: 'success',
      message: 'Photo uploaded successfully!',
      retryCount: 0,
      maxRetries: 5
    });
    setTimeout(() => {
      setUploadFeedback(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const handleUploadError = (error, retryCount = 0) => {
    setUploadFeedback({
      show: true,
      status: retryCount > 0 ? 'retrying' : 'failed',
      message: retryCount > 0 
        ? `Connection issue. Retrying (${retryCount}/5)...`
        : error || 'Upload failed. Photo saved for retry when connection improves.',
      retryCount,
      maxRetries: 5
    });
  };

  const handleModalClose = () => {
    setUploadFeedback(prev => ({ ...prev, show: false }));
  };

  return (
    <div className="trail-capture-page">
      <PlantBackground className="plant-bg-layer" />
      <div className="ui-separator-overlay"></div>
      <div className="trail-capture-container">
        <Link to={`/${orgName}/${trailName}`} className="capture-back-button">
          <ArrowLeft size={20} />
          Back
        </Link>
        <h1 className="trail-capture-title">{displayTrailName}</h1>
        <p className="organization-name">{displayOrgName}</p>
        <div className="trail-capture-card-area">
          {deviceInfo.isMobile ? (
            <div className="capture-card">
              <nav className="capture-toggle-nav">
                <button
                  className={`toggle-btn${activeTab === 'camera' ? ' active' : ''}`}
                  onClick={() => setActiveTab('camera')}
                  aria-pressed={activeTab === 'camera'}
                >
                  Camera
                </button>
                <button
                  className={`toggle-btn${activeTab === 'upload' ? ' active' : ''}`}
                  onClick={() => setActiveTab('upload')}
                  aria-pressed={activeTab === 'upload'}
                >
                  Upload
                </button>
              </nav>
              {activeTab === 'camera' ? (
                <MobileCamera
                  orgName={orgName}
                  trailName={trailName}
                  onUploadStart={handleUploadStart}
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                />
              ) : (
                <FileUpload
                  orgName={orgName}
                  trailName={trailName}
                  onUploadStart={handleUploadStart}
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                />
              )}
            </div>
          ) : (
            <div className="capture-card">
              <FileUpload
                orgName={orgName}
                trailName={trailName}
                onUploadStart={handleUploadStart}
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
            </div>
          )}
        </div>
      </div>
      <UploadModal
        show={uploadFeedback.show}
        status={uploadFeedback.status}
        message={uploadFeedback.message}
        retryCount={uploadFeedback.retryCount}
        maxRetries={uploadFeedback.maxRetries}
        onClose={handleModalClose}
      />

      {/* Footer Grass Border */}
      <div className="footer-grass-wide"></div>
        <div className="footer-grass-thin"></div>
      {/* Footer Bar */}
      <footer className="footer-bar">
        <div className="footer-content">
          StewardView &bull; Developed by Aiden Cherniske &bull; 2025 &bull; <span className="no-wrap">For support: <a href="mailto:apcherniske@gmail.com">apcherniske@gmail.com</a></span>
        </div>
      </footer>
    </div>
  );
}

export default CapturePage;