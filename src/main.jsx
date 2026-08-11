import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// or simply (if you omit the extension, Vite will reso // <--- REMOVE THE CURLY BRACES!

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
