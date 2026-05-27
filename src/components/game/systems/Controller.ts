import { ErrorHandler, ErrorType } from '../utils/ErrorHandler';

const keyMap: Record<string, keyof Controller['keys']> = {
  Space: 'space',
  KeyW: 'up',
  ArrowUp: 'up',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyD: 'right',
  ArrowRight: 'right',
};


export type ControllerState = {
  keys: Record<string, boolean>;
  mouse: {
    pressed: boolean;
    x: number | undefined;
    y: number | undefined;
    xR: number | undefined;
    yR: number | undefined;
    justReleased: boolean;
  };
};

export class Controller {
  public readonly keys: Record<
    'up' | 'down' | 'left' | 'right' | 'space',
    { pressed: boolean }
  >;

  public readonly mouse: {
    pressed: boolean;
    x: number | undefined,
    y: number | undefined,
    xR: number | undefined,
    yR: number | undefined,
    justReleased: boolean

  };
  

  private boundBlur!: () => void;
  private boundContextMenu!: (event: MouseEvent) => void;
  private boundKeyDown!: (event: KeyboardEvent) => void;
  private boundKeyUp!: (event: KeyboardEvent) => void;
  private boundMouseDown!: (event: MouseEvent) => void;
  private boundMouseUp!: (event: MouseEvent) => void;
  private customKeyHandler?: (event: KeyboardEvent) => void;
  private customKeyUpHandler?: (event: KeyboardEvent) => void;
  private customMouseUpHandler?: (event: MouseEvent) => void;

  constructor() {
    try {
      this.keys = {
        up: { pressed: false },
        down: { pressed: false },
        left: { pressed: false },
        right: { pressed: false },
        space: { pressed: false },
      };
      
      this.mouse = { pressed: false, x: undefined, y: undefined, justReleased: false, xR: undefined, yR: undefined };

      // Bind all handlers
      this.boundKeyDown = this.keydownHandler.bind(this);
      this.boundKeyUp = this.keyupHandler.bind(this);
      this.boundMouseDown = this.mouseDownHandler.bind(this);
      this.boundMouseUp = this.mouseUpHandler.bind(this);
      this.boundBlur = this.handleBlur.bind(this);
      this.boundContextMenu = this.contextMenuHandler.bind(this);

      // Register event listeners with error handling
      try {
        window.addEventListener('keydown', this.boundKeyDown);
        window.addEventListener('keyup', this.boundKeyUp);
        window.addEventListener('mousedown', this.boundMouseDown);
        window.addEventListener('mouseup', this.boundMouseUp);
        window.addEventListener('blur', this.boundBlur);
        window.addEventListener('contextmenu', this.boundContextMenu);
      } catch (eventError) {
        ErrorHandler.getInstance().handleError(
          eventError as Error,
          ErrorType.INITIALIZATION,
          { phase: 'controllerEventListeners' }
        );
        throw new Error('Failed to register controller event listeners');
      }
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.INITIALIZATION,
        { phase: 'controllerConstructor' }
      );
      // Initialize with defaults on error
      this.keys = {
        up: { pressed: false },
        down: { pressed: false },
        left: { pressed: false },
        right: { pressed: false },
        space: { pressed: false },
      };
      this.mouse = { pressed: false, x: undefined, y: undefined, justReleased: false, xR: undefined, yR: undefined };
    }
  }




  public setCustomKeyDownHandler(handler: (event: KeyboardEvent) => void): void {
    try {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }
      this.customKeyHandler = handler;
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.VALIDATION,
        { phase: 'setCustomKeyDownHandler' }
      );
    }
  }
  
  public setCustomKeyUpHandler(handler: (event: KeyboardEvent) => void): void {
    try {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }
      this.customKeyUpHandler = handler;
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.VALIDATION,
        { phase: 'setCustomKeyUpHandler' }
      );
    }
  }
  
  public setCustomMouseUpHandler(handler: (event: MouseEvent) => void): void {
    try {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }
      this.customMouseUpHandler = handler;
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.VALIDATION,
        { phase: 'setCustomMouseUpHandler' }
      );
    }
  }

  public reset(): void {
    try {
      for (const key in this.keys) {
        const keyName = key as keyof typeof this.keys;
        this.keys[keyName].pressed = false;
      }
      this.resetMouse();
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.GAME_STATE,
        { phase: 'controllerReset' }
      );
    }
  }

  public resetJump(): void {
    try {
      this.keys.space.pressed = false;
      this.keys.up.pressed = false;
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.GAME_STATE,
        { phase: 'resetJump' }
      );
    }
  }

  public resetMouse(): void {
    try {
      this.mouse.pressed = false;
      this.mouse.x = undefined;
      this.mouse.y = undefined;
      this.mouse.justReleased = false;
      this.mouse.xR = undefined;
      this.mouse.yR = undefined;
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.GAME_STATE,
        { phase: 'resetMouse' }
      );
    }
  }


  public getState(): ControllerState {
    try {
      return {
        keys: Object.fromEntries(
          Object.entries(this.keys).map(([key, value]) => [key, value.pressed])
        ),
        mouse: { ...this.mouse },
      };
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.GAME_STATE,
        { phase: 'getControllerState' }
      );
      // Return default state on error
      return {
        keys: {
          up: false,
          down: false,
          left: false,
          right: false,
          space: false,
        },
        mouse: {
          pressed: false,
          x: undefined,
          y: undefined,
          xR: undefined,
          yR: undefined,
          justReleased: false,
        },
      };
    }
  }


  private keydownHandler(event: KeyboardEvent): void {
    try {
      const key = keyMap[event.code];
      if (!key) return;

      const state = this.keys[key];
      if (state.pressed) return; // Ignore if already pressed

      state.pressed = true;

      // Call custom key handler if defined
      // Note: This needs to happen after the state is updated.
      if (this.customKeyHandler) {
        try {
          this.customKeyHandler(event);
        } catch (customError) {
          ErrorHandler.getInstance().handleError(
            customError as Error,
            ErrorType.VALIDATION,
            { phase: 'customKeyDownHandler', key: event.code }
          );
        }
      }
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.VALIDATION,
        { phase: 'keydownHandler', keyCode: event.code }
      );
    }
  }

  private keyupHandler(event: KeyboardEvent): void {
    try {
      const key = keyMap[event.code];
      if (!key) return;

      // Call custom key up handler if defined
      if (this.customKeyUpHandler) {
        try {
          this.customKeyUpHandler(event);
        } catch (customError) {
          ErrorHandler.getInstance().handleError(
            customError as Error,
            ErrorType.VALIDATION,
            { phase: 'customKeyUpHandler', key: event.code }
          );
        }
      }
      
      const state = this.keys[key];
      state.pressed = false;
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.VALIDATION,
        { phase: 'keyupHandler', keyCode: event.code }
      );
    }
  }
   
  private mouseDownHandler(event: MouseEvent): void {
    try {
      // Check if it's a left click (main button)
      if (event.button !== 0) return;
      this.mouse.pressed = true;
      this.mouse.x = event.clientX;
      this.mouse.y = event.clientY;
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.VALIDATION,
        { phase: 'mouseDownHandler', button: event.button }
      );
    }
  }

  private mouseUpHandler(event: MouseEvent): void {
    try {
      if (event.button !== 0) return;

      // Call custom mouse up handler if defined
      if (this.customMouseUpHandler) {
        try {
          this.customMouseUpHandler(event);
        } catch (customError) {
          ErrorHandler.getInstance().handleError(
            customError as Error,
            ErrorType.VALIDATION,
            { phase: 'customMouseUpHandler', button: event.button }
          );
        }
      }
      this.mouse.pressed = false;
      this.mouse.justReleased = true;
      this.mouse.xR = event.clientX;
      this.mouse.yR = event.clientY;
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.VALIDATION,
        { phase: 'mouseUpHandler', button: event.button }
      );
    }
  }



  // Add a new method to handle window blur
  private handleBlur(): void {
    try {
      // Reset all key states when window loses focus
      for (const key in this.keys) {
        const keyName = key as keyof typeof this.keys;
        this.keys[keyName].pressed = false;
      }

      // Also reset mouse states
      this.resetMouse();
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.GAME_STATE,
        { phase: 'handleBlur' }
      );
    }
  }

  
  // Add handler for context menu (right-click)
  private contextMenuHandler(event: MouseEvent): void {
    try {
      // Prevent default context menu
      event.preventDefault();
      
      // Reset key states (same as blur handler)
      for (const key in this.keys) {
        const keyName = key as keyof typeof this.keys;
        this.keys[keyName].pressed = false;
      }
      
      this.resetMouse();
    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.VALIDATION,
        { phase: 'contextMenuHandler' }
      );
    }
  }

  destroy(): void {
    try {
      // Remove event listeners with individual error handling
      try {
        window.removeEventListener('keydown', this.boundKeyDown);
      } catch (error) {
        console.warn('Failed to remove keydown listener:', error);
      }
      
      try {
        window.removeEventListener('keyup', this.boundKeyUp);
      } catch (error) {
        console.warn('Failed to remove keyup listener:', error);
      }
      
      try {
        window.removeEventListener('mousedown', this.boundMouseDown);
      } catch (error) {
        console.warn('Failed to remove mousedown listener:', error);
      }
      
      try {
        window.removeEventListener('mouseup', this.boundMouseUp);
      } catch (error) {
        console.warn('Failed to remove mouseup listener:', error);
      }
      
      try {
        window.removeEventListener('blur', this.boundBlur);
      } catch (error) {
        console.warn('Failed to remove blur listener:', error);
      }
      
      try {
        window.removeEventListener('contextmenu', this.boundContextMenu);
      } catch (error) {
        console.warn('Failed to remove contextmenu listener:', error);
      }

      // Clear custom handlers
      this.customKeyHandler = undefined;
      this.customKeyUpHandler = undefined;
      this.customMouseUpHandler = undefined;

    } catch (error) {
      ErrorHandler.getInstance().handleError(
        error as Error,
        ErrorType.MEMORY,
        { phase: 'controllerDestroy' }
      );
    }
  }
}