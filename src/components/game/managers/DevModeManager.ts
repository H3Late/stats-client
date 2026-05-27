import { SettingsManager } from './SettingsManager';
import { PingDisplay } from '../ui/PingDisplay';
import { FPSDisplay } from '../ui/FPSDisplay';
import { Application } from 'pixi.js';

export class DevModeManager {
    private static instance: DevModeManager;
    private settingsManager: SettingsManager;
    private app: Application | null = null;
    
    // Dev displays
    private pingDisplay: PingDisplay | null = null;
    private fpsDisplay: FPSDisplay | null = null;
    
    // State tracking
    private isDevModeActive: boolean = false;
    private pingUpdateCounter: number = 0;
    
    private constructor() {
        this.settingsManager = SettingsManager.getInstance();
        this.isDevModeActive = this.settingsManager.getSettings().devMode;
    
        // Listen for dev mode changes from SettingsManager
        this.settingsManager.onSettingsChange((type: string, value: any) => {
            if (type === 'Developer Mode') {
                this.handleDevModeChange(value);
            }
        });
    }
    
    public static getInstance(): DevModeManager {
        if (!DevModeManager.instance) {
            DevModeManager.instance = new DevModeManager();
        }
        return DevModeManager.instance;
    }
    
    /**
     * Initialize the DevModeManager with the PIXI application
     * Call this after the app is created but before creating displays
     */
    public initialize(app: Application): void {
        this.app = app;
        
        // Create displays if dev mode is already enabled
        if (this.isDevModeActive) {
            this.createDevDisplays();
        }
    }
    
    /**
     * Handle dev mode toggle from settings
     */
    private handleDevModeChange(enabled: boolean): void {
        this.isDevModeActive = enabled;
        
        if (enabled) {
            this.enableDevMode();
        } else {
            this.disableDevMode();
        }
    }
    
    /**
     * Enable dev mode - create and show displays
     */
    private enableDevMode(): void {
        if (!this.app) {
            console.warn('DevModeManager: App not initialized, cannot enable dev mode');
            return;
        }
        
        this.createDevDisplays();
    }
    
    /**
     * Disable dev mode - hide and destroy displays
     */
    private disableDevMode(): void {
        this.destroyDevDisplays();
    }
    
    /**
     * Create dev displays
     */
    private createDevDisplays(): void {
        if (!this.app) return;
        
        // Create FPS display if it doesn't exist
        if (!this.fpsDisplay) {
            this.fpsDisplay = new FPSDisplay();
            this.app.stage.addChild(this.fpsDisplay);
        }
        
        // Create Ping display if it doesn't exist
        if (!this.pingDisplay) {
            this.pingDisplay = new PingDisplay();
            this.app.stage.addChild(this.pingDisplay);
        }
        
        // Make sure they're visible and positioned correctly
        this.fpsDisplay.visible = true;
        this.pingDisplay.visible = true;
        this.fpsDisplay.fixPosition();
        this.pingDisplay.fixPosition();
    }
    
    /**
     * Destroy dev displays
     */
    private destroyDevDisplays(): void {
        if (this.fpsDisplay) {
            this.app?.stage.removeChild(this.fpsDisplay);
            this.fpsDisplay.destroy();
            this.fpsDisplay = null;
        }
        
        if (this.pingDisplay) {
            this.app?.stage.removeChild(this.pingDisplay);
            this.pingDisplay.destroy();
            this.pingDisplay = null;
        }
    }
    
    /**
     * Update FPS display - call this from GameManager's render loop
     */
    public updateFPS(): void {
        if (this.isDevModeActive && this.fpsDisplay) {
            this.fpsDisplay.update();
        }
    }
    
    /**
     * Update ping display - call this from GameManager's render loop
     * @param deltaMs - Time elapsed since last frame in milliseconds
     * @param ping - Current ping value
     */
    public updatePing(deltaMs: number, ping: number): void {
        if (!this.isDevModeActive || !this.pingDisplay) return;
        
        // Update ping display every ~1 second
        this.pingUpdateCounter += deltaMs;
        if (this.pingUpdateCounter >= 1000) {
            this.pingDisplay.updatePing(ping);
            this.pingUpdateCounter = 0;
        }
    }
    
    /**
     * Fix positions of all dev displays - call when camera updates
     */
    public fixPositions(): void {
        if (!this.isDevModeActive) return;
        
        if (this.fpsDisplay) {
            this.fpsDisplay.fixPosition();
        }
        
        if (this.pingDisplay) {
            this.pingDisplay.fixPosition();
        }
    }
    
    /**
     * Check if dev mode is currently active
     */
    public isActive(): boolean {
        return this.isDevModeActive;
    }
    
    /**
     * Get reference to FPS display (for advanced usage)
     */
    public getFPSDisplay(): FPSDisplay | null {
        return this.fpsDisplay;
    }
    
    /**
     * Get reference to Ping display (for advanced usage)
     */
    public getPingDisplay(): PingDisplay | null {
        return this.pingDisplay;
    }
    
    /**
     * Cleanup when game session ends
     */
    public cleanup(): void {
        this.destroyDevDisplays();
        this.pingUpdateCounter = 0;
    }
}