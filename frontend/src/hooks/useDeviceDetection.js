import { useState, useEffect } from 'react';

/** 
 * Hook to detect device type and capabilities
 * @returns {Object} - device info
*/

export const useDeviceDetection = () => {
    const [deviceInfo, setDeviceInfo] = useState({
        isMobile: false,
        isTablet: false,
        isDesktop: false,
        hasCamera: false,
        os: 'unknown',
        browser: 'unknown',
    });

    useEffect(() => {
        const detectDevice = () => {
            const ua = navigator.userAgent;

            //detect mobile devices
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

            //detect tablet devices
            const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua);

            //desktop (everything else)
            const isDesktop = !isMobile && !isTablet;

            //camera capable?
            const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

            //detect OS
            let os = 'unknown';
            if (/Android/i.test(ua)) os = 'Android';
            else if (/iPhone|iPad|iPod/i.test(ua)) os = 'ios';
            else if (/Win/i.test(ua)) os = 'windows';
            else if (/Mac/i.test(ua)) os = 'macos';
            else if (/Linux/i.test(ua)) os = 'linux';

            //detect browser
            let browser = 'unknown';
            if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = 'Chrome';
            else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
            else if (/Firefox/i.test(ua)) browser = 'Firefox';
            else if (/Edge/i.test(ua)) browser = 'Edge';

            setDeviceInfo({ isMobile, isTablet, isDesktop, hasCamera, os, browser });
        };

        detectDevice();

        //recheck on window resize (for responsive testing)
        window.addEventListener('resize', detectDevice);

        return () => window.removeEventListener('resize', detectDevice);
    }, []);

    return deviceInfo;
};