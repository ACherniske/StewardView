    import { useEffect } from "react";
    import '../styles/UploadModal.css';
    import { Hourglass, CircleCheck, CircleAlert, RotateCw, Info } from "lucide-react";


    function UploadModal({ show, status, message, retryCount, maxRetries, onClose}) {
        //autoclose success messages

        useEffect(() => {
            if (show && status === 'success') {
                const timer = setTimeout(() => {
                    onClose();
                }, 3000);

                return () => clearTimeout(timer);
            }
        }, [show, status, onClose]);

        if (!show) return null;

        const getStatusIcon = () => {
            switch (status) {
                case 'uploading':
                    return <Hourglass />;
                case 'success':
                    return <CircleCheck />;
                case 'failed':
                    return <CircleAlert />;
                case 'retrying':
                    return <RotateCw />;
                default:
                    return <Info />;
            }
        };

        const getStatusClass = () => {
            switch (status) {
                case 'uploading':
                    return 'status-uploading';
                case 'success':
                    return 'status-success';
                case 'failed':
                    return 'status-failed';
                case 'retrying':
                    return 'status-retrying';
                default:
                    return '';
            }
        };

    return (
        <div className="modal-overlay" onClick={onClose}>
        <div 
            className={`modal-content ${getStatusClass()}`}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="modal-icon">
                {getStatusIcon()}
            </div>
            
            <div className="modal-message">
            <h3 className="modal-title">
                {status === 'uploading' && 'Uploading...'}
                {status === 'success' && 'Success!'}
                {status === 'failed' && 'Upload Failed'}
                {status === 'retrying' && 'Retrying...'}
            </h3>
            <p className="modal-text">{message}</p>
            </div>

            {status === 'retrying' && (
            <div className="retry-progress">
                <div className="retry-bar">
                <div 
                    className="retry-bar-fill"
                    style={{ width: `${(retryCount / maxRetries) * 100}%` }}
                ></div>
                </div>
                <p className="retry-text">
                Attempt {retryCount} of {maxRetries}
                </p>
            </div>
            )}

            {status === 'uploading' && (
            <div className="loading-spinner">
                <div className="spinner"></div>
            </div>
            )}

            {(status === 'failed' || status === 'success') && (
            <button className="btn btn-modal" onClick={onClose}>
                Close
            </button>
            )}
        </div>
        </div>
    );
    }

    export default UploadModal;