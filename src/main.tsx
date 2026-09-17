import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root')!;

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Let React paint before retiring the inline splash so the hand-off to the
// React <PGWaloLoader /> overlay is seamless (no white flash).
const finishBoot = () => (window as unknown as { __pgwaloFinishBoot?: () => void }).__pgwaloFinishBoot?.();
requestAnimationFrame(() => requestAnimationFrame(finishBoot));
