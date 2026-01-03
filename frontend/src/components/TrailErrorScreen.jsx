import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, FolderX, MapPinOff } from 'lucide-react';
import '../styles/components/TrailErrorScreen.css';

const TrailErrorScreen = ({ errorType, orgName, trailName, message }) => {
    const getErrorContent = () => {
        switch (errorType) {
            case 'org-not-found':
                return {
                    icon: <FolderX size={64} />,
                    title: 'Organization Not Found',
                    description: `The organization "${formatName(orgName)}" does not exist or has been removed.`,
                    actionText: 'Back to Home',
                    actionLink: '/'
                };
            case 'trail-not-found':
                return {
                    icon: <MapPinOff size={64} />,
                    title: 'Trail Not Found',
                    description: `The trail "${formatName(trailName)}" does not exist in ${formatName(orgName)}.`,
                    actionText: 'View Organization',
                    actionLink: `/${orgName}`
                };
            case 'network-error':
                return {
                    icon: <AlertTriangle size={64} />,
                    title: 'Connection Error',
                    description: 'Unable to connect to the server. Please check your internet connection and try again.',
                    actionText: 'Back to Home',
                    actionLink: '/'
                };
            default:
                return {
                    icon: <AlertTriangle size={64} />,
                    title: 'Something Went Wrong',
                    description: message || 'An unexpected error occurred. Please try again later.',
                    actionText: 'Back to Home',
                    actionLink: '/'
                };
        }
    };

    const formatName = (name) => {
        if (!name) return '';
        return name
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const errorContent = getErrorContent();

    return (
        <div className="trail-error-screen">
            <div className="error-icon">
                {errorContent.icon}
            </div>
            <h1 className="error-title">{errorContent.title}</h1>
            <p className="error-description">{errorContent.description}</p>
            <Link to={errorContent.actionLink} className="error-action-button">
                <ArrowLeft size={20} />
                {errorContent.actionText}
            </Link>
        </div>
    );
};

export default TrailErrorScreen;
