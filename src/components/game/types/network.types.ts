import type { InputVector, PositionVector } from "../systems/Vector";
import type { PlayerState } from "./game.types";



export interface PlayerServerState {
  id: string;
  x: number;
  y: number;
  hp: number;
  by: boolean;
  name: string;
  tick: number;
  vx: number;
  vy: number;
  kills: number;
  deaths: number;
  isDead: boolean;
}


export interface PlayerServerPartialState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp?: number;
  by?: boolean;
  name?: string;
  tick?: number;
  kills?: number;
  deaths?: number;
  isDead?: boolean;
}
export interface ProjectileServerState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  dud: boolean;
};

export interface ProjectileServerStateUpdate {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  ownerId?: string;
  dud?: boolean;
}


export interface ServerStateUpdate {
    players: PlayerServerState[];
    projectiles: ProjectileServerState[];
    sTick: number; // server tick
    sTime: number; // server timestamp
};

export interface ServerState {
    players: PlayerState[];
    projectiles: ProjectileServerState[];
    scores: PlayerScore[];
    sTick: number;
    sTime: number;
};

export interface PlayerScore {
    playerId: string;
    kills: number;
    deaths: number;
    name: string;
}

export interface InputPayload {
    tick: number;
    vector: InputVector;
}

export interface StatePayload {
    tick: number;
    position: PositionVector;
}

export interface NetworkState {
  enemyProjectileStates: Map<string, ProjectileServerState>;
  latestServerSnapshot: ServerStateUpdate;
  latestServerSnapshotProcessed: ServerStateUpdate;
  inputBuffer: InputPayload[];
  stateBuffer: StatePayload[];
}