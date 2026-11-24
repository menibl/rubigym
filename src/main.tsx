import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AppErrorBoundary} from './components/AppErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}

const currentEntryScript = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
let updateReloadStarted = false;
const reloadForNewRelease = () => {
  if (updateReloadStarted) return;
  updateReloadStarted = true;
  window.location.reload();
};

const checkForNewRelease = async () => {
  if (!currentEntryScript || document.visibilityState === 'hidden') return;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}index.html?_release=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const nextSource = parsed.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src');
    if (nextSource && new URL(nextSource, response.url).href !== currentEntryScript) reloadForNewRelease();
  } catch {
    // An offline device will retry when it becomes visible or reconnects.
  }
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'BALY_RELEASE_UPDATED') reloadForNewRelease();
  });
}
window.addEventListener('online', () => void checkForNewRelease());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void checkForNewRelease();
});
window.setInterval(() => void checkForNewRelease(), 5 * 60 * 1000);
