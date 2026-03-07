import { Application, Assets } from 'pixi.js';
import { GameManager } from './managers/GameManager';

import H3Logo from './images/h3-logo-gen.jpg';
import liveBanner from './images/live-banner.png';
import ian from './images/ian.png';
import dan from './images/dan.png';
import j1 from './images/j1-corrected.png';
import j2 from './images/j2.png';
import j3 from './images/j3.png';
import j4 from './images/j4.png';
import bush from './images/bush.png';
import l3l3 from './images/l3l3.png';

import bushTree from './images/bush-right.png';
import tomato from './images/tomato.png';
import ammoBush from './images/small-bush.png';
import tomatoBasket from './images/tomato-basket.png';
import platformOne from './images/platform-one.png';
import platformTwo from './images/platform-two.png';
import grassOne from './images/grass-tile-fuller.png';


import { SettingsManager } from './managers/SettingsManager';
import { BugReportManager } from './managers/BugReportManager';
import { MenuManager } from './managers/MenuManager';
import { createLoadingScreen, removeLoadingScreen, updateLoadingProgress } from './ui/Loading';

import '../../style.css';

// ── SVG icons for menu items (24x24 viewBox) ──────────────────────────
const ICONS = {
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    bug: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M6 17l-4 1M17.47 9c1.93-.2 3.53-1.9 3.53-4M18 13h4M18 17l4 1"/></svg>`,
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
} as const;

/** Holds references needed for full teardown when switching to dashboard. */
let activeApp: Application | null = null;
let activeGameManager: GameManager | null = null;

/**
 * Tear down the PixiJS game completely — stop the ticker, clean up managers,
 * remove the canvas, and destroy the PIXI application.
 */
export function destroyGame(): void {
    try {
        // Clean up game manager (handles network, entities, scene, etc.)
        if (activeGameManager) {
            // cleanupSession is private and triggered by socket close,
            // but we can trigger the same cleanup through the managers directly
            activeGameManager.cleanupSession();
            activeGameManager = null;
        }

        // Clean up UI managers
        MenuManager.getInstance().cleanup();
        SettingsManager.getInstance().destroy();
        BugReportManager.getInstance().cleanup();

        // Destroy the PixiJS application (removes canvas, stops ticker, frees GPU resources)
        if (activeApp) {
            activeApp.destroy(true, { children: true, texture: true });
            activeApp = null;
        }

        // Remove any leftover game-related DOM (loading screen, etc.)
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.remove();

    } catch (error) {
        console.error('Error during game teardown:', error);
    }
}

/**
 * Destroy the game and render the React dashboard in its place.
 */
export async function switchToDashboard(): Promise<void> {
    destroyGame();

    // Reset body overflow so the React app can scroll
    document.body.style.overflow = '';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';

    const { renderMobileApp } = await import('../MobileApp/main');
    renderMobileApp();
}

const runGame = async () => {

    console.log('Starting game...');
    // Only create game loading screen if not mobile
    createLoadingScreen();

    try {
        // Initialize SettingsManager
        updateLoadingProgress(1, 10, 'Initializing settings...');
        SettingsManager.getInstance();

                // Add assets to loader
        updateLoadingProgress(2, 10, 'Preparing assets...');
        const assetList = [
            { alias: 'j1', src: j1 },
            { alias: 'j2', src: j2 },
            { alias: 'j3', src: j3 },
            { alias: 'j4', src: j4 },
            { alias: 'tomato', src: tomato },
            { alias: 'ammoBush', src: ammoBush },
            { alias: 'platformOne', src: platformOne },
            { alias: 'platformTwo', src: platformTwo },
            { alias: 'h3Logo', src: H3Logo },
            { alias: 'liveBanner', src: liveBanner },
            { alias: 'ian', src: ian },
            { alias: 'dan', src: dan },
            { alias: 'bush', src: bush },
            { alias: 'bushTree', src: bushTree },
            { alias: 'tomatoBasket', src: tomatoBasket },
            { alias: 'grassOne', src: grassOne },
            { alias: 'l3l3', src: l3l3 },

        ];

        // Add all assets
        assetList.forEach(asset => {
            Assets.add(asset);
        });

        // Load assets with progress tracking
        let loadedCount = 0;
        
        for (const asset of assetList) {
            updateLoadingProgress(3 + loadedCount, 10, `Loading ${asset.alias}...`);
            await Assets.load(asset.alias);
            loadedCount++;
        }


        const percentage = loadedCount + 1 >= 10 ? 10 : loadedCount + 1;
        // Initialize PIXI Application
        updateLoadingProgress(percentage, 10, 'Initializing game...');
        const app = new Application();
        await app.init({ 
            background: '#202020',
        });

        activeApp = app;
    
        document.body.appendChild(app.canvas);

        // Set up hamburger menu with all actions
        const menuManager = MenuManager.getInstance();
        menuManager.addItem({
            label: 'Settings',
            icon: ICONS.settings,
            onClick: () => SettingsManager.getInstance().toggleSettingsModal(),
        });
        menuManager.addItem({
            label: 'Report Bug',
            icon: ICONS.bug,
            onClick: () => BugReportManager.getInstance().toggleBugReportModal(),
        });
        menuManager.addItem({
            label: 'Dashboard',
            icon: ICONS.dashboard,
            onClick: () => switchToDashboard(),
        });
        menuManager.createMenuUI();

        // Initialize game manager
        const gameManager = new GameManager(app);
        activeGameManager = gameManager;
        gameManager.initialize();
        
        // Complete loading
        updateLoadingProgress(10, 10, 'Ready!');
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Remove loading screen
        await removeLoadingScreen();
    } catch (error) {
        console.error('Error during game initialization:', error);
        
        // Show error on loading screen
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = 'Error loading game. Please refresh.';
            loadingText.style.color = '#ff4444';
        }
    }
};

export default runGame;