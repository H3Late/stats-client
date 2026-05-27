import { Application, Container } from "pixi.js";
import type { PlayerData } from "../types/game.types";
import { SceneManager } from "./SceneManager";

export interface CameraSettings {
    lerpFactor: number;
    currentX: number;
    currentY: number;
    // Add shake properties
    shakeIntensity: number;
    shakeDuration: number;
    shakeElapsed: number;
    baseX: number; // Store the non-shaken position
    baseY: number; // Store the non-shaken position
}

export class CameraManager {
    private static instance: CameraManager;
    private app: Application | undefined;

    private cameraContainer = new Container();
    private GAME_WIDTH!: number;
    private GAME_HEIGHT!: number;
    private GAME_BOUNDS!: any;
    private cameraSettings: CameraSettings = {
        lerpFactor: 0.1,
        currentX: 0,
        currentY: 0,
        shakeIntensity: 0,
        shakeDuration: 0,
        shakeElapsed: 0,
        baseX: 0,
        baseY: 0
    };

    private constructor() {}

    public static getInstance(): CameraManager {
    if (!CameraManager.instance) {
        CameraManager.instance = new CameraManager();
    }
        return CameraManager.instance;
    }

    public initialize(app: Application, gameContainer: Container, GAME_WIDTH: number, GAME_HEIGHT: number, GAME_BOUNDS: any): void {
        this.app = app
        this.cameraContainer.addChild(gameContainer);
        this.GAME_WIDTH = GAME_WIDTH;
        this.GAME_HEIGHT = GAME_HEIGHT;
        this.GAME_BOUNDS = GAME_BOUNDS;
    }

    public getCamera(): Container {
        return this.cameraContainer;
    }

    public updateCameraPositionLERP(player: PlayerData): void {
        if (!player.sprite) return;
        // Calculate target camera position (centered on player)
        const targetX = -player.sprite.x + this.GAME_WIDTH / 2;
        const targetY = -player.sprite.y + (this.GAME_HEIGHT / 2);


        // Calculate responsive offsets based on screen size
        const screenHeight = window.innerHeight;

        // Calculate scale ratio between game resolution and actual screen
        const scaleY = screenHeight / this.GAME_HEIGHT;

        // Clamp camera position to stay within bounds + buffer
        const minX = -(this.GAME_BOUNDS.right + 5000) + this.GAME_WIDTH;
        const maxX = this.GAME_BOUNDS.left + 5000;
        const minY = -(150 / scaleY);

        const maxY = this.GAME_BOUNDS.top + 250;
        // Apply clamping to target position
        const clampedTargetX = Math.max(minX, Math.min(maxX, targetX));
        const clampedTargetY = Math.max(minY, Math.min(maxY, targetY));

        // Initialize camera position if not set
        if (this.cameraSettings.currentX === 0 && this.cameraSettings.currentY === 0) {
            this.cameraSettings.currentX = clampedTargetX;
            this.cameraSettings.currentY = clampedTargetY;
        }

        // Smoothly interpolate between current position and target position
        this.cameraSettings.currentX += (clampedTargetX - this.cameraSettings.currentX) * this.cameraSettings.lerpFactor;
        this.cameraSettings.currentY += (clampedTargetY - this.cameraSettings.currentY) * this.cameraSettings.lerpFactor;

            
        // Store the base (non-shaken) camera position
        this.cameraSettings.baseX = this.cameraSettings.currentX;
        this.cameraSettings.baseY = this.cameraSettings.currentY;

        const xOffset = this.cameraSettings.currentX - this.cameraContainer.x;
        const yOffset = this.cameraSettings.currentY - this.cameraContainer.y;

        // Apply the smoothed camera position
        this.cameraContainer.x = this.cameraSettings.currentX;
        this.cameraContainer.y = this.cameraSettings.currentY;

        SceneManager.getInstance().updateParallaxBackground(xOffset, yOffset);
    }


    public convertCameraToWorldCoordinates(x: number, y: number): { x: number, y: number } {
        // Get the canvas element and its bounding rect

        if (!this.app) {
            throw new Error("CameraManager: Application not initialized.");
        }

        const canvas = this.app.canvas as HTMLCanvasElement;
        const canvasRect = canvas.getBoundingClientRect();
        
        // 1. Convert mouse position to canvas-relative coordinates
        const canvasX = x - canvasRect.left;
        const canvasY = y - canvasRect.top;
        
        // 2. Calculate the scale ratio between the canvas display size and its internal size
        const scaleRatioX = canvas.width / canvasRect.width;
        const scaleRatioY = canvas.height / canvasRect.height;
        
        // 3. Scale the coordinates to the internal canvas coordinate system
        const rendererX = canvasX * scaleRatioX;
        const rendererY = canvasY * scaleRatioY;
        
        // 4. Convert to world coordinates by subtracting camera offset
        const worldX = rendererX - this.cameraContainer.x;
        const worldY = rendererY - this.cameraContainer.y;

        return {
            x: worldX,
            y: worldY
        }
    }
  
}
