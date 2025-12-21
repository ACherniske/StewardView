import { useState, useEffect } from 'react';

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState({
    online: navigator.onLine,
    effectiveType: undefined
  });

  useEffect(() => {
    const updateNetworkStatus = () => {
      const connection = navigator.connection 
        || navigator.mozConnection 
        || navigator.webkitConnection;

      setNetworkStatus({
        online: navigator.onLine,
        effectiveType: connection?.effectiveType
      });
    };

    // Listen for online/offline events
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Listen for connection changes (if available)
    const connection = navigator.connection 
      || navigator.mozConnection 
      || navigator.webkitConnection;

    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    // Initial check
    updateNetworkStatus();

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, []);

  return networkStatus;
};