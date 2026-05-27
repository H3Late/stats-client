import { Text, Graphics, Sprite, BitmapText } from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { TypeText } from '../ui/TypeText';
import { YoutubeApiManager, type StatsResponse } from './YoutubeApiManager';
import { formatDuration, formatToString } from '../utils/time';
import { NetworkManager } from './NetworkManager';

export interface TvScreen {
    id?: string; // unique identifier
    priority?: number; // higher = more important
    showScreen(): Promise<void>; // Each screen handles its own display logic
}

export class TvManager {
    private static instance: TvManager;
    private tvMask: Graphics | null = null;
    private currentTextObjects: (Text | BitmapText)[] = [];
    private currentTypeTextObjects: TypeText[] = []; // Track TypeText instances separately
    private currentSprites: Sprite[] = [];

    // Screen queue system
    private screenQueue: TvScreen[] = [];
    private isProcessingQueue: boolean = false;
    
    private intervals: NodeJS.Timeout[] = [];
    private CRTFilter: CRTFilter | null = null;
    
    private constructor() {}
    
    public static getInstance(): TvManager {
        if (!TvManager.instance) {
            TvManager.instance = new TvManager();
        }
        return TvManager.instance;
    }
    
    /**
     * Initialize the TV manager with the TV mask element
     */
    public initialize(j1Sprite: Sprite, GAME_WIDTH: number, GAME_HEIGHT: number): void {
        
        this.tvMask = new Graphics().rect(0, 0, 553, 348).fill('#394241');
        this.tvMask.rotation = -0.187; // Rotate the mask to match the TV angle
        this.tvMask.x = GAME_WIDTH - 248;
        this.tvMask.y = (GAME_HEIGHT / 2) + 108;
        this.tvMask.stroke({
            color: '#292826',
            width: 10
        });
        

        this.CRTFilter = new CRTFilter({
            curvature: 3,
            lineWidth: 1,
            lineContrast: 0.3,
            verticalLine: true,
            vignetting: 0.20,
            vignettingAlpha: 1,
            vignettingBlur: 0.45,
            time: 0
        });
        this.tvMask.filters = [this.CRTFilter];

        // Clear any existing content
        this.clearScreen();
        
        j1Sprite.addChild(this.tvMask);

        NetworkManager.getInstance().on('showIsLive', this.queueLiveScreen.bind(this));
    }

    public async startTv(): Promise<void> {
        if (!this.tvMask) {
            console.error('TvManager: TV mask not initialized. Call initialize() first.');
            return;
        }
        
        // Clear any existing content
        this.clearScreen();
    
        // Add initial screens to queue in order
        this.queueDefaultScreen();
        
        // Wait for API screens to be added
        await this.queueApiScreens();
        
        // Start processing the queue
        this.processQueue();
    }

    /**
     * Process the queue continuously
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue) return;
        
        this.isProcessingQueue = true;
        
        while (this.screenQueue.length > 0) {
            // Sort by priority (higher first)
            //this.screenQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
            const screen = this.screenQueue.shift()!;
            
            try {
                await screen.showScreen();
            } catch (error) {
                console.error('TvManager: Screen interrupted or error occurred:', error);
                this.clearScreen();
                continue;
            }
        }
        
        this.isProcessingQueue = false;
        
        // If queue is empty, add default screen and continue
        this.queueDefaultScreen();
        this.queueApiScreens();
        this.processQueue();
    }

    /**
     * Add API screens to queue
     */
    private async queueApiScreens(): Promise<void> {
        const apiData = await YoutubeApiManager.getInstance().getStats();

        this.screenQueue.push({
            id: 'api-intro',
            priority: 1,
            showScreen: () => this.showApiIntro()
        });
        
        this.screenQueue.push({
            id: 'api-most-recent',
            priority: 1,
            showScreen: async () => {
                return this.showApiMostRecent(apiData);
            }
        });
        
        this.screenQueue.push({
            id: 'api-max-late',
            priority: 1,
            showScreen: async () => {
                return this.showApiMaxLateTime(apiData);
            }
        });
        
        this.screenQueue.push({
            id: 'api-average-late',
            priority: 1,
            showScreen: async () => {
                return this.showApiAverageLateTime(apiData);
            }
        });
        
        this.screenQueue.push({
            id: 'api-total-late',
            priority: 1,
            showScreen: async () => {
                return this.showApiTotalLateTime(apiData);
            }
        });
        
        this.screenQueue.push({
            id: 'api-tip',
            priority: 1,
            showScreen: () => this.showTip()
        });
    }

    /**
     * Add live screen to queue with high priority (for external calls)
     */
    public queueLiveScreen(): void {
        this.addHighPriorityScreen({
            id: 'live-screen',
            priority: 10, // Higher priority to interrupt current content
            showScreen: () => this.showLiveScreen()
        });
    }

    /**
     * Add default screen to queue
     */
    private queueDefaultScreen(): void {
        this.screenQueue.push({
            id: 'default-screen',
            priority: 1,
            showScreen: () => this.showDefaultScreen()
        });
    }

    /**
     * Add a screen to the queue
     */
    public addToQueue(screen: TvScreen): void {
        this.screenQueue.push(screen);
    }

    /**
     * Add a high priority screen (interrupts current)
     */
    public addHighPriorityScreen(screen: TvScreen): void {
        // Add to front of queue
        this.screenQueue.unshift(screen);
    }

    /**
     * Show default/logo screen
     */
    private async showDefaultScreen(): Promise<void> {
        if (!this.tvMask) {
            console.error('TvManager: TV mask not initialized');
            return;
        }
        
        this.clearScreen(); // Ensure screen is cleared before showing logo
        
        const logo = Sprite.from('h3Logo');
        logo.anchor.set(0.5);

        // Scale logo to fit within the TV mask while maintaining aspect ratio
        const maxWidth = this.tvMask.width * .95;
        const maxHeight = this.tvMask.height * .95;
        const scaleX = maxWidth / logo.width;
        const scaleY = maxHeight / logo.height;
        const scale = Math.min(scaleX, scaleY);
        logo.scale.set(scale);

        logo.x = (this.tvMask.width / 2) - 5;
        logo.y = (this.tvMask.height / 2) - 5;
        this.addSprite(logo);

        // Show for 5 seconds
        await new Promise(resolve => setTimeout(resolve, 7500));
    }


    /**
     * Display immediate high priority screen
     */
    public displayImmediate(message: string): void {
        this.addHighPriorityScreen({
            id: 'immediate_' + Date.now(),
            priority: 100,
            showScreen: async () => {
                this.clearScreen();
                const text = new TypeText({
                    text: message,
                    style: {
                        align: 'center',
                        fontFamily: '"Pixel", Arial, sans-serif',
                        fontSize: 32,
                        fill: '#ffffff',
                        wordWrap: true,
                        wordWrapWidth: 450
                    }
                });
                this.addTypeTextObject(text);
                text.setPosition(this.tvMask!.width / 2, this.tvMask!.height / 2);
                text.setAnchor(0.5, 0.5);
                await text.type();
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        });
    }

    /**
     * Display game stats (converted to new system)
     */
    public displayGameStats(stats: { 
        totalPlayers?: number, 
        matchTime?: string, 
        currentLeader?: string,
        remainingTime?: string 
    }): void {
        let message = '';
        
        if (stats.totalPlayers) {
            message += `Players Online: ${stats.totalPlayers}\n`;
        }
        
        if (stats.currentLeader) {
            message += `Leader: ${stats.currentLeader}\n`;
        }
        
        if (stats.matchTime) {
            message += `Match Time: ${stats.matchTime}\n`;
        }
        
        if (stats.remainingTime) {
            message += `Time Left: ${stats.remainingTime}`;
        }
        
        this.addToQueue({
            id: 'game_stats',
            priority: 5,
            showScreen: async () => {
                this.clearScreen();
                const text = new TypeText({
                    text: message.trim(),
                    style: {
                        align: 'left',
                        fontFamily: '"Pixel", Arial, sans-serif',
                        fontSize: 28,
                        fill: '#ffffff',
                        wordWrap: true,
                        wordWrapWidth: 450
                    }
                });
                this.addTypeTextObject(text);
                text.setPosition(50, 50);
                text.setAnchor(0, 0);
                await text.type();
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        });
    }

    /**
     * Display kill feed
     */
    public displayKillFeed(killer: string, victim: string): void {
        this.addHighPriorityScreen({
            id: 'kill_feed_' + Date.now(),
            priority: 7,
            showScreen: async () => {
                this.clearScreen();
                const text = new TypeText({
                    text: `${killer} eliminated ${victim}!`,
                    style: {
                        align: 'center',
                        fontFamily: '"Pixel", Arial, sans-serif',
                        fontSize: 32,
                        fill: '#ff0000',
                        wordWrap: true,
                        wordWrapWidth: 450
                    }
                });
                this.addTypeTextObject(text);
                text.setPosition(this.tvMask!.width / 2, this.tvMask!.height / 2);
                text.setAnchor(0.5, 0.5);
                await text.type();
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        });
    }

    /**
     * Display match events
     */
    public displayMatchEvent(event: 'start' | 'end' | 'warning', details?: string): void {
        let message = '';
        let priority = 8;
        
        switch (event) {
            case 'start':
                message = 'Match Starting!';
                if (details) message += `\n${details}`;
                break;
            case 'end':
                message = 'Match Ended!';
                if (details) message += `\n${details}`;
                priority = 9;
                break;
            case 'warning':
                message = details || 'Warning!';
                priority = 9;
                break;
        }
        
        this.addHighPriorityScreen({
            id: `match_${event}_${Date.now()}`,
            priority,
            showScreen: async () => {
                this.clearScreen();
                const text = new TypeText({
                    text: message,
                    style: {
                        align: 'center',
                        fontFamily: '"Pixel", Arial, sans-serif',
                        fontSize: 32,
                        fill: '#ffff00',
                        wordWrap: true,
                        wordWrapWidth: 450
                    }
                });
                this.addTypeTextObject(text);
                text.setPosition(this.tvMask!.width / 2, this.tvMask!.height / 2);
                text.setAnchor(0.5, 0.5);
                await text.type();
                await new Promise(resolve => setTimeout(resolve, 4000));
            }
        });
    }

    /**
     * Clear all screens and reset queue
     */
    public clearAll(): void {
        this.screenQueue = [];
        this.clearScreen();
    }

    /**
     * Get queue length
     */
    public getQueueLength(): number {
        return this.screenQueue.length;
    }
    
    /**
     * Remove specific screen from queue
     */
    public removeScreen(id: string): boolean {
        const index = this.screenQueue.findIndex(screen => screen.id === id);
        if (index !== -1) {
            this.screenQueue.splice(index, 1);
            return true;
        }
        return false;
    }





    // API Screen methods (keeping all the existing screen logic)
    /**
     * Show live screen
     */
    private async showLiveScreen(): Promise<void> {
        if (!this.tvMask) return;

        this.clearScreen();

        const banner = Sprite.from('liveBanner');
        const ianSprite = Sprite.from('ian');
        const danSprite = Sprite.from('dan');

        banner.anchor.set(0.5);
        ianSprite.anchor.set(0.5);
        danSprite.anchor.set(0.5);

        banner.width = this.tvMask.width * 0.65;
        banner.height = this.tvMask.height * 0.65;
        banner.x = this.tvMask.width / 2;
        banner.y = this.tvMask.height / 2 - 75;

        const ianAspectRatio = ianSprite.height / ianSprite.width;
        const danAspectRatio = danSprite.height / danSprite.width;

        const ianWidth = this.tvMask.width * 0.25;
        const danWidth = this.tvMask.width * 0.25;

        const ianHeight = ianWidth * ianAspectRatio;
        const danHeight = danWidth * danAspectRatio;

        ianSprite.width = ianWidth;
        ianSprite.height = ianHeight;
        ianSprite.x = (ianWidth / 2) + 5;
        ianSprite.y = this.tvMask.height - (ianHeight / 2) - 15;

        danSprite.width = danWidth;
        danSprite.height = danHeight;
        danSprite.x = this.tvMask.width - (danWidth / 2) - 15;
        danSprite.y = this.tvMask.height - (danHeight / 2) - 15;

        this.addSprite(banner);
        this.addSprite(ianSprite);
        this.addSprite(danSprite);

        // Show for 10 seconds
        await new Promise(resolve => setTimeout(resolve, 10000));
    }


    private async showApiIntro(): Promise<void> {
        this.clearScreen();
        const introTitle = new TypeText({
            text: 'Welcome to L3L3, the H3 Podcast late tracker!',
            style: {
                align: 'center',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 34,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 350,
            }
        });

        this.addTypeTextObject(introTitle);
        introTitle.setPosition(100, 100);
        introTitle.setAnchor(0, 0);
        await introTitle.type();
        introTitle.killCursor();
        await new Promise((resolve) => setTimeout(resolve, 4000));
        this.clearScreen();
    }

    private async showApiTotalLateTime(apiData: StatsResponse): Promise<void> {
        this.clearScreen();
        const totalLateTimeFormatted = formatDuration(apiData.totalLateTime);

        const totalStatsTitle = new TypeText({
            text: 'And finally... the podcast has been late a grand total of...',
            style: {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 30,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453
            }
        });

        this.addTypeTextObject(totalStatsTitle);   
        totalStatsTitle.setPosition(50, 25);
        totalStatsTitle.setAnchor(0, 0);
        await totalStatsTitle.type();
        totalStatsTitle.killCursor();

        let totalLateString = '';

        if (totalLateTimeFormatted.days > 0) {
            totalLateString += `  • ${totalLateTimeFormatted.days} days\n`;
        }
        if (totalLateTimeFormatted.hours > 0) {
            totalLateString += `  • ${totalLateTimeFormatted.hours} hour(s)\n`;
        }
        if (totalLateTimeFormatted.minutes > 0) {
            totalLateString += `  • ${totalLateTimeFormatted.minutes} minute(s)\n`;
        }
        if (totalLateTimeFormatted.seconds > 0) {
            totalLateString += `  • ${totalLateTimeFormatted.seconds} second(s)`;
        }

        totalLateString += '...'

        const totalLateTime = new TypeText({
            text: totalLateString,
            style:  {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 30,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453,
                lineHeight: 33
            }
        });
        this.addTypeTextObject(totalLateTime);
        totalLateTime.setPosition(50, totalStatsTitle.text.y + totalStatsTitle.text.height + 20);
        totalLateTime.setAnchor(0, 0);

        await totalLateTime.type();
        totalLateTime.killCursor();

        const bottomText = new TypeText({
            text: 'He can\'t keep getting away with this!',
            style: {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 30,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453
            }
        });

        this.addTypeTextObject(bottomText);
        bottomText.setPosition(50, totalLateTime.text.y + totalLateTime.text.height + 20);
        bottomText.setAnchor(0, 0);
        await bottomText.type();
        await new Promise((resolve) => setTimeout(resolve, 10000));
        this.clearScreen();
    }

    private async showApiMaxLateTime(apiData: StatsResponse): Promise<void> {
        this.clearScreen();
        const maxLateTitle = new TypeText({
            text: `The most late episode, "${apiData.max.title}", has a total late time of...`,
            style: {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 30,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453
            },
            pauseOnDots: false
        });

        const maxLateTimeFormatted = formatDuration(apiData.max.lateTime);

        const maxLateString = maxLateTimeFormatted.hours > 0 ? `  • ${maxLateTimeFormatted.hours} hour(s)\n  • ${maxLateTimeFormatted.minutes} minute(s)\n  • ${maxLateTimeFormatted.seconds} second(s)`
            : `  • ${maxLateTimeFormatted.minutes} minutes\n  • ${maxLateTimeFormatted.seconds} second(s)`;

        const maxLateTime = new TypeText({
            text: maxLateString,
            style:  {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 30,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453,
                lineHeight: 33
            }
        });

        this.addTypeTextObject(maxLateTitle);
        this.addTypeTextObject(maxLateTime);   

        maxLateTitle.setPosition(50, 25);
        maxLateTitle.setAnchor(0, 0);

        await maxLateTitle.type();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        maxLateTitle.killCursor();

        maxLateTime.setPosition(50, maxLateTitle.text.y + maxLateTitle.text.height + 20); 
        maxLateTime.setAnchor(0, 0); 

        await maxLateTime.type();
        await new Promise((resolve) => setTimeout(resolve, 10000));
        this.clearScreen();
    }

    private async showApiMostRecent(apiData: StatsResponse): Promise<void> {
        this.clearScreen();
        const wasOnTime = apiData.mostRecent.scheduledStartTime === apiData.mostRecent.actualStartTime;
        const wasLate = !wasOnTime && apiData.mostRecent.lateTime > 0;
        const textString = `The most recent episode "${apiData.mostRecent.title}" was ${wasOnTime ? 'on time!' : `${wasLate ? 'late by...' : 'early!'}`}`




        const mostRecentTitle = new TypeText({
            text: textString,
            style: {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 30,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453,
            },
            pauseOnDots: false,
        });

        const mostRecentTimeFormatted = formatDuration(apiData.mostRecent.lateTime);       
        this.addTypeTextObject(mostRecentTitle);
        mostRecentTitle.setPosition(50, 25);
        mostRecentTitle.setAnchor(0, 0);
        await mostRecentTitle.type();
        if (wasLate) await new Promise((resolve) => setTimeout(resolve, 2000));

        if (wasLate) {
            mostRecentTitle.killCursor();
            let mostRecentString = '';

            if (mostRecentTimeFormatted.days > 0) {
                mostRecentString += `  • ${mostRecentTimeFormatted.days} days\n`;
            }
            if (mostRecentTimeFormatted.hours > 0) {
                mostRecentString += `  • ${mostRecentTimeFormatted.hours} hours\n`;
            }
            if (mostRecentTimeFormatted.minutes > 0) {
                mostRecentString += `  • ${mostRecentTimeFormatted.minutes} minutes\n`;
            }
            if (mostRecentTimeFormatted.seconds > 0) {
                mostRecentString += `  • ${mostRecentTimeFormatted.seconds} seconds`;
            }

            const mostRecentTime = new TypeText({
                text: mostRecentString,
                style:  {
                    align: 'left',
                    fontFamily: '"Pixel", Arial, sans-serif',
                    fontStyle: 'normal',
                    fontSize: 30,
                    fill: '#ffffff',
                    wordWrap: true,
                    wordWrapWidth: 453,
                    lineHeight: 33
                }
            });
            this.addTypeTextObject(mostRecentTime);

            mostRecentTime.setPosition(50, mostRecentTitle.text.y + mostRecentTitle.text.height + 20); 
            mostRecentTime.setAnchor(0, 0); 

            await mostRecentTime.type();
        }

        await new Promise((resolve) => setTimeout(resolve, 10000));
        if (!wasLate) mostRecentTitle.killCursor();
        this.clearScreen();
    }

    private async showApiAverageLateTime(apiData: StatsResponse): Promise<void> {
        this.clearScreen();
        const averageLateTimeTitle = new TypeText({
            text: `With a total of ${apiData.streamCount} episodes, the show has an average late time of...`,
            style:  {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 30,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453,
                lineHeight: 33
            }
        });

        this.addTypeTextObject(averageLateTimeTitle);
        averageLateTimeTitle.setPosition(50, 25);
        averageLateTimeTitle.setAnchor(0, 0);
        await averageLateTimeTitle.type();
        averageLateTimeTitle.killCursor();

        const formattedTime = formatDuration(apiData.averageLateTime);
        let averageLateString = '';
        if (formattedTime.days > 0) {
            averageLateString += `  • ${formattedTime.days} days\n`;
        }
        if (formattedTime.hours > 0) {
            averageLateString += `  • ${formattedTime.hours} hours\n`;
        }
        if (formattedTime.minutes > 0) {
            averageLateString += `  • ${formattedTime.minutes} minutes\n`;
        }
        if (formattedTime.seconds > 0) {
            averageLateString += `  • ${formattedTime.seconds} seconds`;
        }

        const averageLateTime = new TypeText({
            text: averageLateString,
            style:  {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 30,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453,
                lineHeight: 33
            }
        });

        const bottomText = new TypeText({
            text: 'Let\'s see how that changes throughout the week...',
            style: {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 30,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453
            }
        });

        this.addTypeTextObject(averageLateTime);
        averageLateTime.setPosition(50, averageLateTimeTitle.text.y + averageLateTimeTitle.text.height + 20);
        averageLateTime.setAnchor(0, 0);

        this.addTypeTextObject(bottomText);
        bottomText.setPosition(50, averageLateTime.text.y + averageLateTime.text.height + 50);
        bottomText.setAnchor(0, 0);
        
        await averageLateTime.type();
        await new Promise((resolve) => setTimeout(resolve, 5000));
        averageLateTime.killCursor();
        await bottomText.type();
        await new Promise((resolve) => setTimeout(resolve, 5000));
        this.clearScreen();
        await this.showApiDailyAverageLateTimes(apiData);
    }
 
    private async showApiDailyAverageLateTimes(apiData: StatsResponse): Promise<void> {
        this.clearScreen();
        const title = new TypeText({
            text: 'Average Late Times by Day',
            style: {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 30,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453,
            }
        });

        const dailyStatTexts = Object.entries(apiData.daily).map(([day, data]) => {
            return new TypeText({
                text: `•  ${day.charAt(0).toUpperCase()} (${data.count} ep${data.count === 1 ? '' : 's'}): ${formatToString(data.totalLateTime / data.count)}`,
                style: {
                    align: 'left',
                    fontFamily: '"Pixel", Arial, sans-serif',
                    fontStyle: 'normal',
                    fontSize: 30,
                    fill: '#ffffff',
                    wordWrap: true,
                    wordWrapWidth: 453,
                },
                typingSpeed: 75
            });
        });

        this.addTypeTextObject(title);
        title.setPosition(50, 25);
        title.setAnchor(0, 0);

        for (const statText of dailyStatTexts) {
            this.addTypeTextObject(statText);
            statText.setAnchor(0, 0);
            statText.setPosition(50, 75 + (dailyStatTexts.indexOf(statText) * 35));
        }

        await title.type();
        title.killCursor();

        let index = 0;
        for (const statText of dailyStatTexts) {
            await statText.type();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            if (index !== dailyStatTexts.length - 1) statText.killCursor();
            index++;
        }
        await new Promise((resolve) => setTimeout(resolve, 15000));
        this.clearScreen();
    }   

    private async showTip(): Promise<void> {
        this.clearScreen();
        const tipText = new TypeText({
            text: 'Try picking up a tomato!',
            style: {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 34,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453,
            }
        });

        tipText.setPosition(50, 25);
        tipText.setAnchor(0, 0);
        this.addTypeTextObject(tipText);
        await tipText.type();
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Add delay to see the tip
    }

    /**
     * Add a TypeText object to the TV mask and track it
     */
    private addTypeTextObject(typeTextObj: TypeText): void {
        if (!this.tvMask) return;
        
        this.currentTypeTextObjects.push(typeTextObj);
        this.currentTextObjects.push(typeTextObj.text);
        this.tvMask.addChild(typeTextObj.text);
    }



    private addSprite(sprite: Sprite): void {
        if (!this.tvMask) return;
        this.currentSprites.push(sprite);
        this.tvMask.addChild(sprite);
    }

    private clearScreen(): void {
        if (!this.tvMask) return;

        // Clean up TypeText instances first (this will stop cursor blinking intervals)
        for (const typeTextObj of this.currentTypeTextObjects) {
            typeTextObj.destroy(); // This will clean up intervals and destroy the PIXI text object
        }
        this.currentTypeTextObjects = [];

        // Clean up remaining text objects
        for (const textObject of this.currentTextObjects) {
            this.tvMask.removeChild(textObject);
            textObject.destroy(); // Clean up PIXI object
        }
        this.currentTextObjects = [];

        // Clean up sprites
        for (const sprite of this.currentSprites) {
            this.tvMask.removeChild(sprite);
            sprite.destroy(); // Clean up PIXI object
        }
        this.currentSprites = [];
    }

    /**
     * Cleanup when game session ends
     */
    public cleanup(): void {
        this.screenQueue = [];
        this.isProcessingQueue = false;
        this.intervals.forEach(interval => clearInterval(interval));
        this.clearScreen();
    }
}
