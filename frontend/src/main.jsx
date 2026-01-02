import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import LandingPage from './pages/LandingPage.jsx';
import CapturePage from './pages/CapturePage.jsx';
import OrganizationPage from './pages/OrganizationPage.jsx';
import TrailPage from './pages/TrailPage.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {
        /* Home Path 
         * Org Path (optional) (display org-specific info and trail timelapses)
         * Trail Path (view gifs and trail info)
         * Capture Path (capture/upload photos)
         */
        }

        <Route path="/" element={<LandingPage />} />
        <Route path="/:orgName" element={<OrganizationPage />} />
        <Route path="/:orgName/:trailName" element={<TrailPage />} />
        <Route path="/capture/:orgName/:trailName" element={<CapturePage />} />

      </Routes>
    </BrowserRouter>
  </StrictMode>
);