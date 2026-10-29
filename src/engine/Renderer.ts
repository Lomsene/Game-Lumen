import { Player } from '../entities/Player';
import { Enemy, EnemyProjectile } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Drop } from '../entities/Drop';
import { Weapon, PlayerProjectile } from '../weapons/Weapon';
import { ParticleSystem } from './Particle';
import { BeaconWeapon, RadianceWeapon, OrbitersWeapon } from '../weapons/WeaponRegistry';

export class GameRenderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public cameraX: number = 0;
  public cameraY: number = 0;

  // Screen shake
  public shakeDuration: number = 0;
  public shakeIntensity: number = 0;

  // Background stars
  private stars: Array<{ x: number; y: number; size: number; alpha: number }> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Failed to get 2D context');
    this.ctx = context;

    this.resize();
    this.initStars();
  }

  public resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private initStars() {
    this.stars = [];
    const count = 180;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * 4000 - 2000,
        y: Math.random() * 4000 - 2000,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.4 + 0.1
      });
    }
  }

  public triggerScreenShake(intensity: number = 8, duration: number = 0.25) {
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
    particles: ParticleSystem
  ) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Camera follow with smooth lerp
    const targetCamX = player.x - w / 2;
    const targetCamY = player.y - h / 2;
    this.cameraX += (targetCamX - this.cameraX) * 0.12;
    this.cameraY += (targetCamY - this.cameraY) * 0.12;

    // Apply screen shake
    let offsetX = 0;
    let offsetY = 0;
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      offsetX = (Math.random() - 0.5) * this.shakeIntensity;
      offsetY = (Math.random() - 0.5) * this.shakeIntensity;
    }
    const camX = this.cameraX + offsetX;
    const camY = this.cameraY + offsetY;

    // 1. Clear to deep space background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    // 2. Background Grid & Stars
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    for (const star of this.stars) {
      // Parallax
      const sx = ((star.x - camX * 0.3) % w + w) % w;
      const sy = ((star.y - camY * 0.3) % h + h) % h;
      ctx.globalAlpha = star.alpha;
      ctx.fillRect(sx, sy, star.size, star.size);
    }
    ctx.restore();

    // 3. Render Drops
    for (const drop of drops) {
      drop.render(ctx, camX, camY);
    }

    // 4. Render Weapon Visuals (Beacons, Orbiters, Radiance beams)
    for (const w of weapons) {
      if (w instanceof BeaconWeapon) {
        for (const b of w.beacons) {
          const sx = b.x - camX;
          const sy = b.y - camY;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = '#fbbf24';
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(sx, sy, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Laser links between beacons if evolved
        if (w.isEvolved && w.beacons.length >= 2) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 10;
          for (let i = 0; i < w.beacons.length; i++) {
            for (let j = i + 1; j < w.beacons.length; j++) {
              ctx.beginPath();
              ctx.moveTo(w.beacons[i].x - camX, w.beacons[i].y - camY);
              ctx.lineTo(w.beacons[j].x - camX, w.beacons[j].y - camY);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      } else if (w instanceof RadianceWeapon) {
        const angles = w.getAngles();
        const len = player.getLightRadius();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#00f3ff';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 18;
        ctx.lineWidth = w.isEvolved ? 4.5 : 3;
        for (const a of angles) {
          ctx.beginPath();
          ctx.moveTo(player.x - camX, player.y - camY);
          ctx.lineTo(player.x + Math.cos(a) * len - camX, player.y + Math.sin(a) * len - camY);
          ctx.stroke();
        }
        ctx.restore();
      } else if (w instanceof OrbitersWeapon) {
        const orbCount = w.isEvolved ? 6 : 2 + Math.floor(w.level * 0.8);
        const orbDist = 55 + (w.level - 1) * 6;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = w.isEvolved ? '#f59e0b' : '#38bdf8';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 14;
        for (let i = 0; i < orbCount; i++) {
          const a = (performance.now() * 0.003 * (w.isEvolved ? 1.8 : 1)) + (i / orbCount) * Math.PI * 2;
          const ox = player.x + Math.cos(a) * orbDist - camX;
          const oy = player.y + Math.sin(a) * orbDist - camY;
          ctx.beginPath();
          ctx.arc(ox, oy, w.isEvolved ? 7 : 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (w.render) {
        w.render(ctx, camX, camY);
      }
    }

    // 5. Render Player Projectiles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of playerProjectiles) {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y - camY, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 6. Render Enemies
    for (const enemy of enemies) {
      enemy.render(ctx, camX, camY);
    }

    // 7. Render Boss
    if (boss) {
      boss.render(ctx, camX, camY);
    }

    // 8. Render Enemy Projectiles
    ctx.save();
    for (const ep of enemyProjectiles) {
      ctx.fillStyle = ep.color;
      ctx.shadowColor = ep.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ep.x - camX, ep.y - camY, ep.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 9. Render Player
    player.render(ctx, camX, camY);

    // ========================================================================
    // 10. DYNAMIC LIGHT & DARKNESS MASKING (Core Gameplay Feature!)
    // ========================================================================
    const lightRadius = player.getLightRadius();
    const playerScreenX = player.x - camX;
    const playerScreenY = player.y - camY;

    ctx.save();
    // Create a darkness overlay with a radial hole cut out for player's light
    const darkGrad = ctx.createRadialGradient(
      playerScreenX,
      playerScreenY,
      Math.max(10, lightRadius * 0.45),
      playerScreenX,
      playerScreenY,
      lightRadius
    );
    darkGrad.addColorStop(0, 'rgba(3, 7, 18, 0)');
    darkGrad.addColorStop(0.65, 'rgba(3, 7, 18, 0.45)');
    darkGrad.addColorStop(0.9, 'rgba(3, 7, 18, 0.92)');
    darkGrad.addColorStop(1, 'rgba(3, 7, 18, 0.99)');

    ctx.fillStyle = darkGrad;
    ctx.fillRect(0, 0, w, h);

    // Extra ring outside light radius
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, lightRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 11. Render Particles and Shockwaves
    particles.render(ctx, camX, camY);
  }
}
