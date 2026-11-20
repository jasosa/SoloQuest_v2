import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './content/core'; // the Core library files, before anything looks up core items
import { initI18n } from './i18n/runtime';

// The language is set before the screens load, so the quests are built in it.
void initI18n().then(async () => {
  const [{ App }, { FitToScreen }] = await Promise.all([
    import('./ui/App'),
    import('./ui/FitToScreen'),
  ]);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <FitToScreen>
        <App />
      </FitToScreen>
    </StrictMode>,
  );
});
