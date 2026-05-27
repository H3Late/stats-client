import { Container, Text, Graphics } from 'pixi.js';
export class FPSDisplay extends Container {
    private fpsText: Text | undefined;
    private background: Graphics | undefined;
    private frameCounter: number = 0;
    private lastUpdateTime: number = performance.now();
    private fps: number = 0;
    private updateInterval: number = 500; // Update every 500ms
    private largestWidth: number = 1920; // make dynamic;    
    
    constructor() {
        super();

        // Create background
        this.background = new Graphics()
            .rect(0, 0, 80, 30)
            .fill({
                color: 0x000000,
                alpha: 0.5
            });
            
        this.addChild(this.background);
        
        // Create text display
        this.fpsText = new Text({
            text: 'FPS: --',
            style: {
                fontFamily: 'Arial',
                fontSize: 14,
                fill: 0xffffff
            }
        });
        
        this.fpsText.position.set(5, 5);
        this.addChild(this.fpsText);
        
        // Position in top left corner
        this.x = 50 + (this.largestWidth - window.innerWidth) / 2;
        this.y = 225 // Right-aligned
    }
    
    public update(): void {
        // Count frames
        if (!this.fpsText) return;

        this.frameCounter++;
        
        const now = performance.now();
        const elapsed = now - this.lastUpdateTime;
        
        // Update every 500ms
        if (elapsed >= this.updateInterval) {
            // Calculate FPS
            this.fps = Math.round((this.frameCounter / elapsed) * 1000);
            
            // Update display
            let color = 0x00ff00;
            if (this.fps < 55) color = 0xffff00;
            if (this.fps < 30) color = 0xff0000;
            
            this.fpsText.text = `FPS: ${this.fps}`;
            this.fpsText.style.fill = color;
            
            // Reset counters
            this.frameCounter = 0;
            this.lastUpdateTime = now;
        }
    }
    
    public fixPosition(): void {
        // Position in top left corner with slight margin
        const windowWidth = window.innerWidth;
        const largestWidth = this.largestWidth;
        const offset = -(windowWidth - largestWidth) / 2;
        this.x = offset < 0 ? 50 : 50 + offset;
        this.y = 220;
    }
}