import { ErrorHandler, ErrorType } from '../utils/ErrorHandler';

export interface MenuItem {
    label: string;
    /** Inline SVG string for the icon (24x24 viewBox) */
    icon: string;
    onClick: () => void;
}

const MENU_CONSTANTS = {
    UI: {
        BUTTON_SIZE: 36,
        Z_INDEX: {
            BUTTON: 1000,
            DROPDOWN: 1001,
        },
        ANIMATION_DURATION: 150,
    },
} as const;

/**
 * Manages a single hamburger menu button in the top-right corner.
 * Other managers register menu items instead of creating their own buttons.
 */
export class MenuManager {
    private static instance: MenuManager | null = null;
    private menuButton: HTMLElement | null = null;
    private dropdown: HTMLElement | null = null;
    private items: MenuItem[] = [];
    private isOpen = false;
    private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];
    private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

    private constructor() {}

    public static getInstance(): MenuManager {
        if (!MenuManager.instance) {
            MenuManager.instance = new MenuManager();
        }
        return MenuManager.instance;
    }

    /**
     * Register a menu item. Call before `createMenuUI()` or call `refreshDropdown()` after.
     */
    public addItem(item: MenuItem): void {
        this.items.push(item);
    }

    /**
     * Build the hamburger button and attach it to the DOM.
     */
    public createMenuUI(): void {
        try {
            this.removeMenuUI();
            this.createHamburgerButton();
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'createMenuUI' },
            );
        }
    }

    // ── hamburger button ───────────────────────────────────────────────

    private createHamburgerButton(): void {
        const button = document.createElement('button');
        button.id = 'game-menu-btn';
        button.style.cssText = `
            position: fixed;
            top: 30px;
            right: 30px;
            border: none;
            background: transparent;
            cursor: pointer;
            z-index: ${MENU_CONSTANTS.UI.Z_INDEX.BUTTON};
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            transition: transform 0.2s;
        `;

        // SVG hamburger icon – three horizontal bars
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${MENU_CONSTANTS.UI.BUTTON_SIZE}" height="${MENU_CONSTANTS.UI.BUTTON_SIZE}" viewBox="0 0 24 24"
                 fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
        `;

        this.addEventListenerSafely(button, 'mouseover', () => {
            button.style.transform = 'scale(1.1)';
        });
        this.addEventListenerSafely(button, 'mouseout', () => {
            if (!this.isOpen) button.style.transform = 'scale(1)';
        });
        this.addEventListenerSafely(button, 'click', (e: Event) => {
            e.stopPropagation();
            this.toggle();
        });

        document.body.appendChild(button);
        this.menuButton = button;
    }

    // ── dropdown ───────────────────────────────────────────────────────

    private toggle(): void {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    private openDropdown(): void {
        if (this.dropdown) return;

        const dropdown = document.createElement('div');
        dropdown.id = 'game-menu-dropdown';
        dropdown.style.cssText = `
            position: fixed;
            top: ${30 + MENU_CONSTANTS.UI.BUTTON_SIZE + 8}px;
            right: 30px;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 6px;
            padding: 6px 0;
            min-width: 180px;
            z-index: ${MENU_CONSTANTS.UI.Z_INDEX.DROPDOWN};
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            opacity: 0;
            transform: translateY(-4px);
            transition: opacity ${MENU_CONSTANTS.UI.ANIMATION_DURATION}ms ease, transform ${MENU_CONSTANTS.UI.ANIMATION_DURATION}ms ease;
            font-family: 'Pixel', 'Press Start 2P', monospace;
        `;

        for (const item of this.items) {
            dropdown.appendChild(this.createDropdownItem(item));
        }

        document.body.appendChild(dropdown);
        this.dropdown = dropdown;
        this.isOpen = true;

        // Trigger animation on next frame
        requestAnimationFrame(() => {
            if (this.dropdown) {
                this.dropdown.style.opacity = '1';
                this.dropdown.style.transform = 'translateY(0)';
            }
        });

        // Close on outside click
        this.outsideClickHandler = (e: MouseEvent) => {
            if (
                this.dropdown &&
                !this.dropdown.contains(e.target as Node) &&
                this.menuButton &&
                !this.menuButton.contains(e.target as Node)
            ) {
                this.closeDropdown();
            }
        };
        // Use capture so we get this before most other handlers
        document.addEventListener('click', this.outsideClickHandler, true);
    }

    private closeDropdown(): void {
        if (!this.dropdown) return;

        // Remove outside-click listener
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler, true);
            this.outsideClickHandler = null;
        }

        this.dropdown.style.opacity = '0';
        this.dropdown.style.transform = 'translateY(-4px)';

        const ref = this.dropdown;
        setTimeout(() => {
            ref.remove();
        }, MENU_CONSTANTS.UI.ANIMATION_DURATION);

        this.dropdown = null;
        this.isOpen = false;

        if (this.menuButton) {
            this.menuButton.style.transform = 'scale(1)';
        }
    }

    private createDropdownItem(item: MenuItem): HTMLElement {
        const row = document.createElement('button');
        row.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 10px 16px;
            border: none;
            background: transparent;
            color: #ccc;
            font-size: 13px;
            font-family: inherit;
            cursor: pointer;
            text-align: left;
            transition: background 0.15s, color 0.15s;
        `;

        // Icon container
        const iconWrap = document.createElement('span');
        iconWrap.innerHTML = item.icon;
        iconWrap.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            flex-shrink: 0;
        `;
        // Make inner SVG fill the container
        const svg = iconWrap.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', '18');
            svg.setAttribute('height', '18');
        }

        const label = document.createElement('span');
        label.textContent = item.label;

        row.appendChild(iconWrap);
        row.appendChild(label);

        this.addEventListenerSafely(row, 'mouseover', () => {
            row.style.background = '#2a2a2a';
            row.style.color = '#fff';
        });
        this.addEventListenerSafely(row, 'mouseout', () => {
            row.style.background = 'transparent';
            row.style.color = '#ccc';
        });
        this.addEventListenerSafely(row, 'click', (e: Event) => {
            e.stopPropagation();
            this.closeDropdown();
            item.onClick();
        });

        return row;
    }

    // ── helpers ─────────────────────────────────────────────────────────

    private addEventListenerSafely(element: EventTarget, event: string, handler: EventListener): void {
        try {
            element.addEventListener(event, handler);
            this.eventListeners.push({ element, event, handler });
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.RENDERING,
                { phase: 'MenuManager:addEventListenerSafely', event },
            );
        }
    }

    /**
     * Remove menu UI from the DOM.
     */
    public removeMenuUI(): void {
        this.closeDropdown();

        for (const { element, event, handler } of this.eventListeners) {
            try {
                element.removeEventListener(event, handler);
            } catch (_) { /* swallow */ }
        }
        this.eventListeners = [];

        if (this.menuButton) {
            this.menuButton.remove();
            this.menuButton = null;
        }
    }

    /**
     * Full teardown – removes UI, clears items, resets singleton.
     */
    public cleanup(): void {
        this.removeMenuUI();
        this.items = [];
        MenuManager.instance = null;
    }
}
