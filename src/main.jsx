import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.jsx' // <--- MAKE SURE THIS IS IMPORTED

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);