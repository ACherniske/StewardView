import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import TrailCapturePage from './pages/TrailCapturePage.jsx';
import TimelapseViewerPage from './pages/TimelapseViewerPage.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {
        /* Home Path 
         * Org Path (optional) (display org-specific info and trail timelapses)
         * Trail Path (view gifs and trail info)
         * Trail Upload Path (capture/upload photos)
         */
        }

        <Route path="/" element={<App />} />
        <Route path="/:orgName" element={<App />} />
        <Route path="/:orgName/:trailName" element={<TimelapseViewerPage />} />
        <Route path="/:orgName/:trailName/upload" element={<TrailCapturePage />} />

      </Routes>
    </BrowserRouter>
  </StrictMode>
);