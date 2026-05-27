import settingsIcon from '../images/settings-icon.png';
import { ErrorHandler, ErrorType } from '../utils/ErrorHandler';

export type Region = 'NA' | 'EU' | 'ASIA';

// Settings constants
const SETTINGS_CONSTANTS = {
    STORAGE_KEY: 'gameSettings',
    VALIDATION: {
        MIN_VOLUME: 0,
        MAX_VOLUME: 1,
        VALID_REGIONS: ['NA', 'EU', 'ASIA'] as const
    },
    UI: {
        BUTTON_SIZE: 40,
        MODAL_WIDTH: 320,
        ANIMATION_DURATION: 300,
        MODAL_ANIMATION_DURATION: 300,
        Z_INDEX: {
            BUTTON: 1000,
            MODAL: 1001
        }
    },
    DEFAULT_SETTINGS: {
        musicVolume: 0.5,
        sfxVolume: 0.5,
        muteAll: false,
        muteMusic: false,
        muteSfx: false,
        devMode: false,
        region: 'NA' as const
    }
} as const;

export interface GameSettings {
    region: Region;
    musicVolume: number;  // 0-1 range
    sfxVolume: number;    // 0-1 range
    muteAll: boolean;
    muteMusic: boolean;
    muteSfx: boolean;
    devMode: boolean;
}

type SettingsChangeCallback = (type: string, value: any) => void;
type ModalCallback = () => void;

export class SettingsManager {
    private static instance: SettingsManager | null = null;
    private settings: GameSettings;
    private tempSettings: GameSettings | null = null;
    private settingsButton: HTMLElement | null = null;
    private settingsModal: HTMLElement | null = null;
    private onSettingsChangeCallbacks: SettingsChangeCallback[] = [];
    private onModalOpenCallback: ModalCallback | null = null;
    private onModalCloseCallback: ModalCallback | null = null;
    private eventListeners: Array<{ element: HTMLElement; event: string; handler: EventListener }> = [];

    private constructor() {
        try {
            // Load settings from localStorage or use defaults
            this.settings = this.loadSettings();
            this.tempSettings = { ...this.settings };
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.CONFIGURATION,
                { phase: 'initialization' }
            );
            // Use defaults if initialization fails
            this.settings = this.getDefaultSettings();
            this.tempSettings = { ...this.settings };
            this.saveSettings();
        }
    }

    /**
     * Get default settings configuration
     */
    private getDefaultSettings(): GameSettings {
        return {
            region: 'NA',
            musicVolume: 0.35,
            sfxVolume: 0.40,
            muteAll: false,
            muteMusic: false,
            muteSfx: false,
            devMode: false,
        };
    }

    /**
     * Load and validate settings from localStorage
     */
    private loadSettings(): GameSettings {
        try {
            const savedSettings = localStorage.getItem(SETTINGS_CONSTANTS.STORAGE_KEY);
            
            if (!savedSettings) {
                const defaults = this.getDefaultSettings();
                this.settings = defaults;
                this.tempSettings = { ...defaults };
                this.saveSettings();
                return defaults;
            }

            const parsed = JSON.parse(savedSettings);
            const validated = this.validateSettings(parsed);
            
            // Save validated settings back to ensure consistency
            this.settings = validated;
            this.tempSettings = { ...validated };
            this.saveSettings();
            return validated;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.CONFIGURATION,
                { phase: 'loadSettings' }
            );
            // Return defaults on any error
            const defaults = this.getDefaultSettings();
            this.settings = defaults;
            this.tempSettings = { ...defaults };
            this.saveSettings();
            return defaults;
        }
    }

    /**
     * Validate settings object structure and values
     */
    private validateSettings(settings: any): GameSettings {
        const defaults = this.getDefaultSettings();
        
        if (!settings || typeof settings !== 'object') {
            throw new Error('Settings is not a valid object');
        }

        return {
            region: this.validateRegion(settings.region) ? settings.region : defaults.region,
            musicVolume: this.validateVolume(settings.musicVolume) ? settings.musicVolume : defaults.musicVolume,
            sfxVolume: this.validateVolume(settings.sfxVolume) ? settings.sfxVolume : defaults.sfxVolume,
            muteAll: typeof settings.muteAll === 'boolean' ? settings.muteAll : defaults.muteAll,
            muteMusic: typeof settings.muteMusic === 'boolean' ? settings.muteMusic : defaults.muteMusic,
            muteSfx: typeof settings.muteSfx === 'boolean' ? settings.muteSfx : defaults.muteSfx,
            devMode: typeof settings.devMode === 'boolean' ? settings.devMode : defaults.devMode,
        };
    }

    /**
     * Validate region value
     */
    private validateRegion(region: any): region is Region {
        return typeof region === 'string' && SETTINGS_CONSTANTS.VALIDATION.VALID_REGIONS.includes(region as any);
    }

    /**
     * Validate volume value
     */
    private validateVolume(volume: any): boolean {
        return typeof volume === 'number' && 
               !isNaN(volume) && 
               volume >= SETTINGS_CONSTANTS.VALIDATION.MIN_VOLUME && 
               volume <= SETTINGS_CONSTANTS.VALIDATION.MAX_VOLUME;
    }
    
    public static getInstance(): SettingsManager {
        if (!SettingsManager.instance) {
            SettingsManager.instance = new SettingsManager();
        }
        return SettingsManager.instance;
    }
    
    public getSettings(): GameSettings {
        return { ...this.settings }; // Return a copy to prevent direct mutation
    }
    
    public getRegion(): Region {
        return this.settings.region;
    }
    
    public getMusicVolume(): number {
        return this.settings.musicVolume;
    }
    
    public getSfxVolume(): number {
        return this.settings.sfxVolume;
    }
    
    public setRegion(region: Region): void {
        try {
            if (!this.validateRegion(region)) {
                throw new Error(`Invalid region: ${region}`);
            }
            
            this.settings.region = region;            
            // Notify listeners
            this.notifySettingsChange('Region', region);
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.VALIDATION,
                { phase: 'setRegion', region }
            );
        }
    }
    
    public onModalOpen(callback: ModalCallback): void {
        this.onModalOpenCallback = callback;
    }

    public onModalClose(callback: ModalCallback): void {
        this.onModalCloseCallback = callback;
    }

    public setMusicVolume(volume: number): void {
        try {
            if (!this.validateVolume(volume)) {
                throw new Error(`Invalid music volume: ${volume}`);
            }

            const newVolume = Math.max(SETTINGS_CONSTANTS.VALIDATION.MIN_VOLUME, 
                                                    Math.min(SETTINGS_CONSTANTS.VALIDATION.MAX_VOLUME, volume))
            if (this.tempSettings) {
                this.tempSettings.musicVolume = newVolume;
            }
            this.notifySettingsChange('Music Volume', newVolume);
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.VALIDATION,
                { phase: 'setMusicVolume', volume }
            );
        }
    }

    public setSfxVolume(volume: number): void {
        try {
            if (!this.validateVolume(volume)) {
                throw new Error(`Invalid SFX volume: ${volume}`);
            }


            const newVolume = Math.max(SETTINGS_CONSTANTS.VALIDATION.MIN_VOLUME,
                Math.min(SETTINGS_CONSTANTS.VALIDATION.MAX_VOLUME, volume));

            if (this.tempSettings) {
                this.tempSettings.sfxVolume = newVolume;
            }
            this.notifySettingsChange('Sound Effects Volume', newVolume);
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.VALIDATION,
                { phase: 'setSfxVolume', volume }
            );
        }
    }


    public setMuteAll(mute: boolean): void {

        if (this.tempSettings) {
            this.tempSettings.muteAll = mute;
        }
        this.notifySettingsChange('Mute All Sound', mute);
    }

    public setMuteMusic(mute: boolean): void {
        if (this.tempSettings) {
            this.tempSettings.muteMusic = mute;
        }
        this.notifySettingsChange('Mute Music', mute);
    }

    public setMuteSfx(mute: boolean): void {
        if (this.tempSettings) {
            this.tempSettings.muteSfx = mute;
        }
        this.notifySettingsChange('Mute Sound Effects', mute);
    }

    public setDevMode(enabled: boolean): void {
        if (this.tempSettings) {
            this.tempSettings.devMode = enabled;
        }
        this.notifySettingsChange('Developer Mode', enabled);
    }

    /**
     * Safely notify all listeners of settings changes
     */
    public createSettingsUI(): void {
        try {
            this.createSettingsButton();
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createSettingsUI' }
            );
        }
    }

    public onSettingsChange(callback: SettingsChangeCallback): () => void {
        try {
            if (typeof callback !== 'function') {
                throw new Error('Callback must be a function');
            }
            
            this.onSettingsChangeCallbacks.push(callback);
            const removeListenerCallback = () => {
                this.onSettingsChangeCallbacks = this.onSettingsChangeCallbacks.filter(cb => cb !== callback);
            };
            return removeListenerCallback;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.VALIDATION,
                { phase: 'onSettingsChange' }
            );
            // Return no-op function on error
            return () => {};
        }
    }

    /**
     * Helper method to safely add event listener and track it for cleanup
     */
    private addEventListenerSafely(element: HTMLElement, event: string, handler: EventListener): void {
        try {
            element.addEventListener(event, handler);
            this.eventListeners.push({ element, event, handler });
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'addEventListenerSafely', event }
            );
        }
    }

    private createSettingsButton(): void {
        try {
            // Remove existing button if it exists
            this.removeSettingsButton();
            
            // Create the settings button
            const button = document.createElement('button');
            button.style.cssText = `
                position: fixed;
                top: 30px;
                right: 30px;
                border: none;
                background: rgba(0, 0, 0, 0.0);
                cursor: pointer;
                z-index: ${SETTINGS_CONSTANTS.UI.Z_INDEX.BUTTON};
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s;
                padding: 0;
                overflow: hidden;
            `;
            
            // Create and add the settings icon image
            const icon = document.createElement('img');
            icon.src = settingsIcon;
            icon.alt = 'Settings';
            icon.style.cssText = `
                width: ${SETTINGS_CONSTANTS.UI.BUTTON_SIZE}px;
                height: ${SETTINGS_CONSTANTS.UI.BUTTON_SIZE}px;
                object-fit: contain;
            `;
            
            // Add error handling for image loading
            icon.onerror = () => {
                ErrorHandler.getInstance().handleError(
                    new Error('Failed to load settings icon'),
                    ErrorType.RENDERING,
                    { phase: 'loadSettingsIcon', src: settingsIcon }
                );
            };
            
            button.appendChild(icon);
            
            // Add event listeners with tracking
            this.addEventListenerSafely(button, 'mouseover', () => {
                button.style.transform = 'scale(1.1)';
                icon.style.filter = 'invert(1)';
            });
            
            this.addEventListenerSafely(button, 'mouseout', () => {
                button.style.transform = 'scale(1)';
                icon.style.filter = 'invert(0)';
            });
            
            this.addEventListenerSafely(button, 'click', () => {
                this.toggleSettingsModal();
            });
            
            document.body.appendChild(button);
            this.settingsButton = button;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createSettingsButton' }
            );
        }
    }

    /**
     * Safely remove settings button
     */
    private removeSettingsButton(): void {
        try {
            if (this.settingsButton && this.settingsButton.parentNode) {
                this.settingsButton.parentNode.removeChild(this.settingsButton);
                this.settingsButton = null;
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'removeSettingsButton' }
            );
        }
    }

    public toggleSettingsModal(): void {
        try {
            if (this.settingsModal) {
                this.closeSettingsModal();
            } else {
                this.openSettingsModal();
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'toggleSettingsModal' }
            );
        }
    }
    
    private openSettingsModal(): void {
        try {
            // Prevent multiple modals
            if (this.settingsModal) {
                console.warn('Settings modal already open');
                return;
            }

            // Create the modal container
            const modalContainer = document.createElement('div');
            modalContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: ${SETTINGS_CONSTANTS.UI.Z_INDEX.MODAL};
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            `;
            
            // Create the modal content
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: #1a1a1a;
                padding: 30px;
                border-radius: 6px;
                width: ${SETTINGS_CONSTANTS.UI.MODAL_WIDTH}px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                position: relative;
                color: white;
                max-height: 80vh;
                overflow-y: auto;
            `;
            
            // Create title
            const title = document.createElement('h2');
            title.textContent = 'Settings';
            title.style.cssText = `
                font-family: 'Pixel', sans-serif;
                margin: 0 0 24px 0;
                color: white;
                font-size: 32px;
                font-weight: 900;
                text-align: center;
            `;
            
            // Create close button
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '&times;';
            closeButton.style.cssText = `
                position: absolute;
                top: 15px;
                right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                color: #666;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.2s;
            `;

            this.addEventListenerSafely(closeButton, 'mouseover', () => {
                closeButton.style.color = '#fff';
            });
            this.addEventListenerSafely(closeButton, 'mouseout', () => {
                closeButton.style.color = '#666';
            });
            this.addEventListenerSafely(closeButton, 'click', () => this.closeSettingsModal());
            
            // Volume controls
            const volumeSection = this.createVolumeSection();
            const checkboxSection = this.createCheckboxSection();

            // Assemble modal
            modal.appendChild(title);
            modal.appendChild(closeButton);
            modal.appendChild(volumeSection);
            modal.appendChild(checkboxSection);

            // Add save button
            const saveButton = this.createSaveButton(modalContainer);
            modal.appendChild(saveButton);
            modalContainer.appendChild(modal);
            
            // Add to DOM
            document.body.appendChild(modalContainer);
            this.settingsModal = modalContainer;
            
            // Call open callback safely
            try {
                this.onModalOpenCallback?.();
            } catch (callbackError) {
                ErrorHandler.getInstance().handleError(
                    callbackError as Error,
                    ErrorType.RENDERING,
                    { phase: 'modalOpenCallback' }
                );
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'openSettingsModal' }
            );
        }
    }

    /**
     * Create save button with error handling
     */
    private createSaveButton(modalContainer: HTMLElement): HTMLButtonElement {
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.style.cssText = `
            width: 100%;
            padding: 12px;
            font-size: 24px;
            font-weight: 500;
            letter-spacing: 0.5px;
            border: none;
            border-radius: 4px;
            background: #7462B3;
            color: white;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 20px;
            font-family: 'Pixel', sans-serif;
        `;
        
        this.addEventListenerSafely(saveButton, 'mouseover', () => {
            saveButton.style.background = '#d2758e';
        });
        this.addEventListenerSafely(saveButton, 'mouseout', () => {
            saveButton.style.background = '#7462B3';
        });
        this.addEventListenerSafely(saveButton, 'click', () => {
            try {
                // Add fade out animation
                modalContainer.style.transition = `opacity ${SETTINGS_CONSTANTS.UI.ANIMATION_DURATION}ms ease`;
                modalContainer.style.opacity = '0';
                this.saveSettings();
                setTimeout(() => {
                    this.closeSettingsModal();
                }, SETTINGS_CONSTANTS.UI.ANIMATION_DURATION);
            } catch (error) {
                ErrorHandler.getInstance().handleError(
                    error as Error,
                    ErrorType.RENDERING,
                    { phase: 'saveButtonClick' }
                );
                this.closeSettingsModal(); // Force close on error
            }
        });

        return saveButton;
    }

    
    private createVolumeSection(): HTMLElement {
        try {
            const section = document.createElement('div');
            
            // Music volume slider
            const musicContainer = this.createVolumeSlider(
                'Music Volume:',
                this.settings.musicVolume,
                (volume) => {
                    this.setMusicVolume(volume);
                }
            );
            
            // SFX volume slider
            const sfxContainer = this.createVolumeSlider(
                'Sound Effects Volume:',
                this.settings.sfxVolume,
                (volume) => {
                    this.setSfxVolume(volume);
                }
            );
            
            section.appendChild(musicContainer);
            section.appendChild(sfxContainer);
            
            return section;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createVolumeSection' }
            );
            // Return empty div on error
            return document.createElement('div');
        }
    }

    /**
     * Create a volume slider with error handling
     */
    private createVolumeSlider(
        labelText: string, 
        currentValue: number, 
        onChange: (value: number) => void
    ): HTMLElement {
        try {
            const container = document.createElement('div');
            container.style.marginBottom = '20px';
            
            const label = document.createElement('label');
            label.textContent = labelText;
            label.style.cssText = `
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
                font-size: 24px;
                font-family: 'Pixel', sans-serif;
            `;
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '0';
            slider.max = '100';
            slider.value = String(Math.round(currentValue * 100));
            slider.style.cssText = `
                width: 100%;
                margin-bottom: 15px;
                accent-color: #7462b3;
            `;
            
            const valueDisplay = document.createElement('span');
            valueDisplay.textContent = `${Math.round(currentValue * 100)}%`;
            valueDisplay.style.cssText = `
                display: inline-block;
                margin-left: 10px;
                width: 40px;
            `;
            
            this.addEventListenerSafely(slider, 'input', () => {
                try {
                    const volume = parseInt(slider.value) / 100;
                    onChange(volume);
                    valueDisplay.textContent = `${Math.round(volume * 100)}%`;
                } catch (error) {
                    ErrorHandler.getInstance().handleError(
                        error as Error,
                        ErrorType.VALIDATION,
                        { phase: 'volumeSliderInput', labelText, value: slider.value }
                    );
                }
            });
            
            container.appendChild(label);
            
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.appendChild(slider);
            row.appendChild(valueDisplay);
            container.appendChild(row);
            
            return container;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createVolumeSlider', labelText }
            );
            return document.createElement('div');
        }
    }

    private createCheckboxSection(): HTMLElement {
        try {
            const section = document.createElement('div');
            section.style.cssText = `
                margin-top: 24px;
                padding-top: 20px;
                border-top: 1px solid #333;
                font-family: 'Pixel', sans-serif;
            `;
            
            // Create all checkboxes with error handling
            const checkboxes = [
                { label: 'Mute All Sound', checked: this.settings.muteAll, onChange: (checked: boolean) => {
                    this.setMuteAll(checked);
                }},
                { label: 'Mute Music', checked: this.settings.muteMusic, onChange: (checked: boolean) => {
                    this.setMuteMusic(checked);
                }},
                { label: 'Mute Sound Effects', checked: this.settings.muteSfx, onChange: (checked: boolean) => {
                    this.setMuteSfx(checked);
                }},
                { label: 'Developer Mode', checked: this.settings.devMode, onChange: (checked: boolean) => {
                    this.setDevMode(checked);
                }}
            ];

            for (const config of checkboxes) {
                try {
                    const checkbox = this.createCheckbox(config.label, config.checked, config.onChange);
                    section.appendChild(checkbox);
                } catch (checkboxError) {
                    ErrorHandler.getInstance().handleError(
                        checkboxError as Error,
                        ErrorType.RENDERING,
                        { phase: 'createSingleCheckbox', label: config.label }
                    );
                }
            }
            
            return section;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createCheckboxSection' }
            );
            return document.createElement('div');
        }
    }

    /**
     * Create a single checkbox with error handling
     */
    private createCheckbox(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
        try {
            const container = document.createElement('div');
            container.style.cssText = `
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                cursor: pointer;
                font-family: 'Pixel', sans-serif;
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = checked;
            checkbox.style.cssText = `
                width: 16px;
                height: 16px;
                margin-right: 10px;
                cursor: pointer;
                accent-color: #7462B3;
            `;
            
            const labelElement = document.createElement('label');
            labelElement.textContent = label;
            labelElement.style.cssText = `
                font-size: 24px;
                color: #ddd;
                cursor: pointer;
                user-select: none;
            `;
            
            // Handle change events with error handling
            this.addEventListenerSafely(checkbox, 'change', () => {
                try {
                    onChange(checkbox.checked);
                } catch (changeError) {
                    ErrorHandler.getInstance().handleError(
                        changeError as Error,
                        ErrorType.VALIDATION,
                        { phase: 'checkboxChange', label, checked: checkbox.checked }
                    );
                }
            });
            
            // Make the entire container clickable
            this.addEventListenerSafely(container, 'click', (e) => {
                try {
                    if (e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                        onChange(checkbox.checked);
                    }
                } catch (clickError) {
                    ErrorHandler.getInstance().handleError(
                        clickError as Error,
                        ErrorType.VALIDATION,
                        { phase: 'checkboxContainerClick', label }
                    );
                }
            });
            
            container.appendChild(checkbox);
            container.appendChild(labelElement);
            return container;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createCheckbox', label }
            );
            return document.createElement('div');
        }
    }
    
    /**
     * Close settings modal with comprehensive cleanup and error handling
     */
    private closeSettingsModal(): void {
        try {
            if (!this.settingsModal) {
                console.warn('Settings modal not found for closing');
                return;
            }
            
            // Animate modal close if possible
            if (this.settingsModal.classList) {
                this.settingsModal.classList.add('modal-closing');
            }
            


            this.applyCurrentSettings();

            
            // Remove after animation with error handling
            // TODO: refactor? do we use the animation?
            setTimeout(() => {
                try {


                    if (this.settingsModal && this.settingsModal.parentNode) {
                        document.body.removeChild(this.settingsModal);
                    }
                    
                    this.settingsModal = null;
                    
                    // Clean up any orphaned event listeners
                    this.cleanupModalEventListeners();
            
                    // Call close callback if set
                    this.onModalCloseCallback?.();
                    
                } catch (removeError) {
                    ErrorHandler.getInstance().handleError(
                        removeError as Error,
                        ErrorType.RENDERING,
                        { phase: 'closeModalRemoval' }
                    );
                }
            }, SETTINGS_CONSTANTS.UI.MODAL_ANIMATION_DURATION);
            
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'closeSettingsModal' }
            );
            
            // Fallback: force remove modal
            try {
                if (this.settingsModal && this.settingsModal.parentNode) {
                    document.body.removeChild(this.settingsModal);
                    this.settingsModal = null;
                }
            } catch (fallbackError) {
                console.error('Failed to force remove modal:', fallbackError);
            }
        }
    }

    /**
     * Clean up modal-specific event listeners
     */
    private cleanupModalEventListeners(): void {
        try {
            // Remove any modal-specific listeners that might not have been cleaned up
            const modalElements = document.querySelectorAll('.settings-modal *');
            modalElements.forEach(element => {
                const htmlElement = element as HTMLElement;
                if (htmlElement && htmlElement.cloneNode) {
                    // Replace element with clone to remove all event listeners
                    const newElement = htmlElement.cloneNode(true);
                    if (htmlElement.parentNode) {
                        htmlElement.parentNode.replaceChild(newElement, htmlElement);
                    }
                }
            });
        } catch (error) {
            console.warn('Failed to cleanup modal event listeners:', error);
        }
    }

    /**
     * Notify settings change callbacks with error handling
     */
    private notifySettingsChange(settingName: string, value: any): void {
        try {
            this.onSettingsChangeCallbacks.forEach((callback, index) => {
                try {
                    callback(settingName, value);
                } catch (callbackError) {
                    ErrorHandler.getInstance().handleError(
                        callbackError as Error,
                        ErrorType.VALIDATION,
                        { 
                            phase: 'settingsChangeCallback',
                            callbackIndex: index,
                            settingName,
                            value
                        }
                    );
                }
            });
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.VALIDATION,
                { phase: 'notifySettingsChange', settingName, value }
            );
        }
    }

    /**
     * Comprehensive cleanup method for production readiness
     */
    destroy(): void {
        try {
            
            // Remove all tracked event listeners
            this.eventListeners.forEach(({ element, event, handler }) => {
                try {
                    element.removeEventListener(event, handler);
                } catch (removeError) {
                    console.warn(`Failed to remove event listener for ${event}:`, removeError);
                }
            });
            
            // Clear the tracked listeners array
            this.eventListeners = [];
            
            // Close any open modal
            if (this.settingsModal && this.settingsModal.parentNode) {
                try {
                    document.body.removeChild(this.settingsModal);
                    this.settingsModal = null;
                } catch (modalError) {
                    console.warn('Failed to remove settings modal during cleanup:', modalError);
                }
            }
            
            // Clear callbacks
            this.onSettingsChangeCallbacks = [];
            this.onModalCloseCallback = null;
            
            // Reset to default settings
            this.settings = { ...SETTINGS_CONSTANTS.DEFAULT_SETTINGS };
            this.tempSettings = { ...SETTINGS_CONSTANTS.DEFAULT_SETTINGS };

            // Clear singleton instance
            SettingsManager.instance = null;
                        
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.MEMORY,
                { phase: 'settingsManagerDestroy' }
            );
        }
    }
    
    /**
     * Save settings to localStorage with comprehensive error handling
     */
    private saveSettings(): void {
        try {
            // Validate settings before saving
            const validatedSettings = this.validateSettings(this.tempSettings);
            
            // Ensure localStorage is available
            if (typeof Storage === 'undefined' || !window.localStorage) {
                throw new Error('localStorage is not available');
            }
            
            // Stringify and save settings
            const settingsJson = JSON.stringify(validatedSettings);
            localStorage.setItem(SETTINGS_CONSTANTS.STORAGE_KEY, settingsJson);
            
            // Verify the save was successful
            const savedData = localStorage.getItem(SETTINGS_CONSTANTS.STORAGE_KEY);
            if (savedData !== settingsJson) {
                throw new Error('Settings save verification failed - saved data does not match');
            }
            
            // Update internal settings reference
            this.settings = validatedSettings;
                        
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            ErrorHandler.getInstance().handleError(
                new Error(`Failed to save settings: ${errorMessage}`),
                ErrorType.CONFIGURATION,
                { 
                    settings: this.settings,
                    storageAvailable: typeof Storage !== 'undefined',
                    localStorageAvailable: !!window.localStorage,
                    phase: 'saveSettings'
                }
            );
            
            // Attempt to revert to last known good settings
            try {
                this.loadSettings();
            } catch (revertError) {
                ErrorHandler.getInstance().handleError(
                    new Error('Failed to revert settings after save failure'),
                    ErrorType.CONFIGURATION,
                    { originalError: errorMessage, revertError: revertError }
                );
            }
        }
    }

    private applyCurrentSettings(): void {
        // Apply settings to the application
        for (const setting of Object.keys(this.settings)) {
            const value = this.settings[setting as keyof typeof this.settings];
            this.notifySettingsChange(setting, value);

            switch (setting) {
                case 'musicVolume':
                    this.setMusicVolume(value as number)
                    break;
                case 'sfxVolume':
                    this.setSfxVolume(value as number)
                    break;
                case 'muteAll':
                    this.setMuteAll(value as boolean);
                    break;
                case 'devMode':
                    this.setDevMode(value as boolean);
                    break;
                case 'muteMusic':
                    this.setMuteMusic(value as boolean);
                    break;
                case 'muteSfx':
                    this.setMuteSfx(value as boolean);
                    break;
                // Add more cases as needed
            }
        }

    }

}