import { ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const PhotoGallery = ({ 
    images, 
    onImageClick, 
    getThumbnailUrl, 
    formatFileName 
}) => {
    return (
        <section className="gallery-section">
            <div className="section-header">
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
                                onClick={() => onImageClick(image)}
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
    );
};

export default PhotoGallery;
