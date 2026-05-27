export const GAME_CONFIG = {
    GAME_WIDTH: 1920,
    GAME_HEIGHT: 1080,
    TICK_RATE: 120,
    BUFFER_SIZE: 1024,
    COLLISION_TIMEOUT: 3000,
} as const;

export const AUDIO_CONFIG = {
    DEFAULT_VOLUMES: {
        shoot: 0.30,
        impact: 0.35,
        jump: 0.70,
        walking: 0.50,
        theme: 0.50,
    }
} as const;

export const UI_CONFIG = {
    LARGEST_WIDTH: 1920,
    PING_UPDATE_INTERVAL: 1000,
    FPS_UPDATE_INTERVAL: 500,
} as const;