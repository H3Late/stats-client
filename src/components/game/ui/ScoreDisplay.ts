import { Container, Text, TextStyle } from 'pixi.js';
import type { PlayerScore, PlayerServerState } from '../types/network.types';



export class ScoreManager extends Container {
    private scores: Map<string, { kills: number, deaths: number, name: string }> = new Map();
    private displayScores: Map<string, Text> = new Map();
    private scoreContainer: Container;
    private header: Text;
    private largestWidth: number = 1920; // make dynamic;
    private onKill: (playerId: string) => void;
    private onDeath?: (playerId: string) => void;

    constructor(onKill: (playerId: string) => void, onDeath?: (playerId: string) => void) {
        super();
        this.scores = new Map();
        this.onKill = onKill;
        this.onDeath = onDeath;
        // Create a container for the scores with fixed position relative to camera
        this.scoreContainer = new Container();
        this.addChild(this.scoreContainer);
    
        
        // Create header
        const headerStyle = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 16,
            fontWeight: 'bold',
            fill: '#FFFFFF',
        });
        
        this.header = new Text({ text: 'PLAYERS - Free for all (10 kills)', style: headerStyle});
        this.header.x = 10;
        this.header.y = 10;
        this.scoreContainer.addChild(this.header);
        
        this.x = 50 + (this.largestWidth - window.innerWidth) / 2;
        this.y = 125; // Fixed position
        this.visible = false; // Initially hidden
    }
    // Update scoreboard with new scores
    // TODO: This is being called frequently... optimize to only update changed scores
    // ... ensure new TextStyle is either called less frequently or reused
    updateScoreDisplay(
        newScores: PlayerScore[],
        modifiedScores: PlayerScore[],
        deletedScores: PlayerScore[],
        selfId: string
    ): void {

        if (newScores.length === 0 && modifiedScores.length === 0 && deletedScores.length === 0) {
            return; // No changes
        }


        // Clear existing scores
        for (const [_, text] of this.displayScores) {
            this.scoreContainer.removeChild(text);
            text.destroy();
        }
        this.displayScores.clear();
        
        // Sort scores by kills (descending)
        
        const sortedScores = Array.from(this.scores.entries()).map(([id, score]) => ({ ...score, playerId: id })).sort((a, b) => b.kills - a.kills);

        
        let yOffset = 40; // Start below header
        
        for (const score of sortedScores) {
            const isCurrentPlayer = score.playerId === selfId;
            
            // Style based on if it's the current player
            const style = new TextStyle({
                fontFamily: 'Arial',
                fontSize: 14,
                fill: isCurrentPlayer ? '#FFFF00' : '#FFFFFF', // Yellow for self
                fontWeight: isCurrentPlayer ? 'bold' : 'normal',
            });
            
            const text = new Text(
                `${score.name}: ${score.kills} kills / ${score.deaths} deaths`,
                style
            );
            
            text.x = 10;
            text.y = yOffset;
            yOffset += 20;
            
            this.scoreContainer.addChild(text);
            this.displayScores.set(score.playerId, text);
        }
    }
    

    public reset() {
        this.scores.clear();
    }

    public updateScores(players: PlayerServerState[], selfId: string): void {
        const newScores: PlayerScore[] = [];
        const modifiedScores: PlayerScore[] = [];
        const deletedScores: PlayerScore[] = [];

        for (const player of players) {
            const score: PlayerScore = {
                playerId: player.id,
                kills: player.kills,
                deaths: player.deaths,
                name: player.name
            };
            const previousScore = this.scores.get(score.playerId);
            
            if (!previousScore) {
                // new player score entry
                this.scores.set(score.playerId, { kills: score.kills, deaths: score.deaths, name: score.name });
                newScores.push({...this.scores.get(score.playerId)!, playerId: score.playerId });
                continue;
            }


            if (score.kills > previousScore.kills) {
                this.onKill(score.playerId);
            }

            if (score.deaths > previousScore.deaths) {
                if (this.onDeath) {
                    this.onDeath(score.playerId);
                }
            }



            const updatedScore = {
                kills: score.kills,
                deaths: score.deaths,
                name: score.name
            }

            modifiedScores.push({
                playerId: score.playerId,
                kills: score.kills,
                deaths: score.deaths,
                name: score.name
            });

            this.scores.set(score.playerId, updatedScore);
        }

        for (const [playerId, score] of this.scores) {
            if (!players.find(p => p.id === playerId)) {
                deletedScores.push({ playerId, kills: score.kills, deaths: score.deaths, name: score.name });
                this.scores.delete(playerId);
            }
        }

        this.updateScoreDisplay(
            newScores, modifiedScores, deletedScores, selfId
        );

    }

    public fixDisplayPosition(): void {
        // Position in top left corner with slight margin
        const windowWidth = window.innerWidth;
        const largestWidth = this.largestWidth;

        const offset = -(windowWidth - largestWidth) / 2;
        this.x = offset < 0 ? 50 : 50 + offset;
        this.y = 125;
    }

    public showDisplay() {
        this.visible = true;
    }

    public hideDisplay() {
        // Hide the score display by removing it from the stage
        this.visible = false;
    }

    destroy(): void {

        this.scores.clear();

        for (const text of this.displayScores.values()) {
            text.destroy();
        }
        this.displayScores.clear();
        super.destroy();
    }
}