import { Graphics, Container, TextStyle, Text, Sprite } from 'pixi.js';
import type { PositionVector } from './systems/Vector';
import { NetworkManager } from './managers/NetworkManager';
import lerp from './utils/utils';

export interface EnemyPosition extends PositionVector {
    timestamp: number;
};


export class EnemyPlayer extends Container {
  private readonly INTERPOLATION_DELAY = 50; // milliseconds - reduced from 100ms
  private id: string;
  private body: Graphics;
  private healthBar: Graphics;
  private maxHealth: number = 100;
  private serverHealth: number = 100;
  private predictedHealth: number = 100;
  private readonly HEALTH_BAR_WIDTH = 50;
  private readonly HEALTH_BAR_HEIGHT = 5;
  private damageFlashTimeout?: NodeJS.Timeout;
  private healthBarContainer: Container;
  private isBystander: boolean;
  private nameText: Text;
  private tomatoSprite: Sprite | null = null;
  private onSpawn: (enemyPlayer: EnemyPlayer) => void;
  private isAlive: boolean = true; // Track if the enemy is currently alive
  private positionBuffer: EnemyPosition[] = [];
  public playerName: string;

  // Invulnerability system
  private static readonly INVULNERABILITY_DURATION_MS = 3000; // Configurable
  private static readonly FLASH_START_RATIO = 0.7; // When flashing begins (70% through duration)
  private invulnerabilityStartTime: number = 0;
  private isInvulnerable: boolean = false;
  private originalBodyColor: string = '#D06DFE'; // Default enemy color
  private flashInterval?: NodeJS.Timeout;

  constructor(
    id: string, 
    spawnX: number, 
    spawnY: number,
    onSpawn: (enemyPlayer: EnemyPlayer) => void,
    isBystander: boolean = true, 
    name: string = 'unknown player'
  ) {
    
    super();
    this.id = id;
    this.isBystander = isBystander;
    this.onSpawn = onSpawn;
    // Create main body
    const bodyColor = isBystander ? '#4c4c4c' : '#D06DFE';
    this.body = new Graphics().rect(0, 0, 50, 50).fill(bodyColor);
    this.addChild(this.body);

    // Create separate container for UI elements
    this.healthBarContainer = new Container();
    this.addChild(this.healthBarContainer);

        // Create name text
    const nameStyle = new TextStyle({
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0xFFFFFF,
        align: 'center'
    });

    this.playerName = name;

    this.nameText = new Text({ text: name, style: nameStyle });
    this.nameText.x = this.body.width / 2; // Center the text
    this.nameText.anchor.set(0.5, 1); // Center horizontally, align bottom
    this.nameText.y = -20; // Position above health bar
    this.healthBarContainer.addChild(this.nameText);
  
    // Create health bar background
    const healthBarBg = new Graphics()
      .rect(0, -15, this.HEALTH_BAR_WIDTH, this.HEALTH_BAR_HEIGHT)
      .fill(0x333333);
    this.healthBarContainer.addChild(healthBarBg);

    // Create health bar
    this.healthBar = new Graphics();
    this.updateHealthBar();
    this.healthBarContainer.addChild(this.healthBar);

    // Set pivot to bottom center
    this.pivot.set(25, 50);

    // Default spawn location
    this.x = spawnX;
    this.y = spawnY;

    this.onSpawn(this);
  }


  public onPositionUpdate(position: EnemyPosition): void {
    this.positionBuffer.push(position);
    if (this.positionBuffer.length > 10) { // Increased from 5 to 10
      this.positionBuffer.shift(); // Maintain a max buffer size
    }

  }
  private updateHealthBar(): void {
    this.healthBar.clear();
    const healthPercentage = this.predictedHealth / this.maxHealth;
    const barWidth = this.HEALTH_BAR_WIDTH * healthPercentage;
    
    // Health bar colors based on remaining health
    let color = 0x00ff00; // Green
    if (healthPercentage < 0.6) color = 0xffff00; // Yellow
    if (healthPercentage < 0.3) color = 0xff0000; // Red

    this.healthBar
      .rect(0, -15, barWidth, this.HEALTH_BAR_HEIGHT)
      .fill(color);
  }

  public revertPrediction(): void {
      // Revert to server-authoritative health
      this.predictedHealth = this.serverHealth;
      this.updateHealthBar();
  }

  public setIsBystander(value?: boolean): void {
      if (value === undefined || value === null) {
        return;
      }
      if (this.isBystander === value) {
        return; // No change
      }
      this.isBystander = value;

      // Change color based on bystander status
      this.body.clear();  
      this.body.rect(0, 0, 50, 50).fill(this.isBystander ? 0x808080 : '#D06DFE');

      if (this.isBystander === false) {
        this.tomatoSprite = Sprite.from('tomato');
        this.tomatoSprite.width = 30;
        this.tomatoSprite.height = 30;
        // Set anchor to center the sprite horizontally
        this.tomatoSprite.anchor.set(0, -0.5);
        
        // Set z-index of the tomato sprite itself
        this.tomatoSprite.zIndex = 10;
        this.addChild(this.tomatoSprite);
      }
  }
  
  public getIsBystander(): boolean {
      return this.isBystander;
  }


  setHealth(updatedServerHealth?: number): void {
      if (updatedServerHealth === undefined || !this.isAlive) return;
      
      this.serverHealth = updatedServerHealth;
      // Only lower predicted health if server health is lower
      // NOTE: this will likely break if health regen is introduced
      if (updatedServerHealth < this.predictedHealth) {
          this.predictedHealth = updatedServerHealth;
      }
      this.updateHealthBar();
  }

  getServerHealth(): number {
    return this.serverHealth;
  }

  getPredictedHealth(): number {
    return this.predictedHealth;
  }

  damage(amount: number = 10) {
    // Only take damage if alive
    if (!this.isAlive) return;
    
    this.predictedHealth = Math.max(0, this.predictedHealth - amount);
    this.updateHealthBar();

    // Flash effect
    this.body.clear();
    this.body.rect(0, 0, 50, 50).fill(0xff0000);

    this.damageFlashTimeout = setTimeout(() => {
      // Only restore color if still alive
      if (this.isAlive) {
        this.body.clear();
        this.body.rect(0, 0, 50, 50).fill('#D06DFE');
      }
    }, 100);
  }

  getId(): string {
    return this.id;
  }

  getBounds(skipUpdate?: boolean, bounds?: any) {
      // Only return bounds of the body if alive
      if (!this.isAlive) {
          // Return super getBounds but with zero size for dead enemies
          const emptyBounds = super.getBounds(skipUpdate, bounds);
          emptyBounds.width = 0;
          emptyBounds.height = 0;
          return emptyBounds;
      }
      return this.body.getBounds();
  }

  public isPlayerAlive(): boolean {
      return this.isAlive;
  }


  /**
   * Kill the enemy player - removes sprite from display but keeps object for reuse
   */
  public kill(): void {
    // TODO: fix issue where dead enemies are not removed from the stage...
    // when they are dead, this function is called repeatedly
      if (this.isAlive === false) return; // Already dead
      this.isAlive = false;
      if (this.parent) {
          this.parent.removeChild(this);
      }
            

      
      this.positionBuffer = [];

      // Clear any pending timeouts
      if (this.damageFlashTimeout) {
          clearTimeout(this.damageFlashTimeout);
          this.damageFlashTimeout = undefined;
      }

      // Reset health to initial state
      this.serverHealth = this.maxHealth;
      this.predictedHealth = this.maxHealth;
      
      // Hide the entire container
      this.visible = false;

  }

  /**
   * Respawn the enemy player - re-adds sprite to display and resets state
   */
  public respawn(spawnX: number, spawnY: number): void {
      // Clear position buffer and initialize with spawn position to prevent interpolation jump
      this.positionBuffer = [];
      
      this.body.clear();
      this.body.rect(0, 0, 50, 50).fill('#D06DFE');


      // Reset position
      this.x = spawnX;
      this.y = spawnY;
      this.isAlive = true;
      
      // Initialize position buffer with spawn position to prevent interpolation from old positions
      const currentTime = performance.now() + NetworkManager.getInstance().getServerTimeOffset();
      this.positionBuffer.push({
          x: spawnX,
          y: spawnY,
          timestamp: currentTime
      });
      
      // Reset health to full
      this.serverHealth = this.maxHealth;
      this.predictedHealth = this.maxHealth;
      this.updateHealthBar();
      
      // Make visible again
      this.visible = true;
      
      // Start invulnerability on respawn
      this.startInvulnerability();
      
      // Only call onSpawn if not already in a container
      if (!this.parent) {
          this.onSpawn(this);
      }
  }

  // Invulnerability system methods
  public startInvulnerability(): void {
    if (this.isInvulnerable) return; // Prevent overlapping invulnerability
    
    this.isInvulnerable = true;
    this.invulnerabilityStartTime = Date.now();
    this.body.clear();
    this.body.rect(0, 0, 50, 50).fill('#FFD700'); // Golden color
    
    // Auto-end invulnerability after duration
    setTimeout(() => {
      this.endInvulnerability();
    }, EnemyPlayer.INVULNERABILITY_DURATION_MS);
    
    // Start flashing at the configured ratio (70% through)
    const flashStartDelay = EnemyPlayer.INVULNERABILITY_DURATION_MS * EnemyPlayer.FLASH_START_RATIO;
    setTimeout(() => {
      if (this.isInvulnerable) {
        this.startFlashing();
      }
    }, flashStartDelay);
  }

  private startFlashing(): void {
    let flashCount = 0;
    const baseFlashInterval = 200; // Base flash rate in ms
    
    const flash = () => {
      if (!this.isInvulnerable) return; // Stop if no longer invulnerable
      
      // Accelerating flash rate
      const timeRemaining = EnemyPlayer.INVULNERABILITY_DURATION_MS - (Date.now() - this.invulnerabilityStartTime);
      if (timeRemaining <= 0) return;
      
      // Faster flashing as time runs out
      const accelerationFactor = Math.max(0.1, timeRemaining / (EnemyPlayer.INVULNERABILITY_DURATION_MS * (1 - EnemyPlayer.FLASH_START_RATIO)));
      const currentFlashInterval = baseFlashInterval * accelerationFactor;
      
      // Toggle between golden and original color
      this.body.clear();
      if (flashCount % 2 === 0) {
        this.body.rect(0, 0, 50, 50).fill(this.originalBodyColor);
      } else {
        this.body.rect(0, 0, 50, 50).fill('#FFD700');
      }
      flashCount++;
      
      this.flashInterval = setTimeout(flash, currentFlashInterval);
    };
    
    flash();
  }

  public endInvulnerability(): void {
    if (!this.isInvulnerable) return; // Already ended
    
    this.isInvulnerable = false;
    this.body.clear();
    this.body.rect(0, 0, 50, 50).fill(this.originalBodyColor);
    
    // Clear any ongoing flashing
    if (this.flashInterval) {
      clearTimeout(this.flashInterval);
      this.flashInterval = undefined;
    }
    
  }

  public getIsInvulnerable(): boolean {
    return this.isInvulnerable;
  }

  public getInvulnerabilityTimeRemaining(): number {
    if (!this.isInvulnerable) return 0;
    const elapsed = Date.now() - this.invulnerabilityStartTime;
    return Math.max(0, EnemyPlayer.INVULNERABILITY_DURATION_MS - elapsed);
  }
  
  destroy(): void {
    // Clean up invulnerability system
    if (this.flashInterval) {
      clearTimeout(this.flashInterval);
      this.flashInterval = undefined;
    }
    
    // Clear any pending timeouts
    if (this.damageFlashTimeout) {
        clearTimeout(this.damageFlashTimeout);
    }

    // Clean up graphics
    this.body.destroy();
    this.healthBar.destroy();
    this.nameText.destroy();
    this.healthBarContainer.destroy();

    // Call parent destroy method
    super.destroy({
        children: true,
        texture: true
    });
  }

  public getName(): string {
    return this.playerName;
  }

  public update(): void {
    if (this.isAlive === false) return;

    const currentTime = performance.now();
    const networkManager = NetworkManager.getInstance();
    const currentServerTime = currentTime + networkManager.getServerTimeOffset();
    const adaptiveDelay = this.INTERPOLATION_DELAY + (networkManager.getSmoothedJitter() * 0.5);
    const renderTime = currentServerTime - adaptiveDelay;
    const toPositionIndex = this.positionBuffer.findIndex(pos => pos.timestamp > renderTime);
    const fromPosition = this.positionBuffer[toPositionIndex - 1];
    const toPosition = this.positionBuffer[toPositionIndex];

    if (fromPosition && toPosition) {
      const t = (renderTime - fromPosition.timestamp) / (toPosition.timestamp - fromPosition.timestamp);
      this.x = lerp(fromPosition.x, toPosition.x, t);
      this.y = lerp(fromPosition.y, toPosition.y, t);
    }
  }

}