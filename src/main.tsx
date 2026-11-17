import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './content/core'; // the Core library files, before anything looks up core items
import { App } from './ui/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
