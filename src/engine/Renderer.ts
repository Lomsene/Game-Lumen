import { Player } from '../entities/Player';
import { Enemy, EnemyProjectile, MortarZone, VoidObelisk, ShadowRift, SolarBurnZone } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Drop } from '../entities/Drop';
import { Weapon, PlayerProjectile } from '../weapons/Weapon';
import { ParticleSystem } from './Particle';
import { BeaconWeapon, RadianceWeapon, OrbitersWeapon, PulseWeapon } from '../weapons/WeaponRegistry';
import { drawGlow, glowSettings } from './GlowCache';
import { settings, QualityLevel } from '../meta/Settings';
import { PostFX, LightBuffer, FxProfile, parseColor } from './PostFX';
import { PLAYER_SKINS } from '../meta/Forge';

type ConcreteQuality = Exclude<QualityLevel, 'auto'>;

interface QualityProfile {
  dprCap: number;
  maxParticles: number;
  density: number;
  stars: number;
  nebulas: boolean;
  glows: boolean;
  fx: FxProfile;
}

const QUALITY: Record<ConcreteQuality, QualityProfile> = {
  high: { dprCap: 2.0, maxParticles: 900, density: 1, stars: 240, nebulas: true, glows: true, fx: { lightScale: 0.5, wideBloom: true, bloomStrength: 1 } },
  medium: { dprCap: 1.6, maxParticles: 600, density: 0.8, stars: 150, nebulas: true, glows: true, fx: { lightScale: 0.35, wideBloom: true, bloomStrength: 0.95 } },
  low: { dprCap: 1.15, maxParticles: 300, density: 0.5, stars: 80, nebulas: false, glows: false, fx: { lightScale: 0.25, wideBloom: false, bloomStrength: 0.8 } }
};

const WHITE = [1, 1, 1] as const;
const GOLD = parseColor('#fbbf24');
const ORANGE = parseColor('#f97316');
const VIOLET = parseColor('#a855f7');
const RED = parseColor('#ef4444');

const QUALITY_ORDER: ConcreteQuality[] = ['low', 'medium', 'high'];

export class GameRenderer {
  public canvas: HTMLCanvasElement;
  /** Scene target (offscreen when WebGL lighting is active). */
  public ctx: CanvasRenderingContext2D;
  /** Unlit top layer: floating texts and edge arrows stay crisp above the lighting. */
  private overlayCtx: CanvasRenderingContext2D;
  private sceneCanvas: HTMLCanvasElement;
  private fx: PostFX | null = null;
  private lights = new LightBuffer(900);
  private time = 0;
  private hitPulse = 0;
  private flashAmount = 0;
  private flashRgb: [number, number, number] = [1, 1, 1];
  public cameraX: number = 0;
  public cameraY: number = 0;

  // Logical CSS viewport dimensions & DPR scaling
  public viewWidth: number = window.innerWidth;
  public viewHeight: number = window.innerHeight;
  public dpr: number = 1;

  // Screen shake
  public shakeDuration: number = 0;
  public shakeIntensity: number = 0;

  // Quality & adaptive resolution
  public quality: ConcreteQuality = 'high';
  private particlesRef: ParticleSystem | null = null;
  private frameTimeAvg: number = 16.7;
  private adaptCooldown: number = 3;
  private goodFrameTime: number = 0;
  public fps: number = 60;

  // Parallax cosmic stars & nebulas
  private stars: Array<{ x: number; y: number; size: number; alpha: number; layer: number; color: string }> = [];
  private nebulas: Array<{ x: number; y: number; radius: number; color: string; alpha: number }> = [];
  private vignetteCanvas: HTMLCanvasElement | null = null;

  private readonly isMobile: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // WebGL lighting: the scene renders offscreen, a WebGL canvas below the overlay shows the lit result
    const fxCanvas = document.createElement('canvas');
    fxCanvas.id = 'fx-canvas';
    this.fx = PostFX.create(fxCanvas);
    if (this.fx) {
      canvas.parentElement?.insertBefore(fxCanvas, canvas);
      this.sceneCanvas = document.createElement('canvas');
      const sceneCtx = this.sceneCanvas.getContext('2d', { alpha: true });
      const overlay = canvas.getContext('2d', { alpha: true });
      if (!sceneCtx || !overlay) throw new Error('Failed to get 2D context');
      this.ctx = sceneCtx;
      this.overlayCtx = overlay;
      canvas.classList.add('overlay-layer');
    } else {
      // Note: no `desynchronized` - it causes tearing on many Android devices
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Failed to get 2D context');
      this.sceneCanvas = canvas;
      this.ctx = context;
      this.overlayCtx = context;
    }

    this.isMobile = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.quality = this.resolveQuality(settings.data.quality);
    settings.onChange((s) => this.setQuality(this.resolveQuality(s.quality)));

    this.resize();
    this.initNebulas();
  }

  private resolveQuality(q: QualityLevel): ConcreteQuality {
    if (q !== 'auto') return q;
    // Auto starts at full quality everywhere and steps down only if frames are actually slow
    return 'high';
  }

  /** True when the WebGL lighting pipeline is in use. */
  public get lightingActive(): boolean {
    return !!this.fx && !this.fx.lost;
  }

  /** Brief chromatic aberration after the player is hit. */
  public triggerHitPulse(strength: number = 1) {
    this.hitPulse = Math.max(this.hitPulse, strength);
  }

  /** Full-screen color flash (supernova, boss kill, obelisk). */
  public flash(color: string, strength: number) {
    this.flashRgb = parseColor(color);
    this.flashAmount = Math.max(this.flashAmount, strength);
  }

  public attachParticles(particles: ParticleSystem) {
    this.particlesRef = particles;
    this.applyQualityToParticles();
  }

  public setQuality(q: ConcreteQuality) {
    if (q === this.quality && this.stars.length > 0) return;
    this.quality = q;
    this.resize();
    this.applyQualityToParticles();
  }

  private applyQualityToParticles() {
    const prof = QUALITY[this.quality];
    // With WebGL lighting the light map + bloom replace the Canvas2D glow sprites
    glowSettings.enabled = prof.glows && !this.lightingActive;
    Enemy.flashFill = this.lightingActive ? 'rgba(255, 255, 255, 0.38)' : '#ffffff';
    this.fx?.setProfile(prof.fx);
    Enemy.detail = this.quality === 'high' ? 2 : this.quality === 'medium' ? 1 : 0;
    if (this.particlesRef) {
      this.particlesRef.maxParticles = prof.maxParticles;
      this.particlesRef.density = prof.density;
    }
  }

  /**
   * Called every frame with the real frame time. In 'auto' mode the renderer steps the
   * quality down when the device can't keep ~50 FPS and back up when it has headroom.
   */
  public reportFrameTime(ms: number) {
    this.frameTimeAvg += (Math.min(ms, 100) - this.frameTimeAvg) * 0.05;
    this.fps = 1000 / this.frameTimeAvg;
    if (settings.data.quality !== 'auto') return;

    this.adaptCooldown -= ms / 1000;
    if (this.adaptCooldown > 0) return;

    const idx = QUALITY_ORDER.indexOf(this.quality);
    if (this.frameTimeAvg > 21 && idx > 0) {
      this.setQuality(QUALITY_ORDER[idx - 1]);
      this.adaptCooldown = 4;
      this.goodFrameTime = 0;
    } else if (this.frameTimeAvg < 12.5 && idx < QUALITY_ORDER.length - 1) {
      // Only step up after a long stretch of headroom to avoid flip-flopping
      this.goodFrameTime += ms / 1000;
      if (this.goodFrameTime > 12) {
        this.setQuality(QUALITY_ORDER[idx + 1]);
        this.adaptCooldown = 6;
        this.goodFrameTime = 0;
      }
    } else {
      this.goodFrameTime = 0;
    }
  }

  public resize() {
    this.viewWidth = window.innerWidth;
    this.viewHeight = window.innerHeight;
    const prof = QUALITY[this.quality];
    this.dpr = Math.min(prof.dprCap, Math.max(1, window.devicePixelRatio || 1));

    const pw = Math.round(this.viewWidth * this.dpr);
    const ph = Math.round(this.viewHeight * this.dpr);
    for (const c of [this.canvas, this.sceneCanvas]) {
      c.width = pw;
      c.height = ph;
    }
    this.canvas.style.width = `${this.viewWidth}px`;
    this.canvas.style.height = `${this.viewHeight}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.fx?.resize(pw, ph, this.viewWidth, this.viewHeight);

    if (this.particlesRef) {
      this.particlesRef.viewW = this.viewWidth;
      this.particlesRef.viewH = this.viewHeight;
    }
    this.initStars(prof.stars);
    this.buildVignette();
  }

  private initStars(count: number) {
    this.stars = [];
    const palette = ['#e2e8f0', '#38bdf8', '#818cf8', '#f43f5e'];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * 4400 - 2200,
        y: Math.random() * 4400 - 2200,
        size: Math.random() * 1.6 + 0.5,
        alpha: Math.random() * 0.45 + 0.1,
        layer: Math.random() * 0.35 + 0.1,
        color: palette[Math.floor(Math.random() * palette.length)]
      });
    }
  }

  private initNebulas() {
    this.nebulas = [
      { x: -600, y: -500, radius: 750, color: '#1e1b4b', alpha: 0.32 },
      { x: 700, y: -400, radius: 680, color: '#0c4a6e', alpha: 0.25 },
      { x: 200, y: 650, radius: 820, color: '#3b0764', alpha: 0.26 },
      { x: -750, y: 500, radius: 640, color: '#0f172a', alpha: 0.35 }
    ];
  }

  /** Red low-light vignette, rendered once per resize instead of every frame. */
  private buildVignette() {
    const w = Math.max(1, Math.round(this.viewWidth / 4));
    const h = Math.max(1, Math.round(this.viewHeight / 4));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    if (g) {
      const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
      vig.addColorStop(0, 'rgba(225, 29, 72, 0)');
      vig.addColorStop(1, 'rgba(225, 29, 72, 1)');
      g.fillStyle = vig;
      g.fillRect(0, 0, w, h);
    }
    this.vignetteCanvas = c;
  }

  public triggerScreenShake(intensity: number = 8, duration: number = 0.25) {
    if (!settings.data.screenShake) return;
    // Never let a weak shake cancel a stronger one that is still running
    if (this.shakeDuration > 0 && intensity < this.shakeIntensity) return;
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  public render(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    drops: Drop[],
    weapons: Weapon[],
    playerProjectiles: PlayerProjectile[],
    enemyProjectiles: EnemyProjectile[],
    mortarZones: MortarZone[],
    particles: ParticleSystem,
    obelisks: VoidObelisk[] = [],
    shadowRifts: ShadowRift[] = [],
    solarZones: SolarBurnZone[] = []
  ) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const w = this.viewWidth;
    const h = this.viewHeight;
    const prof = QUALITY[this.quality];
    const lit = this.lightingActive;
    this.time += dt;
    this.hitPulse = Math.max(0, this.hitPulse - dt * 3.2);
    this.flashAmount = Math.max(0, this.flashAmount - dt * 2.2);

    // Frame-rate independent camera smoothing
    const targetCamX = player.x - w / 2;
    const targetCamY = player.y - h / 2;
    const camLerp = 1 - Math.pow(0.0005, dt);
    this.cameraX += (targetCamX - this.cameraX) * camLerp;
    this.cameraY += (targetCamY - this.cameraY) * camLerp;

    let offsetX = 0;
    let offsetY = 0;
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      offsetX = (Math.random() - 0.5) * this.shakeIntensity;
      offsetY = (Math.random() - 0.5) * this.shakeIntensity;
    }
    const camX = this.cameraX + offsetX;
    const camY = this.cameraY + offsetY;

    // 1. Deep space outer void (with lighting the shader draws nebula + stars behind a transparent scene)
    if (lit) {
      ctx.clearRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#03050c';
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Distant nebulas (cached glow sprites) & parallax stars
    if (prof.nebulas && !lit) {
      for (const neb of this.nebulas) {
        const nx = neb.x - camX * 0.35 + w * 0.5;
        const ny = neb.y - camY * 0.35 + h * 0.5;
        if (nx + neb.radius < 0 || nx - neb.radius > w || ny + neb.radius < 0 || ny - neb.radius > h) continue;
        ctx.globalAlpha = neb.alpha;
        drawGlow(ctx, nx, ny, neb.radius, neb.color);
      }
    }
    for (const star of lit ? [] : this.stars) {
      const sx = ((star.x - camX * star.layer) % w + w) % w;
      const sy = ((star.y - camY * star.layer) % h + h) % h;
      ctx.fillStyle = star.color;
      ctx.globalAlpha = star.alpha * 0.55;
      ctx.fillRect(sx, sy, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    // 3. Bounded circular arena
    const arenaX = -camX;
    const arenaY = -camY;
    const arenaR = Player.ARENA_RADIUS;
    // Is the barrier (and therefore the outside void) on screen at all?
    const halfDiag = Math.hypot(w, h) / 2;
    const camCenterDist = Math.hypot(camX + w / 2, camY + h / 2);
    const edgeVisible = camCenterDist + halfDiag > arenaR;

    // Lit mode: a thinner floor so the nebula glimmers through the arena
    ctx.fillStyle = lit ? 'rgba(4, 7, 16, 0.5)' : 'rgba(5, 9, 20, 0.72)';
    if (edgeVisible) {
      ctx.beginPath();
      ctx.arc(arenaX, arenaY, arenaR, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, w, h);
    }

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.lineWidth = 1;
    for (const r of [600, 1200, 1800]) {
      if (Math.abs(camCenterDist - r) > halfDiag) continue;
      ctx.beginPath();
      ctx.arc(arenaX, arenaY, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (edgeVisible) {
      // Neon perimeter barrier: wide faint stroke + sharp core instead of shadowBlur
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(arenaX, arenaY, arenaR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.12)';
      ctx.lineWidth = 18;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // 3d. Void Obelisks (capture zones) & edge pointers
    for (const ob of obelisks) {
      const sx = ob.x - camX;
      const sy = ob.y - camY;
      const progress = Math.min(1, ob.charge / ob.maxCharge);
      const onScreen = sx > -ob.radius && sx < w + ob.radius && sy > -ob.radius && sy < h + ob.radius;

      if (onScreen) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = progress > 0 ? '#fbbf24' : '#a855f7';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(sx, sy, ob.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (progress > 0) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(sx, sy, ob.radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
          ctx.stroke();
        }

        ctx.globalAlpha = 0.6;
        drawGlow(ctx, sx, sy, 34, '#a855f7');
        ctx.globalAlpha = 1;

        ctx.translate(sx, sy);
        ctx.rotate(ob.animTimer * 1.4);
        ctx.strokeStyle = '#c084fc';
        ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(14, 0);
        ctx.lineTo(0, 18);
        ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillStyle = progress > 0 ? '#fbbf24' : '#c084fc';
        ctx.textAlign = 'center';
        ctx.fillText(progress > 0 ? `OBELISK ${Math.floor(progress * 100)}%` : 'LEEREN-OBELISK', sx, sy - 26);
      } else {
        this.pendingArrows.push({ x: sx, y: sy, color: '#c084fc', scale: 1 });
      }
    }

    // 4. Drops (flat, no glow - frustum culled)
    for (const drop of drops) {
      const sx = drop.x - camX;
      const sy = drop.y - camY;
      if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;
      drop.render(ctx, camX, camY);
    }

    // 4b. Shadow Rifts
    for (const rift of shadowRifts) {
      const sx = rift.x - camX;
      const sy = rift.y - camY;
      if (sx < -rift.radius || sx > w + rift.radius || sy < -rift.radius || sy > h + rift.radius) continue;
      const fade = Math.min(1, Math.min(rift.life, rift.maxLife - rift.life));

      ctx.save();
      ctx.globalAlpha = fade * 0.75;
      drawGlow(ctx, sx, sy, rift.radius * 1.1, '#581c87');
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(2, 1, 8, 0.85)';
      ctx.beginPath();
      ctx.arc(sx, sy, rift.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(sx, sy);
      ctx.rotate(-rift.animTimer * 1.8);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, rift.radius * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4c. Solar Burn Zones (Flare weapon)
    for (const sz of solarZones) {
      const sx = sz.x - camX;
      const sy = sz.y - camY;
      if (sx < -sz.radius || sx > w + sz.radius || sy < -sz.radius || sy > h + sz.radius) continue;
      const alpha = Math.min(1, (sz.maxLife - sz.life) / 0.8);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.45;
      drawGlow(ctx, sx, sy, sz.radius, '#f97316');
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(sx, sy, sz.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Mortar danger zones (clear telegraph: shrinking ring shows time to impact)
    for (const mz of mortarZones) {
      const progress = mz.timer / mz.maxTime;
      const sx = mz.x - camX;
      const sy = mz.y - camY;
      ctx.save();
      ctx.fillStyle = `rgba(239, 68, 68, ${0.12 + progress * 0.28})`;
      ctx.beginPath();
      ctx.arc(sx, sy, mz.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.strokeStyle = '#f59e0b';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(2, mz.radius * (1 - progress)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Weapon visuals
    for (const wpn of weapons) {
      if (wpn instanceof BeaconWeapon) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (wpn.beacons.length >= 2) {
          ctx.strokeStyle = wpn.isEvolved ? '#fbbf24' : 'rgba(251, 191, 36, 0.65)';
          ctx.lineWidth = wpn.isEvolved ? 2.6 : 1.6;
          ctx.beginPath();
          for (let i = 0; i < wpn.beacons.length; i++) {
            for (let j = i + 1; j < wpn.beacons.length; j++) {
              ctx.moveTo(wpn.beacons[i].x - camX, wpn.beacons[i].y - camY);
              ctx.lineTo(wpn.beacons[j].x - camX, wpn.beacons[j].y - camY);
            }
          }
          ctx.stroke();
        }
        for (const b of wpn.beacons) {
          const sx = b.x - camX;
          const sy = b.y - camY;
          if (glowSettings.enabled) drawGlow(ctx, sx, sy, 20, '#fbbf24', 0.7);
          ctx.fillStyle = '#fde68a';
          ctx.beginPath();
          ctx.arc(sx, sy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (wpn instanceof RadianceWeapon) {
        const angles = wpn.getAngles();
        const len = player.getLightRadius();
        const heat = wpn.thermalCharge;
        const color = heat > 0.6 ? '#fbbf24' : '#00f3ff';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const a of angles) {
          ctx.beginPath();
          ctx.moveTo(player.x - camX, player.y - camY);
          ctx.lineTo(player.x + Math.cos(a) * len - camX, player.y + Math.sin(a) * len - camY);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.25;
          ctx.lineWidth = (wpn.isEvolved ? 14 : 10) + heat * 8;
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.lineWidth = (wpn.isEvolved ? 4.5 : 3) + heat * 3.5;
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.4 + heat * 1.2;
          ctx.stroke();
        }
        ctx.restore();
      } else if (wpn instanceof OrbitersWeapon) {
        const color = wpn.isEvolved ? '#f59e0b' : '#38bdf8';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const pos of wpn.currentOrbPositions) {
          const ox = pos.x - camX;
          const oy = pos.y - camY;
          if (glowSettings.enabled) drawGlow(ctx, ox, oy, wpn.isEvolved ? 20 : 15, color, 0.8);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(ox, oy, wpn.isEvolved ? 7.5 : 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (wpn instanceof PulseWeapon) {
        wpn.render(ctx, camX, camY, player);
      }

      if (wpn.render && !(wpn instanceof PulseWeapon)) {
        wpn.render(ctx, camX, camY);
      }
    }

    // 7. Player projectiles (shape per weapon - no tails on homing shots)
    if (playerProjectiles.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const p of playerProjectiles) {
        const sx = p.x - camX;
        const sy = p.y - camY;
        if (sx < -35 || sx > w + 35 || sy < -35 || sy > h + 35) continue;
        this.drawProjectile(ctx, p, sx, sy);
      }
      ctx.restore();
    }

    // 8. Enemies (frustum culled)
    for (const enemy of enemies) {
      const sx = enemy.x - camX;
      const sy = enemy.y - camY;
      if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue;
      enemy.render(ctx, camX, camY);
    }

    // 9. Boss (+ off-screen pointer)
    if (boss && !boss.isDefeated) {
      const bx = boss.x - camX;
      const by = boss.y - camY;
      if (bx > -boss.radius * 2 && bx < w + boss.radius * 2 && by > -boss.radius * 2 && by < h + boss.radius * 2) {
        boss.render(ctx, camX, camY);
      } else {
        this.pendingArrows.push({ x: bx, y: by, color: boss.color, scale: 1.6 });
      }
    }

    // 10. Enemy projectiles (bright core + dark rim so they read against glows)
    if (enemyProjectiles.length > 0) {
      ctx.save();
      for (const ep of enemyProjectiles) {
        const sx = ep.x - camX;
        const sy = ep.y - camY;
        if (sx < -25 || sx > w + 25 || sy < -25 || sy > h + 25) continue;
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = ep.color;
        ctx.beginPath();
        ctx.arc(sx, sy, ep.radius * 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, ep.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe4e6';
        ctx.beginPath();
        ctx.arc(sx, sy, ep.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 11. Player
    player.render(ctx, camX, camY);

    // 12. Light radius glow & dashed attack perimeter
    const lightRadius = player.getLightRadius();
    const psx = player.x - camX;
    const psy = player.y - camY;
    ctx.save();
    if (glowSettings.enabled) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.1;
      drawGlow(ctx, psx, psy, lightRadius, '#38bdf8');
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(psx, psy, lightRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 13. Outer void mask beyond the arena barrier (only when visible)
    if (edgeVisible) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(arenaX, arenaY, arenaR, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(2, 4, 10, 0.88)';
      ctx.fill();
      ctx.restore();
    }

    // 14. Particles & shockwaves
    particles.renderEffects(ctx, camX, camY);

    const lightPct = player.light / player.maxLight;
    const danger = lightPct < 0.32 ? (1 - lightPct / 0.32) * (0.75 + Math.sin(this.time * 8) * 0.25) : 0;

    if (lit && this.fx) {
      this.collectLights(player, enemies, boss, drops, weapons, playerProjectiles, enemyProjectiles, mortarZones, particles, obelisks, solarZones, camX, camY);
      this.fx.render(this.sceneCanvas, this.lights, {
        camX,
        camY,
        time: this.time,
        // Unlit areas get darker as your light fades - the arena closes in on you
        ambient: 0.32 + 0.28 * Math.min(1, lightPct),
        danger: danger * 0.55,
        hit: this.hitPulse,
        flash: this.flashAmount * 0.55,
        flashColor: this.flashRgb
      });
      const o = this.overlayCtx;
      o.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      o.clearRect(0, 0, w, h);
    } else if (danger > 0 && this.vignetteCanvas) {
      // 15. Low-light crimson danger vignette (pre-rendered)
      ctx.globalAlpha = Math.max(0, Math.min(0.6, danger * 0.4));
      ctx.drawImage(this.vignetteCanvas, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    // 16. Unlit overlay: floating combat text & off-screen pointers
    particles.renderTexts(this.overlayCtx, camX, camY);
    for (const arrow of this.pendingArrows) this.drawEdgeArrow(arrow.x, arrow.y, arrow.color, arrow.scale);
    this.pendingArrows.length = 0;
  }

  private pendingArrows: Array<{ x: number; y: number; color: string; scale: number }> = [];

  /** Gathers every light source of the frame (screen space) for the WebGL light map. */
  private collectLights(
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    drops: Drop[],
    weapons: Weapon[],
    playerProjectiles: PlayerProjectile[],
    enemyProjectiles: EnemyProjectile[],
    mortarZones: MortarZone[],
    particles: ParticleSystem,
    obelisks: VoidObelisk[],
    solarZones: SolarBurnZone[],
    camX: number,
    camY: number
  ) {
    const L = this.lights;
    L.clear();
    const w = this.viewWidth;
    const h = this.viewHeight;
    const visible = (x: number, y: number, r: number) => x > -r && x < w + r && y > -r && y < h + r;

    // Player: wide aura sized to the light radius plus a hot core (gentle flicker)
    const psx = player.x - camX;
    const psy = player.y - camY;
    const skin = PLAYER_SKINS[player.skinId] ?? PLAYER_SKINS.cyan;
    const pct = Math.max(0, Math.min(1, player.light / player.maxLight));
    const flicker = 0.94 + Math.sin(this.time * 9.1) * 0.03 + Math.sin(this.time * 23.7) * 0.03;
    const auraColor = player.overdriveTimer > 0 ? GOLD : skin.ringStyle === 'prismatic' ? hueRgb(this.time * 60) : parseColor(skin.primaryColor);
    L.push(psx, psy, player.getLightRadius() * 1.3, auraColor, (0.42 + 0.5 * pct) * flicker);
    L.push(psx, psy, 64, WHITE, 0.4 * flicker);

    // Bosses & enemies glow in their own color
    if (boss && !boss.isDefeated) {
      const bx = boss.x - camX;
      const by = boss.y - camY;
      if (visible(bx, by, boss.radius * 6)) L.push(bx, by, boss.radius * 5.5, parseColor(boss.color), boss.isCharging ? 1.1 : 0.75);
    }
    for (const e of enemies) {
      const ex = e.x - camX;
      const ey = e.y - camY;
      if (!visible(ex, ey, 80)) continue;
      L.push(ex, ey, e.radius * (e.isElite ? 4.5 : 3.2), parseColor(e.color), e.isElite ? 0.5 : 0.24);
    }

    // Shots
    for (const p of playerProjectiles) {
      const x = p.x - camX;
      const y = p.y - camY;
      if (visible(x, y, 40)) L.push(x, y, Math.max(26, p.radius * 8), parseColor(p.color), 0.5);
    }
    for (const ep of enemyProjectiles) {
      const x = ep.x - camX;
      const y = ep.y - camY;
      if (visible(x, y, 40)) L.push(x, y, Math.max(24, ep.radius * 7), parseColor(ep.color), 0.55);
    }

    // Pickups
    for (const d of drops) {
      const x = d.x - camX;
      const y = d.y - camY;
      if (!visible(x, y, 50)) continue;
      const big = d.size === 'big';
      L.push(x, y, big ? 55 : 30, parseColor(d.color), big ? 0.55 : 0.3);
    }

    // Zones & world objects
    for (const sz of solarZones) {
      const x = sz.x - camX;
      const y = sz.y - camY;
      if (visible(x, y, sz.radius * 2)) L.push(x, y, sz.radius * 1.8, ORANGE, 0.75 * Math.min(1, (sz.maxLife - sz.life) / 0.8));
    }
    for (const mz of mortarZones) {
      const x = mz.x - camX;
      const y = mz.y - camY;
      if (visible(x, y, mz.radius * 2)) L.push(x, y, mz.radius * 1.4, RED, 0.25 + (mz.timer / mz.maxTime) * 0.55);
    }
    for (const ob of obelisks) {
      const x = ob.x - camX;
      const y = ob.y - camY;
      const prog = Math.min(1, ob.charge / ob.maxCharge);
      if (visible(x, y, ob.radius * 2)) L.push(x, y, ob.radius * 1.6, prog > 0 ? GOLD : VIOLET, 0.45 + prog * 0.5 + Math.sin(this.time * 3) * 0.05);
    }

    // Weapon emitters
    for (const wpn of weapons) {
      if (wpn instanceof BeaconWeapon) {
        for (const b of wpn.beacons) L.push(b.x - camX, b.y - camY, 80, GOLD, 0.6);
      } else if (wpn instanceof OrbitersWeapon) {
        const c = parseColor(wpn.isEvolved ? '#f59e0b' : '#38bdf8');
        for (const o of wpn.currentOrbPositions) L.push(o.x - camX, o.y - camY, 46, c, 0.55);
      } else if (wpn instanceof RadianceWeapon) {
        const len = player.getLightRadius();
        const c = parseColor(wpn.thermalCharge > 0.6 ? '#fbbf24' : '#00f3ff');
        for (const a of wpn.getAngles()) {
          for (let t = 0.2; t <= 1.01; t += 0.2) {
            L.push(psx + Math.cos(a) * len * t, psy + Math.sin(a) * len * t, 44, c, 0.16 + wpn.thermalCharge * 0.16);
          }
        }
      }
    }

    // Explosions & shockwaves flash the surroundings
    for (const sw of particles.shockwaves) {
      const x = sw.x - camX;
      const y = sw.y - camY;
      const r = sw.radius * 1.2 + 30;
      if (!visible(x, y, r)) continue;
      const fade = 1 - sw.life / sw.maxLife;
      // Small hit shockwaves only flicker; big blasts (supernova, boss) light up the arena
      const strength = sw.maxRadius < 100 ? 0.22 : Math.min(1, 0.3 + sw.width * 0.08);
      L.push(x, y, r, parseColor(sw.color), fade * fade * strength);
    }
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, p: PlayerProjectile, sx: number, sy: number) {
    const shape = p.shape ?? 'orb';
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;

    if (shape === 'star') {
      // Sparks: spinning 4-point star with a white core - no tail
      p.spin = (p.spin ?? 0) + 0.25;
      const r = p.radius * 1.5;
      const inner = r * 0.38;
      if (glowSettings.enabled) {
        ctx.globalAlpha = 0.45;
        drawGlow(ctx, sx, sy, r * 1.6, p.color);
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.spin);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : inner;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1.5, -1.5, 3, 3);
      ctx.restore();
      return;
    }

    const spd = Math.hypot(p.vx, p.vy) || 1;
    const nx = p.vx / spd;
    const ny = p.vy / spd;

    if (shape === 'needle') {
      // Straight thin needle: one solid streak, pointed at the front
      const len = p.radius * 4.2;
      ctx.lineWidth = Math.max(1.6, p.radius * 0.7);
      ctx.beginPath();
      ctx.moveTo(sx + nx * len * 0.5, sy + ny * len * 0.5);
      ctx.lineTo(sx - nx * len * 0.5, sy - ny * len * 0.5);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }

    if (shape === 'shell') {
      // Flare: burning shell with a short ember glow
      if (glowSettings.enabled) {
        ctx.globalAlpha = 0.55;
        drawGlow(ctx, sx, sy, p.radius * 2.6, '#f97316');
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Default orb bolt
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(sx, sy, p.radius * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, p.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Arrow at the screen edge pointing to an off-screen point of interest. */
  private drawEdgeArrow(sx: number, sy: number, color: string, scale: number) {
    const w = this.viewWidth;
    const h = this.viewHeight;
    const margin = 44;
    const angle = Math.atan2(sy - h / 2, sx - w / 2);
    const indX = Math.max(margin, Math.min(w - margin, w / 2 + Math.cos(angle) * (w * 0.45)));
    const indY = Math.max(margin + 70, Math.min(h - margin, h / 2 + Math.sin(angle) * (h * 0.42)));
    const ctx = this.overlayCtx;
    ctx.save();
    ctx.translate(indX, indY);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
}

/** Rainbow color for the prismatic skin's light. */
function hueRgb(deg: number): [number, number, number] {
  const h = ((deg % 360) + 360) % 360 / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  return [r * 0.6 + 0.4, g * 0.6 + 0.4, b * 0.6 + 0.4];
}
