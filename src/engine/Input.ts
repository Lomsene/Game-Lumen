/**
 * Input Manager for LUMEN.
 * Handles Keyboard (WASD, ZQSD, Arrows), Mouse (move to cursor, right-click dash),
 * and Touchscreen (drag anywhere, virtual joystick, touch dash button).
 */
export class InputManager {
  private keys: Set<string> = new Set();
  public mousePos: { x: number; y: number } = { x: 0, y: 0 };
  public isMouseDown: boolean = false;
  private dashRequested: boolean = false;

  // Touch tracking
  public isTouchDevice: boolean = false;
  private touchOrigin: { x: number; y: number } | null = null;
  private touchCurrent: { x: number; y: number } | null = null;
  private touchIdentifier: number | null = null;

  // DOM elements for visual feedback
  private joystickBase: HTMLElement | null = null;
  private joystickThumb: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor() {
    this.initKeyboard();
    this.initMouse();
    this.initTouch();
  }

  public setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  private initKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['Space', 'ShiftLeft', 'ShiftRight', 'KeyE'].includes(e.code)) {
        this.dashRequested = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Reset keys if window loses focus
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.isMouseDown = false;
      this.touchOrigin = null;
      this.touchCurrent = null;
    });
  }

  private initMouse() {
    window.addEventListener('mousemove', (e) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      // Ignore if clicking on UI buttons
      if ((e.target as HTMLElement)?.closest('button, .gift-card, .forge-item')) return;

      if (e.button === 0) {
        this.isMouseDown = true;
      } else if (e.button === 2) {
        e.preventDefault();
        this.dashRequested = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    });

    window.addEventListener('contextmenu', (e) => {
      // Prevent browser right click context menu during game
      if (!(e.target as HTMLElement)?.closest('input, textarea')) {
        e.preventDefault();
      }
    });
  }

  private initTouch() {
    this.joystickBase = document.getElementById('touch-joystick-base');
    this.joystickThumb = document.getElementById('touch-joystick-thumb');
    const touchDashBtn = document.getElementById('touch-dash-btn');

    if (touchDashBtn) {
      touchDashBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dashRequested = true;
      });
      touchDashBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.dashRequested = true;
      });
    }

    const dashIndicator = document.getElementById('dash-indicator');
    if (dashIndicator) {
      dashIndicator.addEventListener('click', () => {
        this.dashRequested = true;
      });
    }

    window.addEventListener('touchstart', (e) => {
      this.isTouchDevice = true;
      const mobileControls = document.getElementById('mobile-controls');
      if (mobileControls) mobileControls.classList.remove('hidden');

      // Check if touch is on an active interactive element
      if ((e.target as HTMLElement)?.closest('button, .gift-card, .forge-item, .pause-icon-btn')) {
        return;
      }

      // First touch starts joystick
      if (this.touchIdentifier === null && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        this.touchIdentifier = touch.identifier;
        this.touchOrigin = { x: touch.clientX, y: touch.clientY };
        this.touchCurrent = { x: touch.clientX, y: touch.clientY };

        if (this.joystickBase) {
          this.joystickBase.classList.remove('hidden');
          this.joystickBase.style.left = `${touch.clientX}px`;
          this.joystickBase.style.top = `${touch.clientY}px`;
        }
        if (this.joystickThumb) {
          this.joystickThumb.style.transform = 'translate(0px, 0px)';
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.touchIdentifier === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchIdentifier) {
          this.touchCurrent = { x: touch.clientX, y: touch.clientY };
          if (this.touchOrigin && this.joystickThumb) {
            const dx = this.touchCurrent.x - this.touchOrigin.x;
            const dy = this.touchCurrent.y - this.touchOrigin.y;
            const dist = Math.hypot(dx, dy);
            const maxRadius = 45;
            const angle = Math.atan2(dy, dx);
            const clampedDist = Math.min(dist, maxRadius);
            const tx = Math.cos(angle) * clampedDist;
            const ty = Math.sin(angle) * clampedDist;
            this.joystickThumb.style.transform = `translate(${tx}px, ${ty}px)`;
          }
          break;
        }
      }
    }, { passive: false });

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchIdentifier) {
          this.touchIdentifier = null;
          this.touchOrigin = null;
          this.touchCurrent = null;
          if (this.joystickBase) {
            this.joystickBase.classList.add('hidden');
          }
          break;
        }
      }
    };

    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  }

  /**
   * Returns normalized 2D movement vector [-1..1]
   */
  public getMovementVector(playerScreenPos?: { x: number; y: number }): { x: number; y: number } {
    let dx = 0;
    let dy = 0;

    // 1. Keyboard (WASD, ZQSD, Arrow keys)
    if (this.keys.has('KeyW') || this.keys.has('KeyZ') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
    if (this.keys.has('KeyA') || this.keys.has('KeyQ') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;

    // 2. Touch dragging
    if (this.touchOrigin && this.touchCurrent) {
      const tdx = this.touchCurrent.x - this.touchOrigin.x;
      const tdy = this.touchCurrent.y - this.touchOrigin.y;
      const dist = Math.hypot(tdx, tdy);
      const deadzone = 8;
      if (dist > deadzone) {
        const strength = Math.min(dist / 45, 1);
        dx = (tdx / dist) * strength;
        dy = (tdy / dist) * strength;
        return { x: dx, y: dy };
      }
    }

    // 3. Mouse hold to move towards cursor
    if (this.isMouseDown && playerScreenPos && dx === 0 && dy === 0) {
      const mdx = this.mousePos.x - playerScreenPos.x;
      const mdy = this.mousePos.y - playerScreenPos.y;
      const dist = Math.hypot(mdx, mdy);
      if (dist > 25) {
        dx = mdx / dist;
        dy = mdy / dist;
        return { x: dx, y: dy };
      }
    }

    // Normalize keyboard vector
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      return { x: dx / len, y: dy / len };
    }

    return { x: 0, y: 0 };
  }

  public consumeDash(): boolean {
    if (this.dashRequested) {
      this.dashRequested = false;
      return true;
    }
    return false;
  }
}
