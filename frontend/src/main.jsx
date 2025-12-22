import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import TrailCapturePage from './pages/TrailCapturePage.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/:orgName/:trailName" element={<TrailCapturePage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);