import { Howl, Howler } from 'howler';
import { SettingsManager } from './SettingsManager';

import h3Theme from '../sounds/h3-theme.mp3'
import shootingAudio from '../sounds/shoot-sound.wav';
import impactAudio from '../sounds/impact-sound.wav';
import jumpAudio from '../sounds/swipe-sound.mp3';
import walkingAudio from '../sounds/walking-grass-sound.flac';
import { ErrorHandler, ErrorType } from '../utils/ErrorHandler';

// kill sounds
import killSound1 from '../sounds/kill/erhaha.mp3';
import killSound2 from '../sounds/kill/has-laugh.mp3';
import killSound3 from '../sounds/kill/i-like-it-short.mp3';
import killSound4 from '../sounds/kill/i-like-it.mp3';
import killSound5 from '../sounds/kill/i-like-picasso.mp3';
import killSound6 from '../sounds/kill/no-pickles.mp3';
import killSound7 from '../sounds/kill/ninja-woo.mp3';

// death sounds 
import deathSound1 from '../sounds/death/bye-trump.mp3';
import deathSound2 from '../sounds/death/fuck-bowblax.mp3';
import deathSound3 from '../sounds/death/fuck-you-ab.mp3'
import deathSound4 from '../sounds/death/okayyy.mp3'
import deathSound5 from '../sounds/death/what.mp3'
import deathSound6 from '../sounds/death/wtf.mp3'

// match start sounds
import matchStartSound1 from '../sounds/match-reset/fight.mp3';
import matchStartSound2 from '../sounds/match-reset/fight-fight-fight.mp3';



type AudioCategory = 'sfx' | 'music' | 'ui' | 'ambient';

export interface SoundConfig {
    src: string[];
    volume?: number;
    loop?: boolean;
    autoplay?: boolean;
    preload?: boolean;
    sprite?: Record<string, [number, number]>;
    rate?: number;
}

interface SoundReference {
    howl: Howl;
    category: AudioCategory;
    baseVolume: number;
    id?: number;
}

export class AudioManager {
    private static instance: AudioManager;
    private sounds: Map<string, SoundReference> = new Map();
    private muted: boolean = false;
    private categoryMutes: Partial<Record<AudioCategory, boolean>> = {};
    private settingsManager: SettingsManager;
    private musicFadeTime: number = 1000;
    private currentMusic: string | null = null;
    private clearOnSettingsChangeListener: () => void;

    private deathSounds: string[] = [
        deathSound1,
        deathSound2,
        deathSound3,
        deathSound4,
        deathSound5,
        deathSound6,
    ];

    private killSounds: string[] = [
        // Add paths to kill sound files here
        killSound1,
        killSound2,
        killSound3,
        killSound4,
        killSound5,
        killSound6,
        killSound7
    ];

    private matchStartSounds: string[] = [
        matchStartSound1,
        matchStartSound2
    ];

    private constructor() {
        this.settingsManager = SettingsManager.getInstance();
        Howler.autoUnlock = true;
        Howler.html5PoolSize = 10;
        this.applyVolumeSettings();
        this.applyMuteSettings();

        this.clearOnSettingsChangeListener = this.settingsManager.onSettingsChange((type: string, value: any) => {
            this.handleSettingsChange(type, value);
        });


    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }


    /**
     * Initialize by registering default sounds and preloading them.
     */
    public async initialize(): Promise<void> {
        this.registerDefaultSounds();
        await this.preloadAll();
        this.play('theme');
    }

    private registerDefaultSounds(): void {
        this.registerSound('shoot', {
        src: [shootingAudio],
        volume: 0.20
        }, 'sfx');
    
        this.registerSound('impact', {
            src: [impactAudio],
            volume: 0.25
        }, 'sfx');

        this.registerSound('jump', {
            src: [jumpAudio],
            volume: 0.70
        }, 'sfx');
        
        this.registerSound('walking', {
            src: [walkingAudio],
            volume: 0.50,
            loop: true
        }, 'sfx');

        this.registerSound('theme', {
            src: [h3Theme],
            loop: true,
            volume: 0.15
        }, 'music');


        for (let i = 0; i < this.deathSounds.length; i++) {
            this.registerSound(`death${i+1}`, {
                src: [this.deathSounds[i]],
                volume: 0.50
            }, 'sfx');
        }

        for (let i = 0; i < this.killSounds.length; i++) {
            this.registerSound(`kill${i+1}`, {
                src: [this.killSounds[i]],
                volume: 0.50
            }, 'sfx');
        }

        for (let i = 0; i < this.matchStartSounds.length; i++) {
            this.registerSound(`matchStart${i+1}`, {
                src: [this.matchStartSounds[i]],
                volume: 0.75
            }, 'sfx');
        }
    }

    public async playRandomDeathSound(): Promise<number | undefined> {
        const index = Math.floor(Math.random() * this.deathSounds.length);
        return await this.play(`death${index+1}`);
    }

    public async playRandomKillSound(): Promise<number | undefined> {
        try {
            const index = Math.floor(Math.random() * this.killSounds.length);
            const soundId = `kill${index+1}`;
            
            if (!this.sounds.has(soundId)) {
                console.error(`Kill sound ${soundId} not found in registered sounds`);
                return undefined;
            }
            
            return await this.play(soundId);
        } catch (error) {
            console.error('Error playing random kill sound:', error);
            ErrorHandler.getInstance().handleError(error as Error,
                ErrorType.AUDIO,
                { phase: 'playRandomKillSound' }
            );
            return undefined;
        }
    }

    public async playRandomMatchStartSound(): Promise<number | undefined> {
        const index = Math.floor(Math.random() * this.matchStartSounds.length);
        return await this.play(`matchStart${index+1}`);
    }

    public registerSound(soundId: string, config: SoundConfig, category: AudioCategory = 'sfx'): void {
        try {
            if (this.sounds.has(soundId)) {
                console.warn(`Sound ${soundId} already registered. Skipping.`);
                return;
            }

            const defaultVolume = category === 'music' ? 0.5 : 0.8;
            const defaultLoop = category === 'music' || category === 'ambient';
            const baseVolume = config.volume ?? defaultVolume;

            const howl = new Howl({
                src: config.src,
                volume: this.getAdjustedVolume(baseVolume, category),
                loop: config.loop ?? defaultLoop,
                autoplay: config.autoplay ?? false,
                preload: config.preload ?? true,
                sprite: config.sprite,
                rate: config.rate ?? 1.0
            });

            this.sounds.set(soundId, {
                howl,
                category,
                baseVolume
            });
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.AUDIO,
                { phase: 'registerSound', soundId, category }
            );
        }
    }

    public async play(soundId: string, spriteName?: string): Promise<number | undefined> {
        try {
            const sound = this.sounds.get(soundId);

            if (!sound) {
                console.warn(`Sound ${soundId} not found.`);
                return undefined;
            }

            // Check SettingsManager mute states first
            const settings = this.settingsManager.getSettings();
            
            if (settings.muteAll) {
                return undefined;
            }

            if (sound.category === 'music' && settings.muteMusic) {
                return undefined;
            }

            if ((sound.category === 'sfx' || sound.category === 'ui' || sound.category === 'ambient') 
                && settings.muteSfx) {
                return undefined;
            }

            if (this.muted || this.categoryMutes[sound.category]) return undefined;

            if (sound.category === 'music') {
                return await this.playMusic(soundId);
            }

            const id = spriteName
                ? sound.howl.play(spriteName)
                : sound.howl.play();

            sound.id = id;
            return id;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.AUDIO,
                { phase: 'play', soundId, spriteName }
            );
            return undefined;
        }
    }

    private async playMusic(soundId: string): Promise<number | undefined> {
        try {
            if (this.currentMusic === soundId && this.sounds.get(soundId)?.howl.playing()) {
                return this.sounds.get(soundId)?.id;
            }

            if (this.currentMusic && this.sounds.has(this.currentMusic)) {
                const currentMusic = this.sounds.get(this.currentMusic)!;
                currentMusic.howl.fade(currentMusic.howl.volume(), 0, this.musicFadeTime);
                setTimeout(() => {
                    currentMusic.howl.stop();
                }, this.musicFadeTime);
            }

            await new Promise((res) => setTimeout(res, this.musicFadeTime));
            const music = this.sounds.get(soundId)!;
            music.howl.volume(0);
            const id = music.howl.play();
            music.id = id;
            music.howl.fade(0, this.getAdjustedVolume(music.baseVolume, 'music'), this.musicFadeTime);
            this.currentMusic = soundId;
            return id;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.AUDIO,
                { phase: 'playMusic', soundId, currentMusic: this.currentMusic }
            );
            return undefined;
        }
    }

    public stop(soundId: string): void {
        const sound = this.sounds.get(soundId);

        if (!sound) {
            console.warn(`Sound ${soundId} not found.`);
            return;
        }

        if (sound.category === 'music') {
            sound.howl.fade(sound.howl.volume(), 0, this.musicFadeTime);
            setTimeout(() => {
                sound.howl.stop();
                if (this.currentMusic === soundId) {
                    this.currentMusic = null;
                }
            }, this.musicFadeTime);
        } else {
            sound.howl.stop();
        }

        sound.id = undefined;
    }

    public pause(soundId: string): void {
        const sound = this.sounds.get(soundId);
        if (!sound) {
            console.warn(`Sound ${soundId} not found.`);
            return;
        }
        sound.howl.pause();
    }

    public resume(soundId: string): void {
        const sound = this.sounds.get(soundId);
        if (!sound) {
            console.warn(`Sound ${soundId} not found.`);
            return;
        }

        if (sound.id !== undefined) {
            sound.howl.play();
        } else {
            sound.id = sound.howl.play();
        }
    }

    public muteAll(): void {
        this.muted = true;
        Howler.mute(true);
    }

    public unmuteAll(): void {
        this.muted = false;
        Howler.mute(false);
        this.applyVolumeSettings();
    }

    public muteCategory(category: AudioCategory): void {
        this.categoryMutes[category] = true;
        this.applyVolumeSettings();
    }

    public unmuteCategory(category: AudioCategory): void {
        this.categoryMutes[category] = false;
        this.applyVolumeSettings();
        if (category === 'music') {
            this.play('theme');
        }
    }

    public stopAll(): void {
        this.sounds.forEach((sound) => {
            sound.howl.stop();
            sound.id = undefined;
        });
        this.currentMusic = null;
    }

    public applyVolumeSettings(): void {
        try {
            this.sounds.forEach((sound) => {
            const volume = this.categoryMutes[sound.category] ? 0 : this.getAdjustedVolume(sound.baseVolume, sound.category);
            sound.howl.volume(volume);
        });
        } catch (error) {
            console.warn('unable to apply volume settings.');
            ErrorHandler.getInstance().handleError(error as Error,
                ErrorType.AUDIO,
                { phase: 'applyVolumeSettings' }
            );
        }


    }

    public setMusicVolume(volume: number): void {
        try {
            // Just apply the volume settings - don't update SettingsManager to avoid circular calls
            this.applyVolumeSettings();
        } catch (error) {
            console.error('Unable to set music volume:', error);
            ErrorHandler.getInstance().handleError(error as Error,
                ErrorType.AUDIO,
                { phase: 'setMusicVolume', volume }
            );
        }

    }

    public setSoundEffectsVolume(volume: number): void {
        try {
            // Just apply the volume settings - don't update SettingsManager to avoid circular calls
            this.applyVolumeSettings();
        } catch (error) {
            console.error('Unable to set sound effects volume:', error);
            ErrorHandler.getInstance().handleError(error as Error,
                ErrorType.AUDIO,
                { phase: 'setSoundEffectsVolume', volume }
            );
        }
    }

    private getAdjustedVolume(baseVolume: number, category: AudioCategory): number {
        const settings = this.settingsManager.getSettings();
        
        // Check SettingsManager mute states
        if (settings.muteAll) {
            return 0;
        }

        if (category === 'music' && settings.muteMusic) {
            return 0;
        }

        if ((category === 'sfx' || category === 'ui' || category === 'ambient') 
            && settings.muteSfx) {
            return 0;
        }

        // Check local category mautes (for backwards compatibility)
        if (this.categoryMutes[category]) {
            return 0;
        }


        if (category === 'music') {
            return baseVolume * this.settingsManager.getMusicVolume();
        } else {
            return baseVolume * this.settingsManager.getSfxVolume();
        }
    }

    public setVolume(soundId: string, volume: number): void {
        const sound = this.sounds.get(soundId);
        if (!sound) {
            console.warn(`Sound ${soundId} not found.`);
            return;
        }

        sound.baseVolume = Math.max(0, Math.min(1, volume));
        sound.howl.volume(this.getAdjustedVolume(sound.baseVolume, sound.category));
    }

    public isPlaying(soundId: string): boolean {
        const sound = this.sounds.get(soundId);
        if (!sound) {
            console.warn(`Sound ${soundId} not found.`);
            return false;
        }
        return sound.howl.playing();
    }

    public async preloadAll(): Promise<void> {
        const loadPromises: Promise<void>[] = [];
            this.sounds.forEach((sound, id) => {
            if (!sound.howl.state() || sound.howl.state() === 'unloaded') {
                const loadPromise = new Promise<void>((resolve) => {
                    sound.howl.once('load', () => {
                        resolve();
                    });

                    sound.howl.once('loaderror', () => {
                        console.error(`Failed to load sound ${id}.`);
                        resolve();
                    });

                    sound.howl.load();
                });

                loadPromises.push(loadPromise);
            }
        });

        await Promise.all(loadPromises);
    }

    private handleSettingsChange(type: string, value: any): void {
        switch (type) {
            case 'Music Volume':
                this.setMusicVolume(value);
                break;
            case 'Sound Effects Volume':
                this.setSoundEffectsVolume(value);
                break;
            case 'Mute All Sound':
                if (value) {
                    this.muteAll();
                } else {
                    console.log("Unmuting all sounds.");
                    this.unmuteAll();
                    const settings = this.settingsManager.getSettings();
                    if (!settings.muteMusic) {
                        console.log("Unmuting music category.");
                        this.unmuteCategory('music');
                        
                    }
                    if (!settings.muteSfx) {
                        console.log("Unmuting sound effects, UI, and ambient categories.");
                        this.unmuteCategory('sfx');
                        this.unmuteCategory('ui');
                        this.unmuteCategory('ambient');
                    }
                }
                break;
            case 'Mute Music':
                if (value) {
                    this.muteCategory('music');
                } else {
                    // Only unmute if global mute is not active
                    if (!this.settingsManager.getSettings().muteAll) {
                        this.unmuteCategory('music');
                    }
                }
            break;
            case 'Mute Sound Effects':
                
                if (value) {
                    this.muteCategory('sfx');
                    this.muteCategory('ui');
                    this.muteCategory('ambient');
                } else {
                    // Only unmute if global mute is not active
                    if (!this.settingsManager.getSettings().muteAll) {
                        this.unmuteCategory('sfx');
                        this.unmuteCategory('ui');
                        this.unmuteCategory('ambient');
                    }
                }
            break;
            default:
                //console.warn(`Unknown settings change type '${type}' detected in AudioManager. No action taken.`);
        }
    }

    private applyMuteSettings(): void {
        const settings  = this.settingsManager.getSettings();
        if (settings.muteAll) {
            this.muteAll();
        }
        if (settings.muteMusic) {
            this.muteCategory('music');
        } 
        if (settings.muteSfx) {
            this.muteCategory('sfx');
            this.muteCategory('ui');
            this.muteCategory('ambient');
        }
    }

    /**
     * Cleanup method to call when AudioManager is no longer needed
     */
    public destroy(): void {
        try {
            // Stop all sounds
            this.stopAll();
            
            // Unload all sounds
            this.sounds.forEach((sound) => {
                sound.howl.unload();
            });
            this.sounds.clear();
            
            // Remove settings change listener
            if (this.clearOnSettingsChangeListener) {
                this.clearOnSettingsChangeListener();
            }
            
            // Reset state
            this.currentMusic = null;
            this.muted = false;
            this.categoryMutes = {};
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.AUDIO,
                { phase: 'destroy' }
            );
        }
    }
}
