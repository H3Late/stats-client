import { Application, Container } from 'pixi.js';
import { config } from '../utils/config';
import { Player } from '../Player';
import { Controller } from '../systems/Controller';
import { NetworkManager } from './NetworkManager';
import { EnemyPlayer } from '../EnemyPlayer';
import { Projectile } from '../Projectile';
import { EnemyProjectile } from '../EnemyProjectile';
import { ErrorHandler, ErrorType } from '../utils/ErrorHandler';

import { testForAABB } from '../systems/Collision';
import { ScoreManager } from '../ui/ScoreDisplay';
import { GameOverDisplay } from '../ui/GameOverDisplay';
import { AmmoBush } from '../AmmoBush';
import { KillIndicator } from '../ui/KillIndicator';
import { PingDisplay } from '../ui/PingDisplay';
import { FPSDisplay } from '../ui/FPSDisplay';
import { Vector2, type InputVector } from '../systems/Vector';
import ObjectPool from '../systems/ObjectPool';

import { AudioManager } from './AudioManager';
import { DevModeManager } from './DevModeManager';
import { TvManager } from './TvManager';
import { BugReportManager } from './BugReportManager';
import { loginScreen, cleanupLoginScreen } from '../ui/LoginScreen';
import { SettingsManager } from './SettingsManager';
import type { InputPayload, NetworkState, PlayerScore, PlayerServerState, ProjectileServerState, ServerStateUpdate } from '../types/network.types';
import type { GameState, PlayerData, WorldObjects } from '../types/game.types';
import { SceneManager } from './SceneManager';
import { CameraManager } from './CameraManager';



interface EntityContainers {
  enemies: Map<string, EnemyPlayer>;
  enemyProjectileSprites: Map<string, EnemyProjectile>;
  killIndicatorPool: ObjectPool<KillIndicator>;
  projectilePool: ObjectPool<Projectile>;
  enemyProjectilePool: ObjectPool<EnemyProjectile>;
}
interface UIElements {
  gameOverDisplay: GameOverDisplay | null;
  pingDisplay: PingDisplay;
  fpsDisplay: FPSDisplay;
  pingUpdateCounter: number;
  overlayActive: boolean;
}


// TODO: Implement death prediction for enemies (and self) on client (with server confirmation)??
// TODO: Add powerups???
// Ideas:
//  Fat Love:
// - Defense (fat love eats all projectiles)
// - offense (fat love shoots every projectile he ate in the direction of the mouse)



export class GameManager {
    private readonly GAME_WIDTH = 1920; 
    private readonly GAME_HEIGHT = 1080;
    private readonly SERVER_TICK_RATE = 30;
    private readonly MIN_MS_BETWEEN_TICKS = 1000 / this.SERVER_TICK_RATE; 
    private readonly MIN_S_BETWEEN_TICKS = this.MIN_MS_BETWEEN_TICKS / 1000; 
    private readonly BUFFER_SIZE = 1024;
    private readonly COLLISION_TIMEOUT = 3000; 
    private readonly GAME_BOUNDS = {
        left: 0,
        right: this.GAME_WIDTH,
        top: 0,
        bottom: this.GAME_HEIGHT
    };

    private app: Application;

    private cameraManager: CameraManager = CameraManager.getInstance();
    private devManager: DevModeManager = DevModeManager.getInstance();
    private settingsManager: SettingsManager = SettingsManager.getInstance();
    private networkManager: NetworkManager = NetworkManager.getInstance();
    private bugReportManager: BugReportManager = BugReportManager.getInstance();
    private sceneManager: SceneManager = SceneManager.getInstance();
    private audioManager: AudioManager = AudioManager.getInstance();
    private scoreManager: ScoreManager;
    private onSwitchToDashboard: () => void;

    private controller: Controller;

    private gameContainer: Container;

    private player: PlayerData = {
        id: '',
        name: '',
        sprite: undefined,
        disableInput: false,
        activeProjectiles: new Set<Projectile>(),
    }

    private gameState: GameState = {
        phase: 'active',
        localTick: 0,
        accumulator: 0,
        pendingCollisions: new Map(),
    }

    
    private network: NetworkState = {
        latestServerSnapshot: {
            players: [],
            projectiles: [],
            sTick: 0,
            sTime: 0
        },
        latestServerSnapshotProcessed: {
            players: [],
            projectiles: [],
            sTick: 0,
            sTime: 0
        },
        enemyProjectileStates: new Map<string, ProjectileServerState>(),
        inputBuffer: [],
        stateBuffer: [],
    };

    private entities: EntityContainers = {
        enemies: new Map<string, EnemyPlayer>(),
        enemyProjectileSprites: new Map<string, EnemyProjectile>(),
        killIndicatorPool: undefined as any, // Will be initialized in constructor
        projectilePool: undefined as any, // Will be initialized in constructor
        enemyProjectilePool: undefined as any // Will be initialized in constructor
    };

    private world: WorldObjects = {
        platforms: [],
        ammoBush: undefined as unknown as AmmoBush, // Will be initialized in constructor
        backgroundAssets: {}
    };

    private ui: UIElements = {
        gameOverDisplay: null,
        pingDisplay: undefined as unknown as PingDisplay, // Will be initialized in constructor
        fpsDisplay: undefined as unknown as FPSDisplay,   // Will be initialized in constructor
        pingUpdateCounter: 0,
        overlayActive: false
    };
    
    constructor(app: Application, onSwitchToDashboard: () => void) {
        this.app = app;
        this.app.renderer.resize(this.GAME_WIDTH, this.GAME_HEIGHT);
        this.controller = new Controller();
        this.gameContainer = new Container();
        this.gameContainer.sortableChildren = true; // Enable z-index sorting
        this.onSwitchToDashboard = onSwitchToDashboard;
        this.scoreManager = new ScoreManager(this.showKillIndicator.bind(this));
        // Initialize ObjectPools after gameContainer is created
        this.entities.killIndicatorPool = new ObjectPool<KillIndicator>(
            () => new KillIndicator(0, 0),
            (obj: KillIndicator) => obj.reset(),
            15,
            150,
            true, // keepOnStage
            (indicator: KillIndicator) => this.gameContainer.addChild(indicator),
            (indicator: KillIndicator) => this.gameContainer.removeChild(indicator)
        );
        
        this.entities.projectilePool = new ObjectPool<Projectile>(
            () => new Projectile(-2000, -2000, 0, 0, { width: this.GAME_WIDTH, height: this.GAME_HEIGHT }, '', 30, 0.05),
            (obj: Projectile) => obj.reset(),
            50,
            500,
            true, // keepOnStage
            (projectile: Projectile) => this.gameContainer.addChild(projectile),
            (projectile: Projectile) => this.gameContainer.removeChild(projectile)

        );
        
        this.entities.enemyProjectilePool = new ObjectPool<EnemyProjectile>(
            () => new EnemyProjectile('', 'temp', -2000, -2000, 0, 0, { width: this.GAME_WIDTH, height: this.GAME_HEIGHT }),
            (obj: EnemyProjectile) => obj.reset(),
            50,
            500,
            true, // keepOnStage
            (projectile: EnemyProjectile) => this.gameContainer.addChild(projectile),
            (projectile: EnemyProjectile) => this.gameContainer.removeChild(projectile)
        );
    }
    
    public async initialize(): Promise<void> {
        this.world = this.sceneManager.initialize(
            this.app, 
            {
                GAME_WIDTH: this.GAME_WIDTH,
                GAME_HEIGHT: this.GAME_HEIGHT,
                GAME_BOUNDS: this.GAME_BOUNDS
            },
            this.gameContainer,
        );

        this.cameraManager.initialize(
            this.app,
            this.gameContainer, 
            this.GAME_WIDTH,
            this.GAME_HEIGHT,
            this.GAME_BOUNDS
        );

        this.devManager.initialize(this.app);
        this.audioManager.initialize();     

        this.settingsManager.onModalOpen(() => this.ui.overlayActive = true);
        this.settingsManager.onModalClose(() => this.ui.overlayActive = false);
        this.bugReportManager.onModalOpen(() => this.ui.overlayActive = true);
        this.bugReportManager.onModalClose(() => this.ui.overlayActive = false);


        const { name, region } = await loginScreen(this.onSwitchToDashboard);
        this.player.name = name;

        this.setupControlListeners();
        this.setupGameLoop();



        await this.initializeNetworking(region);
        this.sceneManager.initializeTvManager();
        this.app.stage.addChild(this.cameraManager.getCamera());
        this.app.stage.addChild(this.scoreManager);

        TvManager.getInstance().startTv();
    }

    private async initializeNetworking(region: string): Promise<void> {
        try {
            const networkManager = NetworkManager.getInstance();
            const matchData = await networkManager.initialize({ 
                region, playerName: this.player.name, serverUrl: config.GAME_SERVER_URL 
            });

            this.player.id = matchData.playerId;

            networkManager.on('gameOver', this.handleGameOver);
            networkManager.on('disconnect', this.handleConnectionLost);
            networkManager.on('stateUpdate', (state: ServerStateUpdate) => {
                this.integratePartialPlayerUpdates(state);
                this.integrateEnemyPositions(state);
                this.integratePartialProjectileUpdates(state);

                this.network.latestServerSnapshot.sTick = state.sTick;
                this.network.latestServerSnapshot.sTime = state.sTime;
                this.network.latestServerSnapshot.projectiles = state.projectiles;

            });

        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.NETWORK,
                { phase: 'setup' }
            );
            throw error;
        }
    }


    private integratePartialPlayerUpdates(state: ServerStateUpdate): void {
        const updatedPlayers = [];

        if (this.network.latestServerSnapshot.players.length === 0) {
            this.network.latestServerSnapshot.players = state.players;
            return;
        }

        for (const playerData of this.network.latestServerSnapshot.players) {
            const update = state.players.find(p => p.id === playerData.id);
            if (!update) {
                continue;
            }


            const updatedPlayer = {
                ...playerData,
                ...update,

            }

            updatedPlayers.push(updatedPlayer);
        }

        for (const playerData of state.players) {
            const existingPlayer = this.network.latestServerSnapshot.players.find(p => p.id === playerData.id);
            if (!existingPlayer) {
                updatedPlayers.push(playerData);
            }
        }

        this.network.latestServerSnapshot.players = updatedPlayers;
    }


    private integratePartialProjectileUpdates(state: ServerStateUpdate): void {
        for (const projectileData of state.projectiles) {
            const existingProjectile = this.network.enemyProjectileStates.get(projectileData.id);
            if (!existingProjectile && projectileData.ownerId && projectileData.ownerId !== this.player.id) {
                this.network.enemyProjectileStates.set(projectileData.id, projectileData);
            } else if (existingProjectile && projectileData.dud === true) {
                existingProjectile.dud = true;
                this.network.enemyProjectileStates.set(projectileData.id, existingProjectile);
            }
            // We dont do cleanup here because we handle that purley client side - not reliant on server
        }
    }

    private setupControlListeners(): void {
        // Add tab key event listener for spectator mode toggle
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault(); // Prevent default tab behavior (focus switching)
                this.showScoreBoard();
            } else if (e.key === 'e' || e.key === 'E') {
                this.controller.resetMouse()
                if (this.player.sprite) {
                    this.world.ammoBush.handleAmmoBushInteraction(
                        this.player.sprite,
                        () => this.networkManager.emit('toggleBystander', true)
                    );
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault(); // Prevent default tab behavior (focus switching)
                this.hideScoreBoard();
            }
        });
    }

    private handleGameOver = (scores: PlayerScore[]) => {
        try {
            this.controller.resetMouse();
            this.gameState.phase = 'ended';
            this.gameState.pendingCollisions.clear();
            this.ui.gameOverDisplay = new GameOverDisplay(scores, this.player.id);
            this.app.stage.addChild(this.ui.gameOverDisplay);
            this.networkManager.once('matchReset', this.handleMatchReset);
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.GAME_STATE,
                { event: 'gameOver', scoresCount: scores?.length || 0 }
            );
        }
    }

    private handleMatchReset = () => {
        try {
            this.audioManager.playRandomMatchStartSound();
            
            // Reset score manager to clear all scores
            this.scoreManager.reset();
            
            // Clean up active projectiles and return to pool
            for (const projectile of this.player.activeProjectiles) {
                this.entities.projectilePool.releaseElement(projectile);
            }
            this.player.activeProjectiles.clear();
            this.network.enemyProjectileStates.clear();
            
            // Clean up enemy projectiles and return to pool  
            for (const [_, projectile] of this.entities.enemyProjectileSprites) {
                this.entities.enemyProjectilePool.releaseElement(projectile);
            }
            
            this.entities.enemyProjectileSprites.clear();
            this.gameState.pendingCollisions.clear();
            if (this.ui.gameOverDisplay) {
                this.app.stage.removeChild(this.ui.gameOverDisplay);
                this.ui.gameOverDisplay.destroy();
                this.ui.gameOverDisplay = null;
            }
            this.gameState.phase = 'active';
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.GAME_STATE,
                { event: 'matchReset' }
            );
        }
    }


    private handleConnectionLost = (reason: string, _region: string) => {
        if (reason === "io server disconnect") {
            this.cleanupSession();
        }
    }




    private integrateEnemyPositions(latestServerSnapshot: ServerStateUpdate): void {
        for (const enemyPlayer of latestServerSnapshot.players) {   
            if (enemyPlayer.id === this.player.id) continue; // Skip self
            const enemyGraphic = this.entities.enemies.get(enemyPlayer.id);
            if (enemyGraphic) {
                enemyGraphic.onPositionUpdate({ 
                    x: enemyPlayer.x, 
                    y: enemyPlayer.y, 
                    timestamp: latestServerSnapshot.sTime
                });
            }
        }
    }
    private integrateStateUpdate(): void {
        const { players } = this.network.latestServerSnapshot;
        const selfData = players.find(player => player.id === this.player.id);
        this.integrateSelfUpdate(selfData);
        this.integrateProjectileUpdates();
        this.integrateEnemyPlayers();
    }
    

    private showKillIndicator(playerId: string): void {
        if (playerId === this.player.id && this.player.sprite) {
            // Player kill
            const indicator = this.entities.killIndicatorPool.getElement();
            indicator.initialize(this.player.sprite.x, this.player.sprite.y);
            this.audioManager.playRandomKillSound();

        } else {
            // Enemy kill
            const enemyGraphic = this.entities.enemies.get(playerId);
            if (enemyGraphic && enemyGraphic.isPlayerAlive() === true) {
                const indicator = this.entities.killIndicatorPool.getElement();
                indicator.initialize(enemyGraphic.x, enemyGraphic.y);
            }
        }
    }
    
    // TODO: Can we avoid calling new Set() here?
    // If called often (integrateStateUpdates) it could cause a memory issue.
    private integrateProjectileUpdates(): void {
        const { enemyProjectileSprites } = this.entities;
        for (const [_key, projectile] of this.network.enemyProjectileStates) {
            if (projectile.ownerId === this.player.id) {
                continue; // Skip own projectiles
            }
            if (enemyProjectileSprites.has(projectile.id) === false) {
                const graphic = this.entities.enemyProjectilePool.getElement();
                graphic.initialize(
                    projectile.id, 
                    projectile.ownerId, 
                    projectile.x, 
                    projectile.y, 
                    projectile.vx, 
                    projectile.vy,
                    { width: this.app.canvas.width, height: this.app.canvas.height }
                );
                enemyProjectileSprites.set(projectile.id, graphic);
            }
        }    
    }

    private cleanupPendingCollisions(): void {
        const now = Date.now();
        const { pendingCollisions } = this.gameState;

        for (const [id, collision] of pendingCollisions.entries()) {
            if (now - collision.timestamp > this.COLLISION_TIMEOUT) {
                // Get the affected entity (self or enemy)
                if (this.player.sprite && id === this.player.id) {
                    this.player.sprite.revertPrediction();
                } else {
                    const graphic = this.entities.enemies.get(id);
                    if (graphic) {
                        graphic.revertPrediction();
                    }
                }
                this.gameState.pendingCollisions.delete(id);
            }
        }
    }

    public cleanupSession = (): void => {
        try {
            this.networkManager.cleanup();
            ErrorHandler.getInstance().logWarning(
                'Socket connection closed, initiating cleanup',
                ErrorType.SOCKET,
                { playerId: this.player.id }
            );

            this.app.ticker.stop();
            const { enemyProjectileSprites, enemies } = this.entities;

            this.player.activeProjectiles.clear();
            enemyProjectileSprites.clear();

            // Since this is full session cleanup, destroy the pools completely
            // This ensures no lingering references and proper memory cleanup
            // This will also handle removing these elements from the stage. 
            this.entities.projectilePool.destroy();
            this.entities.enemyProjectilePool.destroy();
            this.entities.killIndicatorPool.destroy();
            this.gameState.pendingCollisions.clear();
            this.network.enemyProjectileStates.clear();
            // Clean up enemy players
            for (const [_, enemy] of enemies) {
                this.app.stage.removeChild(enemy);
                enemy.destroy();
            }
            enemies.clear();

            // Clean up self
            if (this.player.sprite) {
                this.app.stage.removeChild(this.player.sprite);
                this.player.sprite.destroy();
                this.player.sprite = undefined;
            }

            for (const platform of this.world.platforms) {
                this.app.stage.removeChild(platform);
                platform.destroy();
            }

            DevModeManager.getInstance().cleanup();
            BugReportManager.getInstance().cleanup();
            SceneManager.getInstance().cleanup();
            this.scoreManager.destroy();
            
            cleanupLoginScreen();
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.GAME_STATE,
                { phase: 'cleanup', playerId: this.player.id }
            );
        }
    }

    private integrateEnemyPlayers(): void {

        for (const player of this.network.latestServerSnapshot.players) {
            if (player.id === this.player.id) continue; // Skip self
            if (player.isDead === true) {
                const enemyPlayerGraphic = this.entities.enemies.get(player.id);
                if (enemyPlayerGraphic?.isPlayerAlive() === true) {
                    enemyPlayerGraphic?.kill();
                }
            }
        }
    


        // remove enemies that are no longer connected
        for (const [id, graphic] of this.entities.enemies) {
            if (this.network.latestServerSnapshot.players.some(player => player.id === id) === false) {
                graphic.destroy();
                this.removeEnemyGraphic(graphic);
                this.entities.enemies.delete(id);
            }
        }

 
        for (const enemyPlayer of this.network.latestServerSnapshot.players) {

            if (enemyPlayer.id === this.player.id) continue; // Skip self
            const enemyGraphic = this.entities.enemies.get(enemyPlayer.id);

            if (enemyGraphic === undefined || enemyGraphic === null) {
                // Spawning a new enemy player
                const graphic = new EnemyPlayer(
                    enemyPlayer.id, 
                    enemyPlayer.x, 
                    enemyPlayer.y,
                    (enemy: EnemyPlayer) => this.gameContainer.addChild(enemy),
                    enemyPlayer?.by, 
                    enemyPlayer.name
                );
                this.entities.enemies.set(enemyPlayer.id, graphic);
            } else {
                // Existing enemy player, update state
                if (enemyGraphic.isPlayerAlive() === false && enemyPlayer.isDead === false) {
                    // Respawn a player that was dead but has since respawned server side
                    enemyGraphic.respawn(
                        enemyPlayer.x, 
                        enemyPlayer.y
                    );
                } else if (enemyPlayer.isDead === false && enemyGraphic.isPlayerAlive() === true) {
                    // Enemy is alive, proceed with state update
                
                    enemyGraphic.setIsBystander(enemyPlayer.by);

                    // Check for pending collision
                    const pendingCollision = this.gameState.pendingCollisions.get(enemyPlayer.id);
                    

                    if (!pendingCollision && enemyPlayer.hp !== undefined) {
                        enemyGraphic.setHealth(enemyPlayer.hp);

                        // If server health is lower or equal (NOTE: this will likely break if health regen is introduced),
                        // than our prediction, collision was confirmed
                        if (enemyPlayer.hp && enemyPlayer.hp <= enemyGraphic.getPredictedHealth()) {
                            this.gameState.pendingCollisions.delete(enemyPlayer.id);
                            enemyGraphic.setHealth(enemyPlayer.hp);
                        }
                    } else if (pendingCollision && enemyPlayer.hp !== undefined) {
                        // There is a pending collision, do not update health yet
                        // Wait for server confirmation
                        if (enemyPlayer.hp <= pendingCollision.predictedHealthAfterHit) {
                            this.gameState.pendingCollisions.delete(enemyPlayer.id);
                            enemyGraphic.setHealth(enemyPlayer.hp);
                        }
                    }

                }
            }
        }

    }




    private removeEnemyGraphic(graphic: EnemyPlayer): void {
        this.gameContainer.removeChild(graphic);
    }


    private integrateSelfUpdate(selfData: PlayerServerState | undefined): void {

        if (selfData?.isDead === true && this.player.sprite) {
            // Clean up the players sprite if no self data exists
            this.handlePlayerDeath();
            return;
        }
        if (!selfData) return;
        if (selfData?.isDead === false && !this.player.sprite) {
            // Create new player sprite if it doesn't exist
            
            this.spawnPlayer(selfData);
        }
        if (!this.player.sprite) return;

        const bystanderStatus = selfData.by;
        this.player.sprite.setIsBystander(bystanderStatus);
        if (this.player.sprite.getIsBystander() === false && selfData.by ===  false) {
            // Only update health if we don't have a pending collision
            this.updatePlayerHealth(selfData);
        }
    }
    
    private handlePlayerDeath() {
        this.gameState.pendingCollisions.delete(this.player.id);
        if (this.player.sprite) {
            this.app.stage.removeChild(this.player.sprite);
            this.player.sprite.destroy();
            this.player.sprite = undefined;
            this.audioManager.playRandomDeathSound();
        }
        this.player.sprite = undefined;
    }

    private spawnPlayer(data: PlayerServerState): void {

        if (data.tick === undefined || data.x === undefined || data.y === undefined) {
            console.warn('Invalid player data, cannot spawn');
            return;
        }

        if (this.player.sprite) {
            console.warn('Self already exists, cannot spawn again');
            return;
        }

        // Force immediate reconciliation without resimulation.
        // This is an attempt to fix the issue where the player appears to respawn
        // in the wrong location after dying. (likely they spawn correctly but resimulate old input)
        this.gameState.localTick = data.tick;
        this.network.stateBuffer = [];
        this.network.latestServerSnapshotProcessed = {
            players: [],
            projectiles: [],
            sTick: 0,
            sTime: 0
        };


        this.player.sprite = new Player(
            data.x,
            data.y,
            this.GAME_BOUNDS,
            data.name,
        );
        

        const bystanderStatus = data.by;
        this.player.sprite.setPlatforms(this.world.platforms);
        this.player.sprite.setIsBystander(bystanderStatus);
        this.player.sprite.setLastProcessedInputVector({ x: 0, y: 0 });
        
        // Start invulnerability on spawn
        this.player.sprite.startInvulnerability();
        

        this.gameContainer.addChild(this.player.sprite);
    }

    private updatePlayerHealth(selfData: PlayerServerState): void {
        if (!this.player.sprite) return;
        const pendingCollision = this.gameState.pendingCollisions.get(this.player.id);
        if (!pendingCollision) {
            this.player.sprite.setHealth(selfData.hp);
        }
        
        // If server health is lower or equal (NOTE: this will likely break if health regen is introduced),
        // than our prediction, collision was confirmed
        if (selfData.hp <= this.player.sprite.getPredictedHealth()) {
            this.gameState.pendingCollisions.delete(this.player.id);
            this.player.sprite.setHealth(selfData.hp);
        }
    }

    // Note: The visual jittering we see when the player moves seems to be
    // caused by the game rendering slower or at the same rate as the game loop.
    // When the render rate is set higher than the game loop, the jittering is reduced.
    // For example, gameloop -> 60 FPS, render -> 120 FPS.
    // Adding a log after the accumulator loop for the player position shows
    // that high jitter corresponds to the player position not being updated...
    
    // Increasing the FPS of the game loop to 120 seems to help with this jittering.
    // as well as a high FPS of the renderer. Might need to play with these values
    // with the broadcast rate to the server in mind.
    private setupGameLoop(): void {
        try {
            this.app.ticker.maxFPS = 60;

            this.app.ticker.add((delta) => {
                try {
                    const elapsedMS = delta.elapsedMS;
                    const cappedFrameTime = Math.min(elapsedMS, 100); 

                    this.gameState.accumulator += cappedFrameTime;

                    while (this.gameState.accumulator >= this.MIN_MS_BETWEEN_TICKS) {
                        this.handleTick();
                        this.gameState.accumulator -= this.MIN_MS_BETWEEN_TICKS;
                        this.gameState.localTick += 1;
                    }

                    // Note: Pixijs calls render() at the end of the ticker loop, sod we don't
                    // need to decouple rendering from the accumulator logic.
                    this.render(elapsedMS);
                } catch (error) {
                    ErrorHandler.getInstance().handleCriticalError(
                        error as Error,
                        ErrorType.GAME_STATE,
                        { phase: 'game_loop', error: 'Critical error in game loop' }
                    );
                    
                    // Stop the game loop to prevent cascading errors
                    this.app.ticker.stop();
                }
            });
        } catch (error) {
            ErrorHandler.getInstance().handleCriticalError(
                error as Error,
                ErrorType.GAME_STATE,
                { phase: 'setup_game_loop', error: 'Failed to setup game loop' }
            );
            throw error; // Re-throw as this is critical for game functionality
        }
    }

    private handleReconciliation(): void {
        this.network.latestServerSnapshotProcessed = { ...this.network.latestServerSnapshot };
        const selfData = this.network.latestServerSnapshotProcessed.players.find(player => player.id === this.player.id);
        if (!selfData  || !this.player.sprite) {
            return;
        }

        const tick = selfData.tick; 


        let serverStateBufferIndex = tick % this.BUFFER_SIZE;
        let clientPosition = this.network.stateBuffer[serverStateBufferIndex]?.position;




        if (tick >= this.gameState.localTick) {
            // Server has marched ahead of the client...
            // As a temporary fix, we will simply sync the clint position with the server position
            this.player.sprite.syncPosition(selfData.x, selfData.y, selfData.vx, selfData.vy);
            this.network.stateBuffer[serverStateBufferIndex] = { tick: tick, position: { x: selfData.x, y: selfData.y } };
            this.gameState.localTick = tick;
            return;
        }

        // Temp fix for bug where this is undefined :()
        if (!clientPosition){
            return;
        } 


        const positionError = Vector2.subtractPositions({ x: selfData.x, y: selfData.y }, clientPosition);

        if (Vector2.len(positionError.x, positionError.y) > 0.0001) {
            this.player.sprite.syncPosition(selfData.x, selfData.y, selfData.vx, selfData.vy);
            this.network.stateBuffer[serverStateBufferIndex].position = { x: selfData.x, y: selfData.y };
            let tickToResimulate = tick + 1;
            while (tickToResimulate < this.gameState.localTick) {
                const bufferIndex = tickToResimulate % this.BUFFER_SIZE;
                const inputVector = this.network.inputBuffer[bufferIndex]?.vector;
                if (!inputVector) {
                    tickToResimulate++;
                    continue; // No input to resimulate for this tick
                }

                this.player.sprite.update(this.network.inputBuffer[bufferIndex].vector, this.MIN_S_BETWEEN_TICKS);
                this.network.stateBuffer[bufferIndex].position = this.player.sprite.getPositionVector();
                tickToResimulate++;
            }
        }
    }

    private handleTick(): void {
        try {
            
            if (this.player.sprite) {
                if (this.network.latestServerSnapshot.sTick > this.network.latestServerSnapshotProcessed.sTick) {
                    this.handleReconciliation();
                }

                this.handlePlayerInput();

                // Update camera position and UI elements
                this.cameraManager.updateCameraPositionLERP(this.player);
                this.scoreManager.fixDisplayPosition();
                DevModeManager.getInstance().fixPositions();

            }

            this.integrateStateUpdate();
            this.updateOwnProjectiles();
            this.updateEnemyProjectileSprites();
            this.cleanupPendingCollisions();
            this.entities.enemies.forEach((enemy) => {
                if (enemy.isPlayerAlive()) {
                    enemy.update();
                }
            })
            this.world.ammoBush.update(this.player.sprite);
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.GAME_STATE,
                {
                    phase: 'tick',
                    localTick: this.gameState.localTick,
                    hasPlayerSprite: !!this.player.sprite
                }
            );
            
            // Log error but don't break the game loop
            console.error('Error in handleTick:', error);
        }
    }

    private handlePlayerInput(): InputPayload | undefined {
        if (!this.player.sprite) return; // No player to control

        const controllerState = this.controller.getState();
        if (controllerState.mouse.justReleased && controllerState.mouse.xR !== undefined && controllerState.mouse.yR !== undefined) {
            const { x, y } = this.cameraManager.convertCameraToWorldCoordinates(
                controllerState.mouse.xR, 
                controllerState.mouse.yR,
            );
            controllerState.mouse.xR = x;
            controllerState.mouse.yR = y;
        }

        // Convert mouse coordinates (GameManager responsibility)

        const inputVector = Vector2.createFromControllerState(controllerState);


        if (this.player.disableInput || this.ui.overlayActive) {
            inputVector.x = 0; // Prevent input when overlay is active
            inputVector.y = 0; // Prevent input when overlay is active
            inputVector.mouse = undefined; // Prevent mouse input when overlay is active
        }
        
        if (this.player.sprite.getIsInvulnerable()) {
            inputVector.mouse = undefined; // Prevent shooting while invulnerable
        }

        this.player.disableInput = this.ui.overlayActive;
        this.controller.resetMouse();


        const inputPayload: InputPayload = {
            vector: inputVector,
            tick: this.gameState.localTick,
        }


        // TODO: Move state and input buffers to player class. 
        const bufferIndex = this.gameState.localTick % this.BUFFER_SIZE;
        this.controller.resetJump();

        this.network.inputBuffer[bufferIndex] = inputPayload;


        this.player.sprite.update(inputVector, this.MIN_S_BETWEEN_TICKS);
        const stateVector = this.player.sprite.getPositionVector();

        this.network.stateBuffer[bufferIndex] = {
            tick: this.gameState.localTick,
            position: stateVector
        };

        this.handleShooting(inputPayload);
        

        if (this.shouldBroadcastPlayerInput(inputVector)) this.broadcastPlayerInput(inputPayload);
        

        // Updating this before the line above (where we broadcast) causes reconciliation issues
        // where the client is always ahead of the server by 1-2 inputs.
        this.player.sprite.setLastProcessedInputVector(inputVector); 


        return inputPayload;
    }

    private shouldBroadcastPlayerInput(inputVector: InputVector): boolean {
        if (!this.player.sprite) return false;
        const lastProcessedInputVector = this.player.sprite.getLastProcessedInputVector();
        const justStoppedMoving = lastProcessedInputVector.x !== 0 || lastProcessedInputVector.y !== 0 // This is true when jump is pressed, but the player is not moving
            && inputVector.x === 0 && inputVector.y === 0;

        if (
            (
                this.player.sprite.y !== this.GAME_HEIGHT
                && this.player.sprite.getIsOnSurface() === false
            ) // If the player is in the air TODO: Change this to isAFk === false?
            || inputVector.x !== 0 // Has horizontal input
            || inputVector.y !== 0 // Has verical input
            || inputVector.mouse // Has mouse input
            || justStoppedMoving // Or was moving last input but stopped moving this input
        ) return true;

        return false;
    }

    // Any rendering logic not related to game objects. (FPS display, ping display, camera update, etc.)
    private render(deltaMs: number): void {
        
        this.scoreManager.updateScores(this.network.latestServerSnapshot.players, this.player.id);
        this.updateDevDisplays(deltaMs);
    }

    private broadcastPlayerInput(inputPayload: InputPayload): void {
        this.networkManager.emit('playerInput', inputPayload);
    }


    private updateDevDisplays(deltaMS: number): void {
        const devManager = DevModeManager.getInstance();
        devManager.updateFPS();
        devManager.updatePing(deltaMS, this.networkManager.getPing());
    }

    private showScoreBoard(): void {
        this.scoreManager.showDisplay();
    }

    private hideScoreBoard(): void {
        this.scoreManager.hideDisplay();
    }
    
    private handleShooting(input: InputPayload): void {
        if (
            !this.player.sprite 
            || this.player.sprite.getIsBystander() 
            || this.gameState.phase !== 'active'
            || !input.vector.mouse
            || (this.player.sprite.getIsInvulnerable() && this.player.sprite.getIsInvulnerable()) // Prevent shooting while invulnerable
        ) return;
        // Get projectile from pool instead of creating new one
        const projectile = this.entities.projectilePool.getElement();

        // Initialize the recycled projectile with new parameters
        projectile.initialize(
            this.player.sprite.x,
            this.player.sprite.y - 50,
            input.vector.mouse.x,
            input.vector.mouse.y,
            { width: this.app.canvas.width, height: this.app.canvas.height },
            input?.vector?.mouse?.id
        );

        AudioManager.getInstance().play('shoot');
        this.player.activeProjectiles.add(projectile);
    }

    private updateOwnProjectiles(): void {
        const projectilesToRemove: Projectile[] = [];
        
        for (const projectile of this.player.activeProjectiles) {
            projectile.update();
            
            // Check for collisions with enemy players
            if (this.gameState.phase === 'active') {
                for (const [enemyId, enemyGraphic] of this.entities.enemies.entries()) {
                    if (
                        enemyGraphic.isPlayerAlive() === true
                        && enemyGraphic.getIsBystander() === false 
                        && testForAABB(projectile, enemyGraphic)
                        && projectile.shouldBeDestroyed === false
                    ) {

                        // Play sound effect regardless of invulnerability
                        projectile.shouldBeDestroyed = true;

                        AudioManager.getInstance().play('impact');
                        
                        // Check if enemy is invulnerable
                        if (enemyGraphic.getIsInvulnerable && enemyGraphic.getIsInvulnerable()) {
                            // Just destroy projectile, no damage or server event
                            break;
                        }
                        this.networkManager.emit('projectileHit', { enemyId, projectileId: projectile.getId() });

  

                        // Apply predicted damage (the server will confirm or correct this after a timeout)
                        enemyGraphic.damage();
                        // Record collision prediction
                        // This is required so we can reject stateUpdates that likely haven't computed
                        // the collision yet due to network latency
                         this.gameState.pendingCollisions.set(enemyId, {
                            projectileId: projectile.getId(),
                            timestamp: Date.now(),
                            predictedHealthAfterHit: enemyGraphic.getPredictedHealth()
                        });
                        
                        // Mark projectile for cleanup
                        break; // Exit collision check loop once hit is found
                    }
                }
            }

            // Collect projectiles to be removed
            if (projectile.shouldBeDestroyed) {
                projectilesToRemove.push(projectile);
            }
        }

        // Clean up destroyed projectiles using pool
        for (const projectile of projectilesToRemove) {
            this.player.activeProjectiles.delete(projectile);
            // Release back to pool instead of destroying
            this.entities.projectilePool.releaseElement(projectile);
        }
    }

    private updateEnemyProjectileSprites(): void {
        const projectilesToRemove: EnemyProjectile[] = [];

        for (const [projectileId, projectile] of this.entities.enemyProjectileSprites.entries()) {
            projectile.update();

            if (this.gameState.phase === 'active') {
                // Check collision with self first
                if (
                    this.player.sprite 
                    && this.player.sprite.getIsBystander() === false 
                    && testForAABB(projectile, this.player.sprite)
                    && projectile.shouldBeDestroyed === false
                ) {
                    projectile.shouldBeDestroyed = true;
                    const projectileIsADud = this.network.enemyProjectileStates.get(projectileId)?.dud;
                    AudioManager.getInstance().play('impact');

                    if (this.player.sprite.getIsInvulnerable() === false && projectileIsADud === false) {
                        this.player.sprite.damage();
                        this.gameState.pendingCollisions.set(this.player.id, {
                            projectileId: projectileId,
                            timestamp: Date.now(),
                            predictedHealthAfterHit: this.player.sprite.getPredictedHealth()
                        });
                    }
                } else {
                    // Check collisions with other enemies
                    for (const [enemyId, enemyGraphic] of this.entities.enemies.entries()) {
                        if (
                            enemyId !== projectile.getOwnerId()
                            && enemyGraphic.isPlayerAlive() === true
                            && testForAABB(projectile, enemyGraphic)
                            && enemyGraphic.getIsBystander() === false
                        ) {
                            projectile.shouldBeDestroyed = true;
                            const projectileIsADud = this.network.enemyProjectileStates.get(projectileId)?.dud;
                            AudioManager.getInstance().play('impact');

                            if (enemyGraphic.getIsInvulnerable() === false || projectileIsADud === false) {
                                enemyGraphic.damage();
                                this.gameState.pendingCollisions.set(enemyId, {
                                    projectileId: projectileId,
                                    timestamp: Date.now(), 
                                    predictedHealthAfterHit: enemyGraphic.getPredictedHealth()
                                });
                            }
                            break;
                        }
                    }
                }
            }

            if (projectile.shouldBeDestroyed) {
                projectilesToRemove.push(projectile);
            }
        }


        for (const projectile of projectilesToRemove) {
            this.network.enemyProjectileStates.delete(projectile.getId());
            this.entities.enemyProjectileSprites.delete(projectile.getId());
            this.entities.enemyProjectilePool.releaseElement(projectile);
        }
    }

}
