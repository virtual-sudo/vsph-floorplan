import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import './styles.css';
import { App } from './App';

// three.js r186 flags THREE.Clock as deprecated, and React Three Fiber 9 still creates one; hide that one notice
const warn = console.warn.bind(console);
console.warn = (...a: unknown[]) => { if (typeof a[0] === 'string' && a[0].startsWith('THREE.Clock: This module has been deprecated')) return; warn(...a); };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
