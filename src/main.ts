import './style.css';
import runGame from './components/game/main';

const isMobile = () => window.matchMedia('(any-hover:none)').matches;

const wantsDashboard = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'data';
};

(async () => {
    if (isMobile() || wantsDashboard()) {
        // Render the React dashboard and exit early
        const { renderMobileApp } = await import('./components/MobileApp/main');
        renderMobileApp();
        return;
    }

    runGame();
})();