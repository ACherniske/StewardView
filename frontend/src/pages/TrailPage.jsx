import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ImageIcon, Film } from 'lucide-react';
import PlantBackground from '../components/PlantBackground';
import '../styles/TrailPage.css';

const TrailPage = () => {
    const { orgName, trailName } = useParams();
    const [images, setImages] = useState([]);
    const [gifUrl, setGifUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [gifLoading, setGifLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [activeView, setActiveView] = useState('timelapse'); // 'timelapse' or 'gallery'

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

    useEffect(() => {
        if (orgName && trailName) {
            fetchTrailImages();
            generateTimelapse();
        }
    }, [orgName, trailName]);

    const fetchTrailImages = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('Fetching images for:', orgName, trailName);
            const url = `${API_BASE_URL}/${orgName}/${trailName}`;
            console.log('Fetch URL:', url);

            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Fetch failed:', response.status, errorText);
                throw new Error(`Failed to fetch images: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Received data:', data);
            
            // Sort files by creation time (newest first) and filter images
            const imageFiles = data.files
                .filter(file => file.mimeType && file.mimeType.startsWith('image/'))
                .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

            console.log('Filtered images:', imageFiles.length);
            setImages(imageFiles);
        } catch (err) {
            console.error('Error fetching trail images:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const generateTimelapse = async () => {
        try {
            setGifLoading(true);
            
            console.log('Generating timelapse for:', orgName, trailName);

            const response = await fetch(`${API_BASE_URL}/${orgName}/generate-timelapse`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    trailNames: [trailName]
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Timelapse generation failed:', response.status, errorText);
                throw new Error(`Failed to generate timelapse: ${response.status}`);
            }

            // Convert blob to URL
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setGifUrl(url);
            console.log('Timelapse generated successfully');
        } catch (err) {
            console.error('Error generating timelapse:', err);
            // Don't set error state for timelapse failure, just log it
            // The page should still show photos even if timelapse fails
        } finally {
            setGifLoading(false);
        }
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatFileName = (fileName) => {
        // Extract readable parts from filename
        // Expected format: TrailName_YYYY-MM-DD_HH-MM-SS.ext
        const parts = fileName.split('_');
        
        if (parts.length >= 3) {
            const date = parts[1];
            const timeWithExt = parts[2];
            const time = timeWithExt.split('.')[0].replace(/-/g, ':');
            
            return `${date} at ${time}`;
        }
        
        // Fallback to filename without extension
        return fileName.replace(/\.[^/.]+$/, '');
    };

    const formatTrailName = (name) => {
        return name
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getThumbnailUrl = (fileId, size = 400) => {
        return `${API_BASE_URL}/${orgName}/${trailName}/thumbnail/${fileId}?size=${size}`;
    };

    if (loading) {
        return (
            <div className="trail-page">
                <PlantBackground className="plant-bg-layer" />
                <div className="trail-container">
                    <div className="loading">Loading trail images...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="trail-page">
                <PlantBackground className="plant-bg-layer" />
                <div className="trail-container">
                    <div className="error">Error: {error}</div>
                    <Link to={`/org/${orgName}`} className="back-button">
                        <ArrowLeft size={20} />
                        Back to Organization
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="trail-page">
            <PlantBackground className="plant-bg-layer" />
            <div className="ui-separator-overlay"></div>
            
            <div className="trail-container">
                <header className="trail-header">
                    <div className="header-actions">
                        <Link to={`/org/${orgName}`} className="back-button">
                            <ArrowLeft size={20} />
                            Back
                        </Link>
                        <Link to={`/capture/${orgName}/${trailName}`} className="capture-button">
                            Capture Photo
                        </Link>
                    </div>
                    <h1 className="trail-title">{formatTrailName(trailName)}</h1>
                    <p className="organization-name">{formatTrailName(orgName)}</p>
                </header>

                {/* View Toggle Buttons */}
                <div className="view-toggle">
                    <button 
                        className={`toggle-btn ${activeView === 'timelapse' ? 'active' : ''}`}
                        onClick={() => setActiveView('timelapse')}
                    >
                        <Film size={20} />
                        Timelapse
                    </button>
                    <button 
                        className={`toggle-btn ${activeView === 'gallery' ? 'active' : ''}`}
                        onClick={() => setActiveView('gallery')}
                    >
                        <ImageIcon size={20} />
                        Photo Gallery
                        {images.length > 0 && <span className="badge">{images.length}</span>}
                    </button>
                </div>

                {/* Timelapse Section */}
                {activeView === 'timelapse' && (
                <section className="timelapse-section">
                    <div className="section-header">
                        <Film size={24} />
                        <h2>Trail Timelapse</h2>
                    </div>
                    {gifLoading ? (
                        <div className="gif-loading">
                            <div className="loading-spinner"></div>
                            <p>Generating timelapse animation...</p>
                        </div>
                    ) : gifUrl ? (
                        <div className="gif-container">
                            <img src={gifUrl} alt="Trail Timelapse" className="timelapse-gif" />
                        </div>
                    ) : images.length === 0 ? (
                        <div className="gif-placeholder">
                            <p className="no-images-msg">No images available to create timelapse</p>
                        </div>
                    ) : (
                        <div className="gif-placeholder">
                            <p className="no-images-msg">Unable to generate timelapse at this time</p>
                            <button 
                                onClick={generateTimelapse} 
                                className="retry-btn"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                </section>
                )}

                {/* Photo Gallery Section */}
                {activeView === 'gallery' && (
                <section className="gallery-section">
                    <div className="section-header">
                        <ImageIcon size={24} />
                        <h2>Photo Gallery</h2>
                        <span className="photo-count">({images.length} photos)</span>
                    </div>
                    
                    <div className="gallery-content">
                        {images.length === 0 ? (
                            <div className="no-photos">
                                <ImageIcon size={48} className="empty-icon" />
                                <p>No photos have been uploaded to this trail yet.</p>
                                <Link to="/capture" className="capture-link">Capture First Photo</Link>
                            </div>
                        ) : (
                            <div className="photo-grid">
                                {images.map((image) => (
                                    <div 
                                        key={image.id} 
                                        className="photo-item"
                                        onClick={() => setSelectedImage(image)}
                                    >
                                        <div className="photo-thumbnail">
                                            <img 
                                                src={getThumbnailUrl(image.id, 300)} 
                                                alt={image.name}
                                                loading="lazy"
                                            />
                                            <div className="photo-overlay">
                                                <span className="photo-date-badge">
                                                    {formatFileName(image.name)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
                )}
            </div>

            {/* Image Modal */}
            {selectedImage && (
                <div className="image-modal" onClick={() => setSelectedImage(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setSelectedImage(null)}>×</button>
                        <img 
                            src={getThumbnailUrl(selectedImage.id, 1200)} 
                            alt={selectedImage.name}
                            className="modal-image"
                        />
                        <div className="modal-info">
                            <h3>{formatFileName(selectedImage.name)}</h3>
                            <p>{formatDate(selectedImage.createdTime)}</p>
                            <a 
                                href={selectedImage.webViewLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="view-full-link"
                            >
                                View in Google Drive
                            </a>
                        </div>
                    </div>
                </div>
            )}

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
};

export default TrailPage;
