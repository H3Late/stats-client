import { Text, TextStyle } from 'pixi.js';

export class KillIndicator extends Text {
    private lifespan = 2000; // 3 seconds
    private elapsed = 0;
    private speed = 0.5;
    private animationID: number | null = null;

    constructor(x: number, y: number) {
        // Style for the "+1" text
        const style = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 16,
            fontWeight: 'bold',
            fill: '#00FF00',
            stroke: {
              color: '#000000',
              width: 3,
              alignment: 0.5,
            },

            align: 'center'
        });

        super({ text: "+1", style }); // Fix: Use correct constructor signature

        // Set position and anchor
        this.x = x;
        this.y = y - 80; // Start above the player
        this.anchor.set(0.5, 0.5);
        
        // Set up animation using requestAnimationFrame instead of Ticker
        this.startAnimation();
    }
    
    private startAnimation(): void {
        // Cancel any existing animation first
        if (this.animationID !== null) {
            cancelAnimationFrame(this.animationID);
            this.animationID = null;
        }
        
        let lastTime = performance.now();
        
        const animate = (currentTime: number) => {
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;
            
            // Move upward
            this.y -= this.speed;
            
            // Track elapsed time
            this.elapsed += deltaTime;
            
            // Fade out over time
            if (this.elapsed > this.lifespan / 2) {
                this.alpha = 1 - ((this.elapsed - (this.lifespan / 2)) / (this.lifespan / 2));
            }
            
            // Remove when lifetime is over - but don't destroy, just stop animation
            if (this.elapsed >= this.lifespan) {
                this.stopAnimation();
                // Signal that this indicator can be returned to pool
                // The parent system should handle this via a callback or polling
                return;
            }
            
            this.animationID = requestAnimationFrame(animate);
        };
        
        this.animationID = requestAnimationFrame(animate);
    }
    
    private stopAnimation(): void {
        if (this.animationID !== null) {
            cancelAnimationFrame(this.animationID);
            this.animationID = null;
        }
    }
    
    public isAnimationComplete(): boolean {
        return this.elapsed >= this.lifespan;
    }
    
    // Reset method for ObjectPool usage
    public reset(): KillIndicator {
        // Cancel any running animation
        this.stopAnimation();
        
        // Reset position to off-screen safe values
        this.x = -9999;
        this.y = -9999;
        
        // Reset animation state
        this.elapsed = 0;
        this.alpha = 0;
        this.visible = false;

        return this;
    }

    // Initialize method for setting up a recycled kill indicator with new parameters
    public initialize(x: number, y: number): void {
        // Set position
        this.x = x;
        this.y = y - 80; // Start above the target position
        
        // Reset visual state
        this.alpha = 1;
        this.visible = true;
        this.elapsed = 0;
        
        // Start the animation
        this.startAnimation();
    }

    destroy(): void {
        // Cancel animation frame if active
        this.stopAnimation();
        
        super.destroy({children: true, texture: true });
    }
}