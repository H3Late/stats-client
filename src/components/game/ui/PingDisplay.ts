import { Container, Text, Graphics } from 'pixi.js';
export class PingDisplay extends Container {
    private pingText: Text | undefined;
    private background: Graphics | undefined;
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
        this.pingText = new Text({
            text: 'Ping: --ms',
            style: {
                fontFamily: 'Arial',
                fontSize: 14,
                fill: 0xffffff
            }
        });
        
        this.pingText.position.set(5, 5);
        this.addChild(this.pingText);
        
        // Position in top right corner (will be adjusted in fixPosition)
        this.x = 50 + (this.largestWidth - window.innerWidth) / 2;
        this.y = 250 // Right-aligned
      
    }
    
    public updatePing(ping: number): void {
        if (!this.pingText) return;
        // Update text color based on ping quality
        let color = 0x00ff00; // Green for good ping
        if (ping > 100) color = 0xffff00; // Yellow for medium ping
        if (ping > 200) color = 0xff0000; // Red for bad ping
        
        this.pingText.text = `Ping: ${ping}ms`;
        this.pingText.style.fill = color;
    }
    
    public fixPosition(): void {
        // Position in top left corner with slight margin
        const windowWidth = window.innerWidth;
        const largestWidth = this.largestWidth;
        const offset = -(windowWidth - largestWidth) / 2;
        this.x = offset < 0 ? 50 : 50 + offset;
        this.y = 250;
    }
    
    destroy(): void {
        super.destroy();
        if (this.pingText) this.pingText.destroy();
        if (this.background) this.background.destroy();
    }
}