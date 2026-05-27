import { Graphics, Container, Text, TextStyle, Sprite } from 'pixi.js';
import { Platform } from './Platform';
import { type PositionVector, type InputVector } from './systems/Vector';
import { AudioManager } from './managers/AudioManager';

export interface PendingInput {
  seq: number; 
  tick: number;
  mask: number;
}


export class Player extends Container {
  public readonly SPEED = 750;
  public readonly JUMP_STRENGTH = 750;
  public readonly GRAVITY = 1500;
  public readonly MAX_FALL_SPEED = 1500
  private readonly HEALTH_BAR_WIDTH = 50;
  private readonly HEALTH_BAR_HEIGHT = 5;


  private velocity: PositionVector;
  private healthBar: Graphics;
  private maxHealth: number = 100;
  private serverHealth: number = 100;
  private predictedHealth: number = 100;

  private nonBystanderColor: number = 0x7ED9F8;

  private damageFlashTimeout?: NodeJS.Timeout;
  private healthBarContainer: Container;
  private healthBarBg: Graphics;
  private platforms: Platform[] = [];
  private body: Graphics;
  private gameBounds: { left: number; right: number; top: number; bottom: number } | null = null;
  private nameText: Text;
  private inputInterval: NodeJS.Timeout | null = null;
  private lastProcessedInputVector: InputVector = { x: 0, y: 0 };
  private tomatoSprite: Sprite | null = null;

  // Invulnerability system
  private static readonly INVULNERABILITY_DURATION_MS = 3000; // Configurable
  private static readonly FLASH_START_RATIO = 0.7; // When flashing begins (70% through duration)
  private invulnerabilityStartTime: number = 0;
  private isInvulnerable: boolean = false;
  private flashInterval?: NodeJS.Timeout;

  private isBystander: boolean = true;
  private isOnSurface: boolean = false;
  private canDoubleJump = true;
  private isWalking = false;




  constructor(x: number, y: number, gameBounds: any, username: string = 'Player',) {
    super();
    this.gameBounds = gameBounds;
    this.velocity = { x: 0, y: 0 };
    this.body = new Graphics().rect(0, 0, 50, 50).fill(0x808080);
    this.body.zIndex = 1000;

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


    this.nameText = new Text({ text: username, style: nameStyle });
    this.nameText.x = this.body.width / 2; // Center the text
    this.nameText.anchor.set(0.5, 1); // Center horizontally, align bottom
    this.nameText.style.fontFamily = 'Pixel, sans-serif'; // Set font family
    this.nameText.style.fontSize = 20; // Set font size
    this.healthBarContainer.addChild(this.nameText);


    // Create health bar background
    this.healthBarBg = new Graphics()
      .rect(0, -15, this.HEALTH_BAR_WIDTH, this.HEALTH_BAR_HEIGHT)
      .fill(0x333333);
    this.healthBarContainer.addChild(this.healthBarBg);

    // Create health bara
    this.healthBar = new Graphics();
    this.updateHealthBar();
    this.healthBarContainer.addChild(this.healthBar);

    this.healthBarBg.visible = false;

    // Set pivot to bottom center for better physics alignment
    this.pivot.set(25, 50); // half width, full height

    // Start on the floor
    this.x = x;
    this.y = y;

  }

  public setIsBystander(value: boolean): void {

      if (this.isBystander === value) return; // No change
      this.isBystander = value;
      this.body.clear();
      this.body.rect(0, 0, 50, 50).fill(this.isBystander ? 0x808080 : this.nonBystanderColor);
      if (this.isBystander === false) {
        this.makeHealthBarVisible();
        this.updateHealthBar();
        this.makeTomatoSpriteVisible();
      }

  }


  private makeHealthBarVisible(): void {
    if (this.healthBarContainer) {
      this.healthBarContainer.visible = true;
      this.healthBarBg.visible = true;
      this.nameText.y = -20;
    }
  }

  private makeTomatoSpriteVisible(): void {
      this.tomatoSprite = Sprite.from('tomato');
      this.tomatoSprite.width = 30;
      this.tomatoSprite.height = 30;
      // Set anchor to center the sprite horizontally
      this.tomatoSprite.anchor.set(-0.25, -0.30);
      
      // Set z-index of the tomato sprite itself
      this.tomatoSprite.zIndex = 2000;

      this.addChild(this.tomatoSprite);
  }

  
  public getIsBystander(): boolean {
      return this.isBystander;
  }

  public getIsOnSurface(): boolean {
      return this.isOnSurface;
  }

  private updateHealthBar(): void {
      if (this.isBystander) return;

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
      if (this.isBystander) return; // Do not revert prediction for bystanders
      // Revert to server-authoritative health
      this.predictedHealth = this.serverHealth;
      this.updateHealthBar();
  }

  public getPositionVector(): PositionVector {
      return { x: this.x, y: this.y };
  }

  public getLastProcessedInputVector(): InputVector {
      return this.lastProcessedInputVector;
  }

  public setLastProcessedInputVector(inputVector: InputVector): void {
      this.lastProcessedInputVector = inputVector;
  } 
  
  
  public setPlatforms(platforms: Platform[]) {
      this.platforms = platforms;
  }

  public syncPosition(x: number, y: number, vx: number, vy: number) {
    this.x = x; // Update temporary position for physics calculations
    this.y = y; // Update temporary position for physics calculations
    this.velocity.y = vy;
    this.velocity.x = vx; // Update velocity based on server data
  }


  


  update(inputVector: InputVector, dt: number): void {

      // 1. First we update our velocity vector based on input and physics.
      // Horizontal Movement
      if (inputVector.x !== 0) {
        //inputVector.normalize();
        this.velocity.x = inputVector.x * this.SPEED;
      } else {
        this.velocity.x = 0;
      }


      // Jumping - only process jump input once per press
      if (inputVector.y < 0) {
          this.jump(inputVector);
      }

      // Gravity
      this.applyGravity(dt);

      // 2. Once the velocity is updated, we calculate the new position.
      const newX = this.x + (this.velocity.x * dt);
      const newY = this.y + (this.velocity.y * dt);

      // 3. Now we clamp the position to the game bounds.
      const { clampedX, clampedY } = this.getClampedPosition(newX, newY);
      this.x = clampedX;
      this.y = clampedY;

      if (this.y === this.gameBounds?.bottom) {
          this.resetJumpState();
      }


      // Check platform collisions
      const { isOnPlatform, platformTop } = this.checkPlatformCollisions();            
      if (isOnPlatform && platformTop !== null) {
          this.y = platformTop;
          this.resetJumpState(); // Reset jump state when landing on platform
      }

      this.isOnSurface = isOnPlatform || this.y === this.gameBounds?.bottom; // Update surface state based on platform collision

      if (this.isOnSurface && inputVector.x !== 0 && !this.isWalking) {
        this.isWalking = true;
        AudioManager.getInstance().play('walking');
      } else if (!this.isOnSurface || inputVector.x === 0) { 
        this.isWalking = false;
        AudioManager.getInstance().stop('walking');
      }
    
  
  }


  private resetJumpState(): void {
      this.canDoubleJump = true;
      this.velocity.y = 0;
      this.isOnSurface = true;
  }

  applyGravity(dt: number): void {
      this.velocity.y += this.GRAVITY * dt;
      this.velocity.y = Math.min(this.velocity.y, this.MAX_FALL_SPEED); 
  }

  jump(inputVector: InputVector): void {
    if (this.isOnSurface) {
        // First jump from ground/platform
        this.velocity.y = inputVector.y * this.JUMP_STRENGTH;
        this.canDoubleJump = true; // Enable double jump
        this.isOnSurface = false;
        AudioManager.getInstance().play('jump');
    } else if (this.canDoubleJump) {
        // Double jump in air
        this.velocity.y = inputVector.y * this.JUMP_STRENGTH;
        this.canDoubleJump = false; // Disable further jumping
        AudioManager.getInstance().play('jump');
    }
  }

  getClampedPosition(newX: number, newY: number): { clampedX: number; clampedY: number } {
      if (this.gameBounds) {
        return {
          clampedX: Math.max(this.gameBounds.left + 25, Math.min(newX, this.gameBounds.right - 25)), // 50 is the width of the player
          clampedY: Math.max(this.gameBounds.top, Math.min(newY, this.gameBounds.bottom)) // 50 is the height of the player
        }
      } else {
        return {
          clampedX: newX,
          clampedY: newY
        };
      }
  }


  checkPlatformCollisions(): { isOnPlatform: boolean; platformTop: number | null } {
      for (const platform of this.platforms) {
        const platformBounds = platform.getPlatformBounds();
        const playerBounds = this.getPlayerBounds();
        
        // Check for platform collision with tunneling prevention
        const isGoingDown = this.velocity.y > 0;
        const isOnPlatform = playerBounds.bottom === platformBounds.top;
        const isFallingThroughPlatform = playerBounds.bottom > platformBounds.top && 
          playerBounds.bottom < platformBounds.bottom;

        const isWithinPlatformWidth = playerBounds.right > platformBounds.left && 
          playerBounds.left < platformBounds.right;
        
        // Check if we're falling, were above platform last frame, and are horizontally aligned
        if (isGoingDown && isWithinPlatformWidth && (isOnPlatform || isFallingThroughPlatform)) {
            return { isOnPlatform: true, platformTop: platformBounds.top };
        }
      }
      
      return { isOnPlatform: false, platformTop: null };  
  }


  setHealth(updatedServerHealth: number): void {
      if (this.isBystander) return; // Do not update health for bystanders
      if (this.serverHealth === updatedServerHealth) return;
      
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
    
    if (this.isBystander) return; // Do not apply damage to bystanders
    this.predictedHealth = Math.max(0, this.predictedHealth - amount);
    this.updateHealthBar();

    // Flash effect
    this.body.clear();
    this.body.rect(0, 0, 50, 50).fill(0xff0000);


    this.damageFlashTimeout = setTimeout(() => {
        this.body.clear();
        this.body.rect(0, 0, 50, 50).fill('#7ED9F8');
    }, 100);
  }

  // Invulnerability system methods
  public startInvulnerability(): void {

    if (this.isBystander === true) return;

    this.isInvulnerable = true;
    this.invulnerabilityStartTime = Date.now();
    
    this.body.clear();
    this.body.rect(0, 0, 50, 50).fill(0xFFD700);
    // Set initial golden color
    
    // Clear any existing flash interval
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
    }
    
        
    // Auto-end invulnerability
    setTimeout(() => {
      this.endInvulnerability();
    }, Player.INVULNERABILITY_DURATION_MS);


    // Start flash timer for the last 30% of duration
    const flashStartTime = Player.INVULNERABILITY_DURATION_MS * Player.FLASH_START_RATIO;
    setTimeout(() => {
      this.startFlashing();
    }, flashStartTime);

  }

  private startFlashing(): void {
    let flashCount = 0;
    const baseFlashInterval = 200; // Base flash rate in ms
    
    const flash = () => {
      if (!this.isInvulnerable) return; // Stop if no longer invulnerable
      
      // Accelerating flash rate
      const timeRemaining = Player.INVULNERABILITY_DURATION_MS - (Date.now() - this.invulnerabilityStartTime);
      if (timeRemaining <= 0) return;
      
      // Faster flashing as time runs out
      const accelerationFactor = Math.max(0.1, timeRemaining / (Player.INVULNERABILITY_DURATION_MS * (1 - Player.FLASH_START_RATIO)));
      const currentFlashInterval = baseFlashInterval * accelerationFactor;
      
      // Toggle between golden and original color
      this.body.clear();
      if (flashCount % 2 === 0) {
        this.body.rect(0, 0, 50, 50).fill(this.nonBystanderColor);
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
    this.body.rect(0, 0, 50, 50).fill(this.nonBystanderColor);
    
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
    return Math.max(0, Player.INVULNERABILITY_DURATION_MS - elapsed);
  }

  destroy(): void {
    // Clear invulnerability timers
    this.endInvulnerability();

    // Clear any pending timeouts
    if (this.damageFlashTimeout) {
        clearTimeout(this.damageFlashTimeout);
    }

    if (this.inputInterval) {
        clearInterval(this.inputInterval);
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

getVelocityY() {
    return this.velocity.y;
}

getPlayerBounds() {
    return {
        left: this.x - this.pivot.x,
        right: this.x - this.pivot.x + 50, // width
        top: this.y - this.pivot.y,
        bottom: this.y - this.pivot.y + 50, // height
        width: 50,
        height: 50
    };
}

getBounds() {
  return this.body.getBounds();
}

}
