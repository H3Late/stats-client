import { Container, Text, TextStyle, Graphics } from 'pixi.js';

type PlayerScore = {
    playerId: string;
    name: string;
    kills: number;
    deaths: number;
}

export class GameOverDisplay extends Container {

    private timerId: NodeJS.Timeout | null = null;

    constructor(scores: PlayerScore[], selfId: string) {
        super();

        const renderedWidth = window.innerWidth
        const rendererHeight = window.innerHeight;
        this.position.set(renderedWidth / 2, rendererHeight / 2);
        // Create transparent black background with rounded corners
        const background = new Graphics();
        const backgroundWidth = Math.min(500, renderedWidth * 0.8); // Responsive width
        const backgroundHeight = Math.min(600, rendererHeight * 0.8); // Responsive height
        const borderRadius = 20;
        
        // Position at center (0,0 is center since we'll set anchor later)
        background.roundRect(
            -backgroundWidth / 2,
            -backgroundHeight / 4,
            backgroundWidth,
            backgroundHeight,
            borderRadius
        );
        background.fill({ color: 0x000000, alpha: 0.7 }); // Black with 70% opacity
        this.position.set(renderedWidth / 2, rendererHeight / 2);
        this.addChild(background);

        const winnerStyle = new TextStyle({
            fontFamily: 'Pixel',
            fontSize: 40,
            fontWeight: 'bold',
            fill: '#ffffff',
            stroke: '#000000',
            align: 'center'
        });

        const scoreStyle = new TextStyle({
            fontFamily: 'Pixel',
            fontSize: 20,
            fill: '#cccccc',
            align: 'center'
        });

        // Winner display
        const winner = scores[0];
        const winnerText = new Text({
            text: `${winner.playerId === selfId ? 'YOU' : 'Player ' + winner.name} WON!\nKills: ${winner.kills}  Deaths: ${winner.deaths}`,
            style: winnerStyle
        });
        winnerText.anchor.set(0.5);
        this.addChild(winnerText);

        // Other players scores
        scores.forEach((score, index) => {
            const scoreText = new Text({
                text: `${score.name}: ${score.kills} kills, ${score.deaths} deaths`,
                style: scoreStyle
            });
            scoreText.anchor.set(0.5);
            scoreText.y = winnerText.height + 20 + (index * 30);
            this.addChild(scoreText);
        });

        let secondCount = 10;
        const nextRoundText = new Text({
            text: `Next round starting ${secondCount} seconds...`,
            style: new TextStyle({
                fontFamily: 'Pixel',
                fontSize: 20,
                fill: '#ffffff',
                align: 'center'
            })
        });

        nextRoundText.anchor.set(0.5);
        nextRoundText.y = winnerText.height + 20 + (scores.length * 30) + 40;
        this.addChild(nextRoundText);

        this.timerId = setInterval(() => {
            if (secondCount <= 0) {
                clearInterval(this.timerId!);
                this.timerId = null;
                return;
            }
            secondCount--;
            nextRoundText.text = `Next round starting in ${secondCount} seconds...`;
        }, 1000);
    }

    destroy(): void {
        // Clean up children and timer
        this.removeChildren().forEach(child => child.destroy());
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }   
        super.destroy();
    }
}