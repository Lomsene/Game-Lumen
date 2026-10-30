import { settings } from '../meta/Settings';

/**
 * Input Manager for AETHER: ECLIPSE.
 * Handles Keyboard (WASD, ZQSD, Arrows), Mouse (hold to move towards cursor, right-click dash),
 * and Touchscreen (floating or fixed virtual joystick, touch dash/nova buttons).
 */
export class InputManager {
  private keys: Set<string> = new Set();
  public mousePos: { x: number; y: number } = { x: 0, y: 0 };
  public isMouseDown: boolean = false;
  private dashRequested: boolean = false;
  private supernovaRequested: boolean = false;

  // Touch tracking
  public isTouchDevice: boolean = false;
  private touchOrigin: { x: number; y: number } | null = null;
  private touchCurrent: { x: number; y: number } | null = null;
  private touchIdentifier: number | null = null;

  private joystickBase: HTMLElement | null = null;
  private joystickThumb: HTMLElement | null = null;

  /** Joystick travel radius in CSS px. */
  private readonly maxRadius = 52;
  private readonly deadzone = 7;

  constructor() {
    this.isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    this.initKeyboard();
    this.initMouse();
    this.initTouch();
    this.applyLayout();
    settings.onChange(() => this.applyLayout());
  }

  /** Drops queued dash/nova presses (called when the game state changes). */
  public clearActions() {
    this.dashRequested = false;
    this.supernovaRequested = false;
  }

  private applyLayout() {
    document.body.classList.toggle('left-handed', settings.data.leftHanded);
    document.body.classList.toggle('joystick-fixed', settings.data.joystickMode === 'fixed');
    if (this.isTouchDevice) {
      document.getElementById('mobile-controls')?.classList.remove('hidden');
    }
    this.resetJoystick();
  }

  private initKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.repeat) return;
      if (['Space', 'ShiftLeft', 'ShiftRight', 'KeyE'].includes(e.code)) {
        this.dashRequested = true;
        if (e.code === 'Space') e.preventDefault();
      } else if (['KeyR', 'KeyF'].includes(e.code)) {
        this.supernovaRequested = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.isMouseDown = false;
      this.resetJoystick();
    });
  }

  private initMouse() {
    window.addEventListener('mousemove', (e) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      // Only the game canvas steers the player - never UI buttons or modals
      if ((e.target as HTMLElement)?.id !== 'game-canvas') return;
      if (e.button === 0) {
        this.isMouseDown = true;
      } else if (e.button === 2) {
        e.preventDefault();
        this.dashRequested = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isMouseDown = false;
    });

    window.addEventListener('contextmenu', (e) => {
      if (!(e.target as HTMLElement)?.closest('input, textarea')) e.preventDefault();
    });
  }

  private bindActionButton(id: string, action: () => void) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    }, { passive: false });
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      action();
    });
  }

  private initTouch() {
    this.joystickBase = document.getElementById('touch-joystick-base');
    this.joystickThumb = document.getElementById('touch-joystick-thumb');

    this.bindActionButton('touch-dash-btn', () => (this.dashRequested = true));
    this.bindActionButton('touch-nova-btn', () => (this.supernovaRequested = true));
    document.getElementById('dash-indicator')?.addEventListener('click', () => (this.dashRequested = true));
    document.getElementById('supernova-indicator')?.addEventListener('click', () => (this.supernovaRequested = true));

    window.addEventListener('touchstart', (e) => {
      if (!this.isTouchDevice) {
        this.isTouchDevice = true;
        document.getElementById('mobile-controls')?.classList.remove('hidden');
      }
      // Only start the joystick when touching the game area (not buttons / modals)
      const target = e.target as HTMLElement;
      if (target?.closest('button, .gift-card, .forge-item, .modal-overlay, .screen-overlay')) return;
      if (this.touchIdentifier !== null || e.changedTouches.length === 0) return;

      const touch = e.changedTouches[0];
      const fixed = settings.data.joystickMode === 'fixed';
      if (fixed) {
        // Fixed stick: only the movement half of the screen starts it
        const onLeft = touch.clientX < window.innerWidth / 2;
        if (onLeft === settings.data.leftHanded) return;
      }
      e.preventDefault();

      this.touchIdentifier = touch.identifier;
      this.touchOrigin = fixed ? this.getFixedCenter() : { x: touch.clientX, y: touch.clientY };
      this.touchCurrent = { x: touch.clientX, y: touch.clientY };
      this.showJoystickAt(this.touchOrigin.x, this.touchOrigin.y);
      this.updateThumb();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.touchIdentifier === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchIdentifier) {
          e.preventDefault();
          this.touchCurrent = { x: touch.clientX, y: touch.clientY };
          // Floating stick follows the finger when dragged past its edge
          if (settings.data.joystickMode === 'floating' && this.touchOrigin) {
            const dx = this.touchCurrent.x - this.touchOrigin.x;
            const dy = this.touchCurrent.y - this.touchOrigin.y;
            const dist = Math.hypot(dx, dy);
            const leash = this.maxRadius * 1.6;
            if (dist > leash) {
              this.touchOrigin.x += (dx / dist) * (dist - leash);
              this.touchOrigin.y += (dy / dist) * (dist - leash);
              this.showJoystickAt(this.touchOrigin.x, this.touchOrigin.y);
            }
          }
          this.updateThumb();
          break;
        }
      }
    }, { passive: false });

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchIdentifier) {
          this.resetJoystick();
          break;
        }
      }
    };
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  }

  private getFixedCenter(): { x: number; y: number } {
    const x = settings.data.leftHanded ? window.innerWidth - 120 : 120;
    return { x, y: window.innerHeight - 115 };
  }

  private showJoystickAt(x: number, y: number) {
    if (!this.joystickBase) return;
    this.joystickBase.classList.remove('hidden');
    this.joystickBase.style.left = `${x}px`;
    this.joystickBase.style.top = `${y}px`;
  }

  private updateThumb() {
    if (!this.touchOrigin || !this.touchCurrent || !this.joystickThumb) return;
    const dx = this.touchCurrent.x - this.touchOrigin.x;
    const dy = this.touchCurrent.y - this.touchOrigin.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.maxRadius);
    const tx = dist > 0 ? (dx / dist) * clamped : 0;
    const ty = dist > 0 ? (dy / dist) * clamped : 0;
    this.joystickThumb.style.transform = `translate(${tx}px, ${ty}px)`;
  }

  private resetJoystick() {
    this.touchIdentifier = null;
    this.touchOrigin = null;
    this.touchCurrent = null;
    if (this.joystickThumb) this.joystickThumb.style.transform = 'translate(0px, 0px)';
    if (!this.joystickBase) return;
    if (settings.data.joystickMode === 'fixed' && this.isTouchDevice) {
      const c = this.getFixedCenter();
      this.showJoystickAt(c.x, c.y);
    } else {
      this.joystickBase.classList.add('hidden');
    }
  }

  /** Returns a 2D movement vector with length 0..1. */
  public getMovementVector(playerScreenPos?: { x: number; y: number }): { x: number; y: number } {
    let dx = 0;
    let dy = 0;

    if (this.keys.has('KeyW') || this.keys.has('KeyZ') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
    if (this.keys.has('KeyA') || this.keys.has('KeyQ') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;

    if (this.touchOrigin && this.touchCurrent) {
      const tdx = this.touchCurrent.x - this.touchOrigin.x;
      const tdy = this.touchCurrent.y - this.touchOrigin.y;
      const dist = Math.hypot(tdx, tdy);
      if (dist > this.deadzone) {
        // Remap so full speed is reached a bit before the edge (easier on small screens)
        const strength = Math.min(1, (dist - this.deadzone) / (this.maxRadius * 0.8 - this.deadzone));
        return { x: (tdx / dist) * strength, y: (tdy / dist) * strength };
      }
    }

    if (this.isMouseDown && playerScreenPos && dx === 0 && dy === 0) {
      const mdx = this.mousePos.x - playerScreenPos.x;
      const mdy = this.mousePos.y - playerScreenPos.y;
      const dist = Math.hypot(mdx, mdy);
      if (dist > 25) return { x: mdx / dist, y: mdy / dist };
    }

    const len = Math.hypot(dx, dy);
    if (len > 0) return { x: dx / len, y: dy / len };
    return { x: 0, y: 0 };
  }

  public consumeDash(): boolean {
    const v = this.dashRequested;
    this.dashRequested = false;
    return v;
  }

  public consumeSupernova(): boolean {
    const v = this.supernovaRequested;
    this.supernovaRequested = false;
    return v;
  }
}
