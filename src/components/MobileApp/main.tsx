import { createRoot } from 'react-dom/client';
import App from './App';
import "./index.css";

export const renderMobileApp = (): void => {
    const container = document.getElementById('root');
    if (!container) {
        console.error('Root container not found');
        return;
    }
    
    const root = createRoot(container);
    root.render(<App />);
};