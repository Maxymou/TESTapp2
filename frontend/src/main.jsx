import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppRoutes } from './AppRoutes.jsx';
import './styles.css';
import { initViewport } from './viewport.js';

initViewport();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRoutes />
  </React.StrictMode>
);
