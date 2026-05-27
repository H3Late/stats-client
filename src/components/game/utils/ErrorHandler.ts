export const ErrorType = {
    NETWORK: 'NETWORK',
    GAME_STATE: 'GAME_STATE',
    AUDIO: 'AUDIO',
    RENDERING: 'RENDERING',
    API: 'API',
    VALIDATION: 'VALIDATION',
    SOCKET: 'SOCKET',
    INITIALIZATION: 'INITIALIZATION',
    MEMORY: 'MEMORY',
    CONFIGURATION: 'CONFIGURATION'
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

export const ErrorSeverity = {
    LOW: 'LOW',           // Minor issues, recoverable
    MEDIUM: 'MEDIUM',     // Moderate issues, may affect functionality
    HIGH: 'HIGH',         // Serious issues, significant impact
    CRITICAL: 'CRITICAL'  // Critical issues, application may be unusable
} as const;

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity];

export interface GameError {
    id: string;
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
    stack?: string;
    timestamp: Date;
    context?: Record<string, any>;
    userAgent?: string;
    url?: string;
    userId?: string;
    sessionId?: string;
}

export interface ErrorHandlerConfig {
    maxErrors: number;
    enableConsoleLogging: boolean;
    enableRemoteLogging: boolean;
    enableUserNotification: boolean;
    remoteEndpoint?: string;
    retryAttempts: number;
    retryDelay: number;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private errors: GameError[] = [];
    private config: ErrorHandlerConfig;
    private sessionId: string;
    private userId?: string;

    private constructor() {
        this.sessionId = this.generateSessionId();
        this.config = {
            maxErrors: 100,
            enableConsoleLogging: import.meta.env.DEV,
            enableRemoteLogging: import.meta.env.PROD,
            enableUserNotification: true,
            remoteEndpoint: import.meta.env.VITE_ERROR_ENDPOINT,
            retryAttempts: 3,
            retryDelay: 1000
        };

        // Set up global error handlers
        this.setupGlobalErrorHandlers();
    }

    public static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Configure the error handler
     */
    public configure(config: Partial<ErrorHandlerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Set the current user ID for error tracking
     */
    public setUserId(userId: string): void {
        this.userId = userId;
    }

    /**
     * Handle an error with automatic severity detection
     */
    public handleError(error: Error | string, type: ErrorType, context?: Record<string, any>): string {
        const severity = this.determineSeverity(type, error);
        return this.handleErrorWithSeverity(error, type, severity, context);
    }

    /**
     * Handle an error with explicit severity
     */
    public handleErrorWithSeverity(
        error: Error | string, 
        type: ErrorType, 
        severity: ErrorSeverity,
        context?: Record<string, any>
    ): string {
        const gameError = this.createGameError(error, type, severity, context);
        
        // Store the error
        this.storeError(gameError);

        // Log to console if enabled
        if (this.config.enableConsoleLogging) {
            this.logToConsole(gameError);
        }

        // Send to remote logging if enabled
        if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
            this.sendToRemote(gameError);
        }

        // Show user notification for high severity errors ( might not need this )
        if (this.config.enableUserNotification && this.shouldNotifyUser(severity)) {
            this.showUserNotification(gameError);
        }

        // Trigger recovery actions if needed
        this.triggerRecoveryActions(gameError);

        return gameError.id;
    }

    /**
     * Handle critical errors that require immediate attention
     */
    public handleCriticalError(
        error: Error | string, 
        type: ErrorType, 
        context?: Record<string, any>,
        shouldReload: boolean = false
    ): string {
        const errorId = this.handleErrorWithSeverity(error, type, ErrorSeverity.CRITICAL, context);
        
        if (shouldReload) {
            setTimeout(() => {
                window.location.reload();
            }, 3000); // Give user time to read the error message
        }

        return errorId;
    }

    /**
     * Log a recoverable error that doesn't need user notification
     */
    public logError(message: string, type: ErrorType, context?: Record<string, any>): string {
        return this.handleErrorWithSeverity(message, type, ErrorSeverity.LOW, context);
    }

    /**
     * Create a warning-level error
     */
    public logWarning(message: string, type: ErrorType, context?: Record<string, any>): string {
        return this.handleErrorWithSeverity(message, type, ErrorSeverity.MEDIUM, context);
    }

    /**
     * Get recent errors
     */
    public getRecentErrors(count?: number): GameError[] {
        return count ? this.errors.slice(-count) : [...this.errors];
    }

    /**
     * Get errors by type
     */
    public getErrorsByType(type: ErrorType): GameError[] {
        return this.errors.filter(error => error.type === type);
    }

    /**
     * Get errors by severity
     */
    public getErrorsBySeverity(severity: ErrorSeverity): GameError[] {
        return this.errors.filter(error => error.severity === severity);
    }

    /**
     * Clear all stored errors
     */
    public clearErrors(): void {
        this.errors = [];
    }

    /**
     * Get error statistics
     */
    public getErrorStats(): Record<string, any> {
        const stats = {
            total: this.errors.length,
            byType: {} as Record<ErrorType, number>,
            bySeverity: {} as Record<ErrorSeverity, number>,
            recentErrors: this.errors.slice(-10),
            sessionId: this.sessionId,
            userId: this.userId
        };

        // Count by type
        for (const type of Object.values(ErrorType)) {
            stats.byType[type] = this.errors.filter(e => e.type === type).length;
        }

        // Count by severity
        for (const severity of Object.values(ErrorSeverity)) {
            stats.bySeverity[severity] = this.errors.filter(e => e.severity === severity).length;
        }

        return stats;
    }

    private createGameError(
        error: Error | string, 
        type: ErrorType, 
        severity: ErrorSeverity,
        context?: Record<string, any>
    ): GameError {
        const gameError: GameError = {
            id: this.generateErrorId(),
            type,
            severity,
            message: typeof error === 'string' ? error : error.message,
            stack: typeof error !== 'string' ? error.stack : undefined,
            timestamp: new Date(),
            context,
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: this.userId,
            sessionId: this.sessionId
        };

        return gameError;
    }

    private storeError(error: GameError): void {
        this.errors.push(error);
        
        // Keep only recent errors to prevent memory issues
        if (this.errors.length > this.config.maxErrors) {
            this.errors = this.errors.slice(-this.config.maxErrors);
        }
    }

    private logToConsole(error: GameError): void {
        const prefix = `[${error.severity}] [${error.type}] [${error.id}]`;
        const message = `${prefix} ${error.message}`;
        
        switch (error.severity) {
            case ErrorSeverity.LOW:
                console.info(message, error.context);
                break;
            case ErrorSeverity.MEDIUM:
                console.warn(message, error.context);
                break;
            case ErrorSeverity.HIGH:
            case ErrorSeverity.CRITICAL:
                console.error(message, error.context);
                if (error.stack) {
                    console.error(error.stack);
                }
                break;
        }
    }

    private async sendToRemote(error: GameError): Promise<void> {
        if (!this.config.remoteEndpoint) return;

        let attempts = 0;
        const maxAttempts = this.config.retryAttempts;

        while (attempts < maxAttempts) {
            try {
                const response = await fetch(this.config.remoteEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(error)
                });

                if (response.ok) {
                    return; // Success
                }
            } catch (e) {
                console.warn(`Failed to send error to remote endpoint (attempt ${attempts + 1}):`, e);
            }

            attempts++;
            if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempts));
            }
        }
    }

    private showUserNotification(error: GameError): void {
        // Dynamically import Modal to avoid circular dependencies
        import('../ui/Modal').then(({ ModalManager }) => {
            const modal = ModalManager.getInstance();
            const userMessage = this.getUserFriendlyMessage(error);
            
            modal.showModal({
                title: this.getErrorTitle(error.severity),
                message: userMessage,
                button: {
                    text: error.severity === ErrorSeverity.CRITICAL ? 'Reload Page' : 'OK',
                    action: error.severity === ErrorSeverity.CRITICAL ? 
                        () => window.location.reload() : 
                        () => {},
                    closeOnClick: true
                },
                isWarning: error.severity !== ErrorSeverity.LOW
            });
        }).catch(e => {
            console.error('Failed to show error modal:', e);
        });
    }

    private triggerRecoveryActions(error: GameError): void {
        switch (error.type) {
            case ErrorType.NETWORK:
                this.handleNetworkError(error);
                break;
            case ErrorType.SOCKET:
                this.handleSocketError(error);
                break;
            case ErrorType.MEMORY:
                this.handleMemoryError(error);
                break;
            case ErrorType.AUDIO:
                this.handleAudioError(error);
                break;
            // Add more recovery actions as needed
        }
    }

    private handleNetworkError(_error: GameError): void {
        // Could trigger reconnection logic
        console.info('Network error detected, consider implementing reconnection logic');
    }

    private handleSocketError(_error: GameError): void {
        // Could trigger socket reconnection
        console.info('Socket error detected, consider implementing socket reconnection');
    }

    private handleMemoryError(_error: GameError): void {
        // Could trigger garbage collection or memory cleanup
        console.info('Memory error detected, consider implementing cleanup logic');
    }

    private handleAudioError(_error: GameError): void {
        // Could fallback to silent mode
        console.info('Audio error detected, consider implementing audio fallback');
    }

    private determineSeverity(type: ErrorType, _error: Error | string): ErrorSeverity {
        // Network and socket errors are usually high severity
        if (type === ErrorType.NETWORK || type === ErrorType.SOCKET) {
            return ErrorSeverity.HIGH;
        }

        // Initialization and configuration errors are critical
        if (type === ErrorType.INITIALIZATION || type === ErrorType.CONFIGURATION) {
            return ErrorSeverity.CRITICAL;
        }

        // Game state errors are usually high severity
        if (type === ErrorType.GAME_STATE) {
            return ErrorSeverity.HIGH;
        }

        // Audio and rendering issues are medium severity
        if (type === ErrorType.AUDIO || type === ErrorType.RENDERING) {
            return ErrorSeverity.MEDIUM;
        }

        // Default to medium severity
        return ErrorSeverity.MEDIUM;
    }

    private shouldNotifyUser(severity: ErrorSeverity): boolean {
        return severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL;
    }

    private getUserFriendlyMessage(error: GameError): string {
        switch (error.type) {
            case ErrorType.NETWORK:
                return 'Connection issue detected. Please check your internet connection and try again.';
            case ErrorType.SOCKET:
                return 'Connection to game server lost. The game will attempt to reconnect automatically.';
            case ErrorType.GAME_STATE:
                return 'Game state error occurred. The game will attempt to recover automatically.';
            case ErrorType.AUDIO:
                return 'Audio system error detected. You may experience issues with game sounds.';
            case ErrorType.RENDERING:
                return 'Graphics rendering issue detected. Please try refreshing the page.';
            case ErrorType.API:
                return 'Service unavailable. Please try again later.';
            case ErrorType.MEMORY:
                return 'Memory issue detected. Please close other browser tabs and refresh the page.';
            case ErrorType.CONFIGURATION:
                return 'Configuration error detected. Please refresh the page.';
            default:
                return 'An unexpected error occurred. Please try refreshing the page.';
        }
    }

    private getErrorTitle(severity: ErrorSeverity): string {
        switch (severity) {
            case ErrorSeverity.LOW:
                return 'Notice';
            case ErrorSeverity.MEDIUM:
                return 'Warning';
            case ErrorSeverity.HIGH:
                return 'Error';
            case ErrorSeverity.CRITICAL:
                return 'Critical Error';
            default:
                return 'Error';
        }
    }

    private setupGlobalErrorHandlers(): void {
        // Handle uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError(
                new Error(event.message),
                ErrorType.RENDERING,
                {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    source: 'window.onerror'
                }
            );
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(
                new Error(event.reason?.message || 'Unhandled promise rejection'),
                ErrorType.GAME_STATE,
                {
                    reason: event.reason,
                    source: 'unhandledrejection'
                }
            );
        });

        // Handle PIXI.js specific errors if available
        // Note: PIXI doesn't have a global error handler by default
        // but you could add custom error handling in your PIXI application setup
    }

    private generateErrorId(): string {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Export error data for debugging
     */
    public exportErrorData(): string {
        const exportData = {
            sessionId: this.sessionId,
            userId: this.userId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            errors: this.errors,
            stats: this.getErrorStats()
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Create a downloadable error report
     */
    public downloadErrorReport(): void {
        const data = this.exportErrorData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-report-${this.sessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
}
