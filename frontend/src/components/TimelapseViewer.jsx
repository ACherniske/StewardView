import { Film } from 'lucide-react';

const TimelapseViewer = ({ gifUrl, gifLoading, imagesCount, onRetry }) => {
    return (
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
            ) : imagesCount === 0 ? (
                <div className="gif-placeholder">
                    <p className="no-images-msg">No images available to create timelapse</p>
                </div>
            ) : (
                <div className="gif-placeholder">
                    <p className="no-images-msg">Unable to generate timelapse at this time</p>
                    <button 
                        onClick={onRetry} 
                        className="retry-btn"
                    >
                        Retry
                    </button>
                </div>
            )}
        </section>
    );
};

export default TimelapseViewer;
