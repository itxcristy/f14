import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { performanceMonitor } from "./lib/error-tracking";

// Prevent zoom gestures (pinch-to-zoom, double-tap zoom) on the website
// Allow zoom only in fullscreen image viewer
let lastTouchEnd = 0;
document.addEventListener('touchstart', (e) => {
  // Allow zoom in fullscreen image viewer
  const target = e.target as HTMLElement;
  if (target.closest('[data-fullscreen-image-viewer]')) {
    return;
  }
  
  // Prevent pinch zoom
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('touchend', (e) => {
  // Allow zoom in fullscreen image viewer
  const target = e.target as HTMLElement;
  if (target.closest('[data-fullscreen-image-viewer]')) {
    return;
  }
  
  // Prevent double-tap zoom
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// Prevent wheel zoom with Ctrl/Cmd key (except in fullscreen image viewer)
document.addEventListener('wheel', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('[data-fullscreen-image-viewer]')) {
    return;
  }
  
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
  }
}, { passive: false });

// Initialize performance monitoring
performanceMonitor.measurePageLoad();

createRoot(document.getElementById("root")!).render(<App />);
