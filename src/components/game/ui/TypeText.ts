import { Text } from 'pixi.js';

export interface TypeWriterOptions {
    text: string;
    style?: any; // PIXI TextStyle
    typingSpeed?: number; // milliseconds per character
    blinkSpeed?: number; // milliseconds for cursor blink
    pauseOnDots?: boolean; // pause after 3 dots
    pauseDuration?: number; // milliseconds to pause after 3 dots
    cursor?: string; // cursor character
}

export class TypeText {
    private textObject: Text;
    private fullText: string;
    private currentText: string = '';
    private typingSpeed: number;
    private blinkSpeed: number;
    private pauseOnDots: boolean;
    private pauseDuration: number;
    private cursor: string;
    
    // Intervals
    private typeInterval: NodeJS.Timeout | null = null;
    private blinkInterval: NodeJS.Timeout | null = null;

    // State tracking
    private index: number = 0;
    private dotCount: number = 0;
    private isPaused: boolean = false;
    private isTyping: boolean = false;
    private typingComplete: boolean = false;
    
    // Promise resolvers
    private typeResolve: ((value: void) => void) | null = null;

    constructor(options: TypeWriterOptions) {
        this.fullText = options.text;
        this.typingSpeed = options.typingSpeed || 75;
        this.blinkSpeed = options.blinkSpeed || 400;
        this.pauseOnDots = options.pauseOnDots ?? true;
        this.pauseDuration = options.pauseDuration || 2000;
        this.cursor = options.cursor || '|';
        
        // Create the PIXI Text object
        this.textObject = new Text({
            text: this.currentText, // Start with just the cursor
            style: options.style || {
                fontFamily: '"Pixel", Arial, sans-serif',
                fontSize: 32,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 500
            }
        });
                
    }
    
    /**
     * Get the underlying PIXI Text object
     */
    public get text(): Text {
        return this.textObject;
    }
    
    /**
     * Set the position of the text
     */
    public setPosition(x: number, y: number): void {
        this.textObject.x = x;
        this.textObject.y = y;
    }
    
    /**
     * Set the anchor of the text
     */
    public setAnchor(x: number, y: number): void {
        this.textObject.anchor.set(x, y);
    }
    
    /**
     * Start the typewriter effect
     * Returns a promise that resolves when typing is complete
     */
    public async type(delay?: number): Promise<void> {
        if (this.isTyping) {
            console.warn('TypeWriter: Already typing');
            return;
        }
        
        if (delay) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.isTyping = true;
        this.typingComplete = false;
        this.index = 0;
        this.dotCount = 0;
        this.isPaused = false;
        this.currentText = this.cursor; // Reset to just cursor
        this.textObject.text = this.currentText;
        
        // Start cursor blinking
        this.startCursorBlink();

        // Create promise for type completion
        return new Promise<void>((resolve) => {
            this.typeResolve = resolve;
            this.startTyping();
        });
    }
    
    /**
     * Stop the cursor blinking and remove cursor
     */
    public killCursor(): void {
        this.stopCursorBlink();
        
        // Remove cursor from text if present
        if (this.currentText.endsWith(this.cursor)) {
            this.currentText = this.currentText.slice(0, -1);
            this.textObject.text = this.currentText;
        }
    }
    
    /**
     * Check if typing is complete
     */
    public isComplete(): boolean {
        return this.typingComplete;
    }
    
    /**
     * Check if currently typing
     */
    public isCurrentlyTyping(): boolean {
        return this.isTyping;
    }
    
    /**
     * Get current progress (0-1)
     */
    public getProgress(): number {
        return this.fullText.length > 0 ? this.index / this.fullText.length : 1;
    }
    
    /**
     * Force complete the typing effect
     */
    public forceComplete(): void {
        this.stopTyping();
        this.currentText = this.fullText + this.cursor;
        this.textObject.text = this.currentText;
        this.typingComplete = true;
        this.isTyping = false;
        
        if (this.typeResolve) {
            this.typeResolve();
            this.typeResolve = null;
        }
    }
    
    /**
     * Clean up typing interval only
     */
    public cleanupTyping(): void {
        this.stopTyping();
    }

    /**
     * Clean up cursor interval only
     */
    public cleanupCursor(): void {
        this.stopCursorBlink();
    }
    
    /**
     * Clean up everything - intervals and text object
     */
    public destroy(): void {
        
        // Stop all intervals first
        this.stopCursorBlink();
        this.stopTyping();
        
        // Cancel any pending promises
        if (this.typeResolve) {
            this.typeResolve();
            this.typeResolve = null;
        }
        
        // Reset state
        this.isTyping = false;
        this.typingComplete = true;
        
        // Destroy the text object if it exists and hasn't been destroyed
        if (this.textObject && !this.textObject.destroyed) {
            this.textObject.destroy();
        }
    }
    
    /**
     * Start the typing animation
     */
    private startTyping(): void {
        this.typeInterval = setInterval(() => {
            if (this.isPaused) {
                // If paused, just return
                return;
            }
            if (this.index < this.fullText.length) {
                // Remove cursor, add new character, add cursor back
                this.currentText = this.currentText.slice(0, -1); // Remove cursor
                this.currentText += this.fullText[this.index]; // Add new character
                this.currentText += this.cursor; // Add cursor back
                this.textObject.text = this.currentText;
                
                // Handle pause on dots
                if (this.pauseOnDots && this.fullText[this.index] === '.') {
                    this.dotCount++;
                    if (this.dotCount === 3) {
                        this.isPaused = true;
                        setTimeout(() => {
                            this.isPaused = false;
                            this.dotCount = 0;
                        }, this.pauseDuration);
                    }
                }
                
                this.index++;
            } else if (this.index >= this.fullText.length ) {
                // Typing complete
                this.stopTyping();
                this.typingComplete = true;
                this.isTyping = false;
                
                if (this.typeResolve) {
                    this.typeResolve();
                    this.typeResolve = null;
                }
            }
        }, this.typingSpeed);
    }
    
    /**
     * Stop the typing animation
     */
    private stopTyping(): void {
        if (this.typeInterval) {
            clearInterval(this.typeInterval);
            this.typeInterval = null;
        }
    }
    
    /**
     * Start cursor blinking
     */
    private startCursorBlink(): void {
        this.blinkInterval = setInterval(() => {
            // Check if the text object still exists and hasn't been destroyed
            if (!this.textObject || this.textObject.destroyed || !this.textObject.text) {
                if (this.blinkInterval) {
                    clearInterval(this.blinkInterval);
                    this.blinkInterval = null;
                }
                return;
            }
            const isCursorVisible = this.textObject.text.endsWith(this.cursor);
            // Instead of removing cursor, replace with space to maintain consistent width
            if (isCursorVisible) {
                // Replace cursor with space
                this.textObject.text = this.textObject.text.slice(0, -1) + ' ';
            } else {
                // Remove space and add cursor back
                this.textObject.text = this.textObject.text.slice(0, -1) + this.cursor;
            }

            
        }, this.blinkSpeed);
    }
    
    /**
     * Stop cursor blinking
     */
    private stopCursorBlink(): void {
        if (this.blinkInterval) {
            clearInterval(this.blinkInterval);
            this.blinkInterval = null;
        }
    }

    /**
     * Update the full text (useful for dynamic content)
     */
    public updateText(newText: string): void {
        this.fullText = newText;
        // Reset if not currently typing
        if (!this.isTyping) {
            this.index = 0;
            this.currentText = this.cursor;
            this.textObject.text = this.currentText;
            this.typingComplete = false;
        }
    }
}