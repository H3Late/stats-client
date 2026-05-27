import type { Platform } from "../Platform";
import type { Player } from "../Player";
import type { Projectile } from "../Projectile";
import type { AmmoBush } from "../AmmoBush";
import type { Sprite } from "pixi.js";
import type { PositionVector } from "../systems/Vector";

export interface PlayerData {
    id: string;
    name: string;
    sprite: Player | undefined;
    activeProjectiles: Set<Projectile>;
    disableInput: boolean;
}

export interface PlayerState {
    id: string;
    position: PositionVector;
    hp: number;
    isBystander: boolean;
    name: string;
    tick: number;
    velocity: PositionVector;
    isDead: boolean;
    kills: number;
    deaths: number;
    [key: string]: any;
}

export interface GameState {
    phase: GamePhase;
    localTick: number;
    accumulator: number;
    pendingCollisions: Map<string, { projectileId: string, timestamp: number, predictedHealthAfterHit: number }>;
}

export interface WorldObjects {
    platforms: Platform[];
    ammoBush: AmmoBush;
    backgroundAssets: {
        j1?: Sprite | null;
        j2?: Sprite | null;
        j3?: Sprite | null;
        j4?: Sprite | null;
    };
}

export type GamePhase = 'waiting' | 'active' | 'ended';