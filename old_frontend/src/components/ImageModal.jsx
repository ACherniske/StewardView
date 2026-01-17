import '../styles/modals/ImageModal.css';

const ImageModal = ({ 
    image, 
    onClose, 
    getThumbnailUrl, 
    formatFileName, 
    formatDate 
}) => {
    if (!image) return null;

    return (
        <div className="image-modal-overlay" onClick={onClose}>
            <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="image-modal-close" onClick={onClose} aria-label="Close modal">
                    ×
                </button>
                
                <div className="image-modal-image-container">
                    <img 
                        src={getThumbnailUrl(image.id, 1200)} 
                        alt={image.name}
                        className="image-modal-image"
                    />
                </div>
                
                <div className="image-modal-info">
                    <h3 className="image-modal-title">{formatFileName(image.name)}</h3>
                    <p className="image-modal-date">{formatDate(image.createdTime)}</p>
                </div>
            </div>
        </div>
    );
};

export default ImageModal;
