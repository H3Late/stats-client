import bugIcon from '../images/bug-icon.png';
import { ErrorHandler, ErrorType } from '../utils/ErrorHandler';
import { config } from '../utils/config';

// Bug Report Manager constants
const BUG_REPORT_CONSTANTS = {
    UI: {
        BUTTON_SIZE: 40,
        MODAL_WIDTH: 320,
        ANIMATION_DURATION: 300,
        MODAL_ANIMATION_DURATION: 300,
        Z_INDEX: {
            BUTTON: 1000,
            MODAL: 1001
        },
        TEXT_AREA: {
            MAX_CHARS: 200,
            ROWS: 6
        }
    }
} as const;

type ModalCallback = () => void;

export class BugReportManager {
    private static instance: BugReportManager | null = null;
    private bugReportButton: HTMLElement | null = null;
    private bugReportModal: HTMLElement | null = null;
    private onModalOpenCallback: ModalCallback | null = null;
    private onModalCloseCallback: ModalCallback | null = null;
    private buttonEventListeners: Array<{ element: HTMLElement; event: string; handler: EventListener }> = [];
    private modalEventListeners: Array<{ element: HTMLElement; event: string; handler: EventListener }> = [];
    private isSubmitting: boolean = false;

    private constructor() {
        // Private constructor for singleton pattern
    }

    /**
     * Get singleton instance of BugReportManager
     */
    public static getInstance(): BugReportManager {
        if (!BugReportManager.instance) {
            BugReportManager.instance = new BugReportManager();
        }
        return BugReportManager.instance;
    }

    /**
     * Create the bug report UI elements
     */
    public createBugReportUI(): void {
        try {
            this.createBugReportButton();
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createBugReportUI' }
            );
        }
    }

    /**
     * Set callback for when modal is opened
     */
    public onModalOpen(callback: ModalCallback): () => void {
        try {
            if (typeof callback !== 'function') {
                throw new Error('Callback must be a function');
            }
            
            this.onModalOpenCallback = callback;
            
            return () => {
                this.onModalOpenCallback = null;
            };
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.VALIDATION,
                { phase: 'onModalOpen' }
            );
            // Return no-op function on error
            return () => {};
        }
    }

    /**
     * Set callback for when modal is closed
     */
    public onModalClose(callback: ModalCallback): () => void {
        try {
            if (typeof callback !== 'function') {
                throw new Error('Callback must be a function');
            }
            
            this.onModalCloseCallback = callback;
            
            return () => {
                this.onModalCloseCallback = null;
            };
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.VALIDATION,
                { phase: 'onModalClose' }
            );
            // Return no-op function on error
            return () => {};
        }
    }

    /**
     * Helper method to safely add event listener and track it for cleanup
     * Event listeners are tracked in different arrays based on whether they belong to the button or modal
     */
    private addEventListenerSafely(element: HTMLElement, event: string, handler: EventListener): void {
        try {
            element.addEventListener(event, handler);
            
            // Determine if this is a button or modal element
            if (this.bugReportButton && (element === this.bugReportButton || this.bugReportButton.contains(element))) {
                this.buttonEventListeners.push({ element, event, handler });
            } else {
                // All other elements are considered part of the modal
                this.modalEventListeners.push({ element, event, handler });
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'addEventListenerSafely', event }
            );
        }
    }

    /**
     * Create the bug report button that will be displayed on the UI
     */
    private createBugReportButton(): void {
        try {
            // Remove existing button if it exists
            this.removeBugReportButton();
            
            // Create the bug report button
            const button = document.createElement('button');
            button.style.cssText = `
                position: fixed;
                top: 30px;
                right: ${30 + BUG_REPORT_CONSTANTS.UI.BUTTON_SIZE + 10}px;
                border: none;
                background: rgba(0, 0, 0, 0.0);
                cursor: pointer;
                z-index: ${BUG_REPORT_CONSTANTS.UI.Z_INDEX.BUTTON};
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s;
                padding: 0;
                overflow: hidden;
            `;
            
            // Create and add the bug icon image
            const icon = document.createElement('img');
            icon.src = bugIcon;
            icon.alt = 'Report Bug';
            icon.style.cssText = `
                width: ${BUG_REPORT_CONSTANTS.UI.BUTTON_SIZE}px;
                height: ${BUG_REPORT_CONSTANTS.UI.BUTTON_SIZE}px;
                object-fit: contain;
            `;
            
            // Add error handling for image loading
            icon.onerror = () => {
                ErrorHandler.getInstance().handleError(
                    new Error('Failed to load bug report icon'),
                    ErrorType.RENDERING,
                    { phase: 'loadBugReportIcon', src: bugIcon }
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
                this.toggleBugReportModal();
            });
            
            document.body.appendChild(button);
            this.bugReportButton = button;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createBugReportButton' }
            );
        }
    }

    /**
     * Safely remove bug report button
     */
    private removeBugReportButton(): void {
        try {
            if (this.bugReportButton && this.bugReportButton.parentNode) {
                this.bugReportButton.parentNode.removeChild(this.bugReportButton);
                this.bugReportButton = null;
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'removeBugReportButton' }
            );
        }
    }

    /**
     * Toggle the bug report modal visibility
     */
    public toggleBugReportModal(): void {
        try {
            if (this.bugReportModal) {
                this.closeBugReportModal();
            } else {
                this.openBugReportModal();
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'toggleBugReportModal' }
            );
        }
    }
    
    /**
     * Open the bug report modal
     */
    private openBugReportModal(): void {
        try {
            // Prevent multiple modals
            if (this.bugReportModal) {
                console.warn('Bug report modal already open');
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
                z-index: ${BUG_REPORT_CONSTANTS.UI.Z_INDEX.MODAL};
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            `;
            
            // Create the modal content
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: #1a1a1a;
                padding: 30px;
                border-radius: 6px;
                width: ${BUG_REPORT_CONSTANTS.UI.MODAL_WIDTH}px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                position: relative;
                color: white;
                max-height: 80vh;
                overflow-y: auto;
            `;
            
            // Create title
            const title = document.createElement('h2');
            title.textContent = 'Report a Bug';
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
            this.addEventListenerSafely(closeButton, 'click', () => this.closeBugReportModal());
            
            // Create form section with bug report text field
            const formSection = this.createBugReportForm();

            // Assemble modal
            modal.appendChild(title);
            modal.appendChild(closeButton);
            modal.appendChild(formSection);

            // Add submit button
            const submitButton = this.createSubmitButton();
            modal.appendChild(submitButton);

            modalContainer.appendChild(modal);
            
            // Add to DOM
            document.body.appendChild(modalContainer);
            this.bugReportModal = modalContainer;
            
            // Call open callback safely
            try {
                this.onModalOpenCallback?.();
            } catch (callbackError) {
                ErrorHandler.getInstance().handleError(
                    callbackError as Error,
                    ErrorType.RENDERING,
                    { phase: 'onModalOpen', callback: 'onModalOpenCallback' }
                );
            }
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'openBugReportModal' }
            );
        }
    }

    /**
     * Close the bug report modal
     */
    private closeBugReportModal(): void {
        try {
            if (!this.bugReportModal) {
                return;
            }
            
            // Add closing animation
            this.bugReportModal.style.opacity = '0';
            
            setTimeout(() => {
                try {
                    if (this.bugReportModal && this.bugReportModal.parentNode) {
                        // Clean up modal-specific event listeners before removing the modal
                        this.cleanupModalEventListeners();
                        
                        this.bugReportModal.parentNode.removeChild(this.bugReportModal);
                        this.bugReportModal = null;

                        // Call close callback safely
                        try {
                            this.onModalCloseCallback?.();
                        } catch (callbackError) {
                            ErrorHandler.getInstance().handleError(
                                callbackError as Error,
                                ErrorType.RENDERING,
                                { phase: 'onModalClose', callback: 'onModalCloseCallback' }
                            );
                        }
                    }
                } catch (removeError) {
                    ErrorHandler.getInstance().handleError(
                        removeError as Error,
                        ErrorType.RENDERING,
                        { phase: 'closeBugReportModal:removeNode' }
                    );
                }
            }, BUG_REPORT_CONSTANTS.UI.MODAL_ANIMATION_DURATION);
            
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'closeBugReportModal' }
            );
            
            // Force cleanup on error
            try {
                if (this.bugReportModal && this.bugReportModal.parentNode) {
                    this.bugReportModal.parentNode.removeChild(this.bugReportModal);
                    this.bugReportModal = null;
                }
            } catch (forceCleanupError) {
                console.error('Failed force cleanup of bug report modal', forceCleanupError);
            }
        }
    }

    /**
     * Create the bug report form with text area
     */
    private createBugReportForm(): HTMLElement {
        try {
            const formContainer = document.createElement('div');
            formContainer.style.cssText = `
                margin-bottom: 20px;
            `;
            
            const label = document.createElement('label');
            label.textContent = 'Describe the bug:';
            label.style.cssText = `
                display: block;
                margin-bottom: 10px;
                font-weight: bold;
                font-size: 18px;
                font-family: 'Pixel', sans-serif;
            `;
            formContainer.appendChild(label);
            
            // Create text area for bug description
            const textArea = document.createElement('textarea');
            textArea.placeholder = 'Please describe what happened...';
            textArea.maxLength = BUG_REPORT_CONSTANTS.UI.TEXT_AREA.MAX_CHARS;
            textArea.rows = BUG_REPORT_CONSTANTS.UI.TEXT_AREA.ROWS;
            textArea.id = 'bug-report-textarea';
            textArea.style.cssText = `
                width: 100%;
                padding: 10px;
                font-family: 'Inter', sans-serif;
                font-size: 14px;
                border-radius: 4px;
                border: 1px solid #444;
                background-color: #2a2a2a;
                color: white;
                resize: vertical;
                box-sizing: border-box;
            `;
            formContainer.appendChild(textArea);
            
            // Character count display
            const charCount = document.createElement('div');
            charCount.style.cssText = `
                text-align: right;
                font-size: 12px;
                color: #999;
                margin-top: 5px;
            `;
            charCount.textContent = `${0}/${BUG_REPORT_CONSTANTS.UI.TEXT_AREA.MAX_CHARS}`;
            formContainer.appendChild(charCount);
            
            // Update character count on input
            this.addEventListenerSafely(textArea, 'input', () => {
                try {
                    const remaining = textArea.value.length;
                    charCount.textContent = `${remaining}/${BUG_REPORT_CONSTANTS.UI.TEXT_AREA.MAX_CHARS}`;
                    
                    // Visual feedback as user approaches limit
                    if (remaining > BUG_REPORT_CONSTANTS.UI.TEXT_AREA.MAX_CHARS * 0.9) {
                        charCount.style.color = '#ff9966';
                    } else if (remaining > BUG_REPORT_CONSTANTS.UI.TEXT_AREA.MAX_CHARS * 0.75) {
                        charCount.style.color = '#ffcc66';
                    } else {
                        charCount.style.color = '#999';
                    }
                } catch (inputError) {
                    ErrorHandler.getInstance().handleError(
                        inputError as Error,
                        ErrorType.RENDERING,
                        { phase: 'textArea:input' }
                    );
                }
            });
            
            return formContainer;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createBugReportForm' }
            );
            // Return empty div on error
            return document.createElement('div');
        }
    }

    /**
     * Create the submit button for the bug report form
     */
    private createSubmitButton(): HTMLElement {
        try {
            const submitButton = document.createElement('button');
            submitButton.textContent = 'Submit Report';
            submitButton.style.cssText = `
                background: #7462b3;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 12px 20px;
                font-family: 'Pixel', sans-serif;
                font-size: 16px;
                cursor: pointer;
                width: 100%;
                transition: background-color 0.2s;
                margin-top: 10px;
            `;
            
            this.addEventListenerSafely(submitButton, 'mouseover', () => {
                if (!this.isSubmitting) {
                    submitButton.style.backgroundColor = '#8775c2';
                }
            });
            
            this.addEventListenerSafely(submitButton, 'mouseout', () => {
                if (!this.isSubmitting) {
                    submitButton.style.backgroundColor = '#7462b3';
                }
            });
            
            this.addEventListenerSafely(submitButton, 'click', async () => {
                try {
                    if (this.isSubmitting) {
                        return; // Prevent multiple submissions
                    }
                    
                    const textArea = document.getElementById('bug-report-textarea') as HTMLTextAreaElement;
                    if (!textArea || !textArea.value.trim()) {
                        this.showErrorState(textArea, 'Please enter a bug description');
                        return;
                    }
                    
                    const bugDescription = textArea.value.trim();
                    
                    // Show loading state
                    this.isSubmitting = true;
                    submitButton.textContent = 'Submitting...';
                    submitButton.style.backgroundColor = '#555';
                    submitButton.style.cursor = 'wait';
                    
                    // Send bug report to server
                    const success = await this.submitBugReport(bugDescription);
                    
                    if (success) {
                        // Show success message
                        this.showSuccessMessage();
                        
                        // Close modal after a delay
                        setTimeout(() => {
                            this.closeBugReportModal();
                        }, 2000);
                    } else {
                        // Reset submit button
                        this.isSubmitting = false;
                        submitButton.textContent = 'Submit Report';
                        submitButton.style.backgroundColor = '#7462b3';
                        submitButton.style.cursor = 'pointer';
                        
                        // Show error on text area
                        this.showErrorState(textArea, 'Failed to submit bug report. Please try again.');
                    }
                } catch (error) {
                    ErrorHandler.getInstance().handleError(
                        error as Error,
                        ErrorType.NETWORK,
                        { phase: 'submitBugReport', action: 'click' }
                    );
                    
                    // Reset submit button
                    this.isSubmitting = false;
                    submitButton.textContent = 'Submit Report';
                    submitButton.style.backgroundColor = '#7462b3';
                    submitButton.style.cursor = 'pointer';
                    
                    // Show error message
                    const textArea = document.getElementById('bug-report-textarea') as HTMLTextAreaElement;
                    this.showErrorState(textArea, 'An error occurred. Please try again.');
                }
            });
            
            return submitButton;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createSubmitButton' }
            );
            // Return empty button on error
            return document.createElement('button');
        }
    }
    
    /**
     * Show error state on the text area
     */
    private showErrorState(textArea: HTMLTextAreaElement | null, message: string): void {
        try {
            if (!textArea) return;
            
            // Add error styling to text area
            textArea.style.borderColor = '#ff4444';
            
            // Show error message
            const errorMessage = document.createElement('div');
            errorMessage.textContent = message;
            errorMessage.style.cssText = `
                color: #ff4444;
                font-size: 14px;
                margin-top: 5px;
            `;
            
            // Remove any existing error message
            const existingError = document.getElementById('bug-report-error');
            if (existingError && existingError.parentNode) {
                existingError.parentNode.removeChild(existingError);
            }
            
            // Add ID for easy removal later
            errorMessage.id = 'bug-report-error';
            
            // Add after text area
            if (textArea.parentNode) {
                textArea.parentNode.insertBefore(errorMessage, textArea.nextSibling);
            }
            
            // Focus on the text area
            textArea.focus();
            
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'showErrorState' }
            );
        }
    }
    
    /**
     * Show success message in the modal
     */
    private showSuccessMessage(): void {
        try {
            const modal = this.bugReportModal?.querySelector('div');
            if (!modal) return;
            
            // Create success message
            const successMessage = document.createElement('div');
            successMessage.style.cssText = `
                background-color: rgba(40, 167, 69, 0.2);
                border: 1px solid #28a745;
                border-radius: 4px;
                padding: 10px;
                color: #28a745;
                text-align: center;
                margin: 10px 0;
                font-family: 'Inter', sans-serif;
            `;
            successMessage.textContent = 'Bug report submitted successfully!';
            
            // Insert at the top of the modal
            modal.insertBefore(successMessage, modal.firstChild?.nextSibling || null);
            
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'showSuccessMessage' }
            );
        }
    }
    
    /**
     * Submit bug report to the server
     */
    private async submitBugReport(description: string): Promise<boolean> {
        try {
            const response = await fetch(`${config.GAME_SERVER_URL}/api/bug-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bugReport: description
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            return true;
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.NETWORK,
                { 
                    phase: 'submitBugReport', 
                    endpoint: `${config.GAME_SERVER_URL}/api/bug-report` 
                }
            );
            return false;
        }
    }

    /**
     * Clean up event listeners specific to the modal
     */
    private cleanupModalEventListeners(): void {
        try {
            if (!this.bugReportModal) return;
            
            // Remove all modal event listeners
            for (const { element, event, handler } of this.modalEventListeners) {
                try {
                    element.removeEventListener(event, handler);
                } catch (listenerError) {
                    ErrorHandler.getInstance().handleError(
                        listenerError as Error,
                        ErrorType.RENDERING,
                        { phase: 'cleanupModalEventListeners:removeEventListener', event }
                    );
                }
            }
            
            // Clear the modal event listeners array
            this.modalEventListeners = [];
            
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'cleanupModalEventListeners' }
            );
        }
    }

    /**
     * Cleanup function to remove all event listeners and DOM elements
     */
    public cleanup(): void {
        try {
            // Clean up all button event listeners
            for (const { element, event, handler } of this.buttonEventListeners) {
                try {
                    element.removeEventListener(event, handler);
                } catch (listenerError) {
                    ErrorHandler.getInstance().handleError(
                        listenerError as Error,
                        ErrorType.RENDERING,
                        { phase: 'cleanup:removeButtonEventListener', event }
                    );
                }
            }
            
            // Clean up all modal event listeners
            for (const { element, event, handler } of this.modalEventListeners) {
                try {
                    element.removeEventListener(event, handler);
                } catch (listenerError) {
                    ErrorHandler.getInstance().handleError(
                        listenerError as Error,
                        ErrorType.RENDERING,
                        { phase: 'cleanup:removeModalEventListener', event }
                    );
                }
            }
            
            // Clear event listeners arrays
            this.buttonEventListeners = [];
            this.modalEventListeners = [];
            
            // Remove button
            this.removeBugReportButton();
            
            // Close modal if open
            if (this.bugReportModal) {
                this.closeBugReportModal();
            }

            this.onModalOpenCallback = null;
            this.onModalCloseCallback = null;

        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'cleanup' }
            );
        }
    }
}
