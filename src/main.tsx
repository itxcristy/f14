import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { performanceMonitor } from "./lib/error-tracking";

// Initialize performance monitoring
performanceMonitor.measurePageLoad();

createRoot(document.getElementById("root")!).render(<App />);
