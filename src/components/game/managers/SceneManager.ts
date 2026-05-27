import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { Platform } from '../Platform';
import { AmmoBush } from '../AmmoBush';
import { TvManager } from './TvManager';
import type { WorldObjects } from '../types/game.types';
import { ErrorHandler, ErrorType } from '../utils/ErrorHandler';

// Scene configuration constants
const SCENE_CONSTANTS = {
    BACKGROUND_COLORS: {
        LEFT_TOP: '#1C252A',
        BOTTOM: '#1D252A'
    },
    GRASS: {
        HEIGHT_OFFSET: 47,
        START_X: -960,
        TILE_COUNT: 8,
        Z_INDEX: 100
    },
    PARALLAX_MULTIPLIERS: {
        J1: 0.4,
        J2: 0.3,
        J3: 0.2
    },
    PLATFORM_OFFSETS: {
        SMALL: 610,
        LARGE: 115,
        Y_LEVEL_1: 250,
        Y_LEVEL_2: 500
    },
    AMMO_BUSH: {
        X_POSITION: -100
    },
    DECORATIONS: {
        BUSH_Y_OFFSET: 352,
        BUSH_X_OFFSET: -200,
        BUSH_TREE_X_OFFSET: 650,
        BUSH_TREE_Y_OFFSET: -250
    },
    DEBUG_BOUNDS_TIMEOUT: 5000
} as const;

export interface SceneConfig {
    GAME_WIDTH: number;
    GAME_HEIGHT: number;
    GAME_BOUNDS: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
}

export interface BackgroundAssets {
    j1: Sprite | null;
    j2: Sprite | null;
    j3: Sprite | null;
    j4: Sprite | null;
}

export class SceneManager {
    private static instance: SceneManager;
    
    private app: Application | null = null;
    private config: SceneConfig | null = null;
    private gameContainer: Container | null = null;
    private world: WorldObjects | null = null;
    private isInitialized: boolean = false;
    
    // Background components
    private backgroundContainer: Container | null = null;
    private grassSprites: Sprite[] = [];
    
    private constructor() {}
    
    public static getInstance(): SceneManager {
        if (!SceneManager.instance) {
            SceneManager.instance = new SceneManager();
        }
        return SceneManager.instance;
    }
    
    /**
     * Check if the scene manager has been initialized
     */
    public getIsInitialized(): boolean {
        return this.isInitialized;
    }
    
    /**
     * Initialize the scene manager
     */
    public initialize(
        app: Application, 
        config: SceneConfig, 
        gameContainer: Container, 
    ): WorldObjects {
        try {
            console.log('SceneManager: Initializing...');
            
            // Validate input parameters
            if (!app) {
                throw new Error('Application instance is required');
            }
            if (!config) {
                throw new Error('Scene configuration is required');
            }
            if (!gameContainer) {
                throw new Error('Game container is required');
            }
            
            this.app = app;
            this.config = config;
            this.gameContainer = gameContainer;
            this.isInitialized = true;
            
            // Initialize world objects
            this.world = {
                platforms: [],
                ammoBush: undefined as unknown as AmmoBush,
                backgroundAssets: {}
            };
            
            this.setupScene();
            console.log('SceneManager: Initialization complete');
            
            return this.world;
        } catch (error) {
            ErrorHandler.getInstance().handleCriticalError(
                error as Error,
                ErrorType.INITIALIZATION,
                { phase: 'initialize', component: 'SceneManager' }
            );
            throw error; // Re-throw as this is critical for game functionality
        }
    }
    
    /**
     * Ensure the scene manager is initialized before proceeding
     */
    private ensureInitialized(): void {
        if (!this.isInitialized || !this.app || !this.config || !this.gameContainer || !this.world) {
            throw new Error('SceneManager: Not initialized. Call initialize() first.');
        }
    }
    
    /**
     * Safe method to check if initialized without throwing
     */
    private isReady(): boolean {
        return this.isInitialized && 
               this.app !== null && 
               this.config !== null && 
               this.gameContainer !== null && 
               this.world !== null;
    }
    
    /**
     * Main scene setup orchestration
     */
    private setupScene(): void {
        this.ensureInitialized();        
        console.log('SceneManager: Setting up scene...');
        this.createBackground();
        this.setupParallaxBackground();
        this.createPlatforms();
        this.createAmmoBush();
        this.initializeTvManager();
    }
    
    /**
     * Create the main background elements
     */
    private createBackground(): void {
        try {
            this.ensureInitialized();
            
            this.backgroundContainer = new Container();
            
            // Create extended background areas
            const leftBgTop = new Graphics()
                .rect(-this.config!.GAME_WIDTH, this.config!.GAME_HEIGHT, this.config!.GAME_WIDTH, this.config!.GAME_HEIGHT + 500)
                .fill(SCENE_CONSTANTS.BACKGROUND_COLORS.LEFT_TOP);
            
            const bottomBg = new Graphics()
                .rect(0, this.config!.GAME_HEIGHT, this.config!.GAME_WIDTH * 2, 500)
                .fill(SCENE_CONSTANTS.BACKGROUND_COLORS.BOTTOM);
            
            this.backgroundContainer.addChild(leftBgTop);
            this.backgroundContainer.addChild(bottomBg);
            
            // Add decorative elements
            this.addDecorations(bottomBg);
            
            // Create grass ground
            this.createGrass(bottomBg);
            
            // Add background to game container
            this.gameContainer!.addChild(this.backgroundContainer);
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createBackground' }
            );
        }
    }
    
    /**
     * Helper method to safely create sprite with validation
     */
    private createSpriteFromTexture(textureName: string, context: string): Sprite | null {
        try {
            const sprite = Sprite.from(textureName);
            if (!sprite.texture || sprite.texture.width === 0 || sprite.texture.height === 0) {
                throw new Error(`Invalid or missing texture: ${textureName}`);
            }
            return sprite;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createSprite', textureName, context }
            );
            return null;
        }
    }

    /**
     * Add decorative elements to the background
     */
    private addDecorations(bottomBg: Graphics): void {
        try {
            this.ensureInitialized();
            
            // Bush decoration
            const bush = this.createSpriteFromTexture('bush', 'addDecorations');
            if (bush) {
                bush.anchor.set(1, -1);
                bush.y = bush.y + SCENE_CONSTANTS.DECORATIONS.BUSH_Y_OFFSET;
                bush.x = bush.x + SCENE_CONSTANTS.DECORATIONS.BUSH_X_OFFSET;
                bottomBg.addChild(bush);
            }
            
            // Bush tree decoration
            const bushTree = this.createSpriteFromTexture('bushTree', 'addDecorations');
            if (bushTree) {
                bushTree.anchor.set(0, 0);
                bushTree.x = this.config!.GAME_WIDTH - SCENE_CONSTANTS.DECORATIONS.BUSH_TREE_X_OFFSET;
                bushTree.y = SCENE_CONSTANTS.DECORATIONS.BUSH_TREE_Y_OFFSET;
                bottomBg.addChild(bushTree);
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'addDecorations' }
            );
        }
    }
    
    /**
     * Create grass ground tiles
     */
    private createGrass(bottomBg: Graphics): void {
        try {
            this.ensureInitialized();
            
            const grassHeight = this.config!.GAME_HEIGHT - SCENE_CONSTANTS.GRASS.HEIGHT_OFFSET;
            let grassTileWidth = 0; // Approximate width of grass tile
            const startX = SCENE_CONSTANTS.GRASS.START_X;
            const numberOfTiles = SCENE_CONSTANTS.GRASS.TILE_COUNT;
            
            this.grassSprites = [];
            
            for (let i = 0; i < numberOfTiles; i++) {
                const grass = this.createSpriteFromTexture('grassOne', 'createGrass');
                if (!grass) {
                    console.warn(`Failed to create grass tile ${i}, skipping`);
                    continue;
                }
                
                if (grassTileWidth === 0) {
                    grassTileWidth = grass.width;
                }   
                grass.anchor.set(0, 0);
                grass.zIndex = SCENE_CONSTANTS.GRASS.Z_INDEX; // Ensure grass is on top of background
                grass.x = startX + (i * grassTileWidth);
                grass.y = grassHeight;
                
                this.grassSprites.push(grass);
                bottomBg.addChild(grass);
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createGrass' }
            );
        }
    }
    
    /**
     * Setup parallax background layers
     */
    private setupParallaxBackground(): void {
        try {
            this.ensureInitialized();
            
            // Create background sprites with validation
            const j1Sprite = this.createSpriteFromTexture('j1', 'setupParallaxBackground');
            const j2Sprite = this.createSpriteFromTexture('j2', 'setupParallaxBackground');
            const j3Sprite = this.createSpriteFromTexture('j3', 'setupParallaxBackground');
            const j4Sprite = this.createSpriteFromTexture('j4', 'setupParallaxBackground');
            
            // Configure sprites if they were created successfully

            if (j4Sprite) {
                j4Sprite.x = 0;
                j4Sprite.y = 0;
                this.app!.stage.addChild(j4Sprite);
            }
            
            if (j3Sprite) {
                j3Sprite.x = 0 - this.config!.GAME_WIDTH / 2;
                j3Sprite.y = 0;
                this.app!.stage.addChild(j3Sprite);
            }
            

            if (j2Sprite) {
                j2Sprite.x = 0 - this.config!.GAME_WIDTH / 5;
                j2Sprite.y = 0;
                this.app!.stage.addChild(j2Sprite);
            }
            
            if (j1Sprite) {
                j1Sprite.x = 0 - this.config!.GAME_WIDTH / 2;
                j1Sprite.y = -270;
                this.app!.stage.addChild(j1Sprite);
            }
            
            // Store references (even if some are null)
            this.world!.backgroundAssets = {
                j1: j1Sprite,
                j2: j2Sprite,
                j3: j3Sprite,
                j4: j4Sprite,
            };
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'setupParallaxBackground' }
            );
        }
    }
    
    /**
     * Create game platforms
     */
    private createPlatforms(): void {
        try {
            this.ensureInitialized();
            
            const platformConfigs = [
                { x: SCENE_CONSTANTS.PLATFORM_OFFSETS.LARGE, y: this.config!.GAME_HEIGHT - SCENE_CONSTANTS.PLATFORM_OFFSETS.Y_LEVEL_1, type: 'two' as const },
                { x: this.config!.GAME_WIDTH - SCENE_CONSTANTS.PLATFORM_OFFSETS.SMALL, y: this.config!.GAME_HEIGHT - SCENE_CONSTANTS.PLATFORM_OFFSETS.Y_LEVEL_1, type: 'one' as const },
                { x: SCENE_CONSTANTS.PLATFORM_OFFSETS.LARGE, y: this.config!.GAME_HEIGHT - SCENE_CONSTANTS.PLATFORM_OFFSETS.Y_LEVEL_2, type: 'one' as const },
                { x: this.config!.GAME_WIDTH - SCENE_CONSTANTS.PLATFORM_OFFSETS.SMALL, y: this.config!.GAME_HEIGHT - SCENE_CONSTANTS.PLATFORM_OFFSETS.Y_LEVEL_2, type: 'two' as const },
            ];
            
            this.world!.platforms = [];
            
            for (const config of platformConfigs) {
                try {
                    const platform = new Platform(config.x, config.y, config.type);
                    this.world!.platforms.push(platform);
                    this.gameContainer!.addChild(platform);
                } catch (platformError) {
                    ErrorHandler.getInstance().handleError(
                        platformError as Error,
                        ErrorType.RENDERING,
                        { phase: 'createSinglePlatform', config }
                    );
                }
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createPlatforms' }
            );
        }
    }
    
    /**
     * Create ammo bush
     */
    private createAmmoBush(): void {
        try {
            this.ensureInitialized();
            
            this.world!.ammoBush = new AmmoBush(SCENE_CONSTANTS.AMMO_BUSH.X_POSITION, this.config!.GAME_HEIGHT);
            this.gameContainer!.addChild(this.world!.ammoBush);
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.GAME_STATE,
                { phase: 'createAmmoBush' }
            );
        }
    }
    
    /**
     * Initialize TV Manager
     */
    public initializeTvManager(): void {
        try {
            this.ensureInitialized();
            
            if (this.world!.backgroundAssets.j1) {
                TvManager.getInstance().initialize(
                    this.world!.backgroundAssets.j1, 
                    this.config!.GAME_WIDTH, 
                    this.config!.GAME_HEIGHT
                );
            } else {
                console.warn('SceneManager: Cannot initialize TvManager - j1 background asset not available');
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.INITIALIZATION,
                { phase: 'initializeTvManager' }
            );
        }
    }
    
    /**
     * Update parallax background based on camera movement
     */
    public updateParallaxBackground(offsetX: number, offsetY: number): void {
        try {
            if (!this.isReady()) {
                console.warn('SceneManager: updateParallaxBackground called before initialization');
                return;
            }
            
            // Validate input parameters
            if (typeof offsetX !== 'number' || typeof offsetY !== 'number') {
                console.warn('SceneManager: Invalid offset parameters for parallax update');
                return;
            }
            
            if (!this.world!.backgroundAssets) return;
            
            const { j1, j2, j3 } = this.world!.backgroundAssets;
            
            if (j1) {
                j1.x += offsetX * SCENE_CONSTANTS.PARALLAX_MULTIPLIERS.J1;
                j1.y += offsetY * SCENE_CONSTANTS.PARALLAX_MULTIPLIERS.J1;
            }
            
            if (j2) {
                j2.x += offsetX * SCENE_CONSTANTS.PARALLAX_MULTIPLIERS.J2;
                j2.y += offsetY * SCENE_CONSTANTS.PARALLAX_MULTIPLIERS.J2;
            }
            
            if (j3) {
                j3.x += offsetX * SCENE_CONSTANTS.PARALLAX_MULTIPLIERS.J3;
                j3.y += offsetY * SCENE_CONSTANTS.PARALLAX_MULTIPLIERS.J3;
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'updateParallaxBackground', offsetX, offsetY }
            );
        }
    }
    
    /**
     * Get all platforms for collision detection
     */
    public getPlatforms(): Platform[] {
        if (!this.isReady()) {
            console.warn('SceneManager: getPlatforms called before initialization');
            return [];
        }
        
        return this.world!.platforms;
    }
    
    /**
     * Get ammo bush reference
     */
    public getAmmoBush(): AmmoBush | null {
        if (!this.isReady()) {
            console.warn('SceneManager: getAmmoBush called before initialization');
            return null;
        }
        
        return this.world!.ammoBush;
    }
    
    /**
     * Get background assets for external manipulation
     */
    public getWorld(): WorldObjects | null {
        if (!this.isReady()) {
            console.warn('SceneManager: getWorld called before initialization');
            return null;
        }
        
        return this.world;
    }
    
    /**
     * Add custom platform at runtime
     */
    public addPlatform(x: number, y: number, type: 'one' | 'two'): Platform | null {
        try {
            if (!this.isReady()) {
                console.warn('SceneManager: addPlatform called before initialization');
                return null;
            }
            
            // Validate input parameters
            if (typeof x !== 'number' || typeof y !== 'number') {
                throw new Error('Invalid coordinates: x and y must be numbers');
            }
            
            if (isNaN(x) || isNaN(y)) {
                throw new Error('Invalid coordinates: x and y cannot be NaN');
            }
            
            if (type !== 'one' && type !== 'two') {
                throw new Error('Invalid platform type: must be "one" or "two"');
            }
            
            const platform = new Platform(x, y, type);
            this.world!.platforms.push(platform);
            this.gameContainer!.addChild(platform);
            return platform;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.VALIDATION,
                { phase: 'addPlatform', x, y, type }
            );
            return null;
        }
    }
    
    /**
     * Remove platform at runtime
     */
    public removePlatform(platform: Platform): boolean {
        if (!this.isReady()) {
            console.warn('SceneManager: removePlatform called before initialization');
            return false;
        }
        
        const index = this.world!.platforms.indexOf(platform);
        if (index !== -1) {
            this.world!.platforms.splice(index, 1);
            this.gameContainer!.removeChild(platform);
            platform.destroy();
            return true;
        }
        return false;
    }
    
    /**
     * Get scene bounds for camera calculations
     */
    public getSceneBounds(): SceneConfig['GAME_BOUNDS'] | null {
        if (!this.isReady()) {
            console.warn('SceneManager: getSceneBounds called before initialization');
            return null;
        }
        
        return this.config!.GAME_BOUNDS;
    }
    
    /**
     * Cleanup scene resources
     */
    public cleanup(): void {
        console.log('SceneManager: Cleaning up...');
        
        if (!this.isInitialized) {
            console.warn('SceneManager: cleanup called but not initialized');
            return;
        }
        
        try {
            // Clean up platforms
            if (this.world?.platforms) {
                for (const platform of this.world.platforms) {
                    if (this.gameContainer && this.gameContainer.children.includes(platform)) {
                        this.gameContainer.removeChild(platform);
                    }
                    platform.destroy();
                }
                this.world.platforms = [];
            }
            
            // Clean up ammo bush
            if (this.world?.ammoBush && this.gameContainer) {
                if (this.gameContainer.children.includes(this.world.ammoBush)) {
                    this.gameContainer.removeChild(this.world.ammoBush);
                }
                this.world.ammoBush.destroy();
            }
            
            // Clean up background assets
            if (this.world?.backgroundAssets && this.app?.stage) {
                const { j1, j2, j3, j4 } = this.world.backgroundAssets;
                [j1, j2, j3, j4].forEach(sprite => {
                    if (sprite && this.app!.stage.children.includes(sprite)) {
                        this.app!.stage.removeChild(sprite);
                        sprite.destroy();
                    }
                });
            }
            
            // Clean up grass sprites
            this.grassSprites.forEach(grass => {
                grass.destroy();
            });
            this.grassSprites = [];
            
            // Clean up background container
            if (this.backgroundContainer && this.gameContainer) {
                if (this.gameContainer.children.includes(this.backgroundContainer)) {
                    this.gameContainer.removeChild(this.backgroundContainer);
                }
                this.backgroundContainer.destroy();
                this.backgroundContainer = null;
            }
            
            // Reset world objects
            this.world = null;
            
        } catch (error) {
            console.error('SceneManager: Error during cleanup:', error);
        } finally {
            // Reset all properties
            this.app = null;
            this.config = null;
            this.gameContainer = null;
            this.isInitialized = false;
            
            console.log('SceneManager: Cleanup complete');
        }
    }
    
    
    /**
     * Debug method to visualize scene bounds
     */
    public showDebugBounds(): void {
        if (!this.isReady()) {
            console.warn('SceneManager: showDebugBounds called before initialization');
            return;
        }
        
        const debugGraphics = new Graphics()
            .rect(this.config!.GAME_BOUNDS.left, this.config!.GAME_BOUNDS.top, 
                  this.config!.GAME_BOUNDS.right - this.config!.GAME_BOUNDS.left,
                  this.config!.GAME_BOUNDS.bottom - this.config!.GAME_BOUNDS.top)
            .stroke({ color: 0xff0000, width: 2 });
        
        this.gameContainer!.addChild(debugGraphics);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (this.gameContainer && this.gameContainer.children.includes(debugGraphics)) {
                this.gameContainer.removeChild(debugGraphics);
                debugGraphics.destroy();
            }
        }, SCENE_CONSTANTS.DEBUG_BOUNDS_TIMEOUT);
    }
    
    /**
     * Force reset the instance (useful for testing or complete reinitialization)
     */
    public static reset(): void {
        if (SceneManager.instance) {
            SceneManager.instance.cleanup();
            SceneManager.instance = undefined as any;
        }
    }

    /**
     * Comprehensive destroy method for proper cleanup
     */
    public destroy(): void {
        try {
            
            // First cleanup all resources
            this.cleanup();
            
            // Reset static instance
            SceneManager.instance = undefined as any;
            
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.MEMORY,
                { phase: 'destroy' }
            );
        }
    }
}