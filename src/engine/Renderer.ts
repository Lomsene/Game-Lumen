import { Player } from '../entities/Player';
import { Enemy, EnemyProjectile, MortarZone, VoidObelisk, ShadowRift, SolarBurnZone } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Drop } from '../entities/Drop';
import { Weapon, PlayerProjectile } from '../weapons/Weapon';
import { ParticleSystem } from './Particle';
import { BeaconWeapon, RadianceWeapon, OrbitersWeapon, PulseWeapon } from '../weapons/WeaponRegistry';

export class GameRenderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public cameraX: number = 0;
  public cameraY: number = 0;

  // Screen shake
  public shakeDuration: number = 0;
  public shakeIntensity: number = 0;

  // Parallax cosmic stars & nebulas
  private stars: Array<{ x: number; y: number; size: number; alpha: number; layer: number; color: string }> = [];
  private nebulas: Array<{ x: number; y: number; radius: number; color: string; alpha: number }> = [];

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
    const palette = ['#e2e8f0', '#38bdf8', '#818cf8', '#f43f5e'];
    for (let i = 0; i < 240; i++) {
      this.stars.push({
        x: Math.random() * 4400 - 2200,
        y: Math.random() * 4400 - 2200,
        size: Math.random() * 1.6 + 0.5,
        alpha: Math.random() * 0.45 + 0.1,
        layer: Math.random() * 0.35 + 0.1,
        color: palette[Math.floor(Math.random() * palette.length)]
      });
    }

    this.nebulas = [
      { x: -600, y: -500, radius: 750, color: '#1e1b4b', alpha: 0.32 },
      { x: 700, y: -400, radius: 680, color: '#0c4a6e', alpha: 0.25 },
      { x: 200, y: 650, radius: 820, color: '#3b0764', alpha: 0.26 },
      { x: -750, y: 500, radius: 640, color: '#0f172a', alpha: 0.35 }
    ];
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
    mortarZones: MortarZone[],
    particles: ParticleSystem,
    obelisks: VoidObelisk[] = [],
    shadowRifts: ShadowRift[] = [],
    solarZones: SolarBurnZone[] = []
  ) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Smooth 1:1 camera tracking centered on the player in the vast arena
    const targetCamX = player.x - w / 2;
    const targetCamY = player.y - h / 2;
    this.cameraX += (targetCamX - this.cameraX) * 0.12;
    this.cameraY += (targetCamY - this.cameraY) * 0.12;

    // Screen shake
    let offsetX = 0;
    let offsetY = 0;
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      offsetX = (Math.random() - 0.5) * this.shakeIntensity;
      offsetY = (Math.random() - 0.5) * this.shakeIntensity;
    }
    const camX = this.cameraX + offsetX;
    const camY = this.cameraY + offsetY;

    // 1. Deep space outer void
    ctx.fillStyle = '#03050c';
    ctx.fillRect(0, 0, w, h);

    // 2. Distant cosmic nebulas & parallax dust motes
    ctx.save();
    for (const neb of this.nebulas) {
      const nx = neb.x - camX * 0.35 + w * 0.5;
      const ny = neb.y - camY * 0.35 + h * 0.5;
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, neb.radius);
      g.addColorStop(0, neb.color);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = neb.alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nx, ny, neb.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const star of this.stars) {
      const sx = ((star.x - camX * star.layer) % w + w) % w;
      const sy = ((star.y - camY * star.layer) % h + h) % h;
      ctx.fillStyle = star.color;
      ctx.globalAlpha = star.alpha * 0.55;
      ctx.fillRect(sx, sy, star.size, star.size);
    }
    ctx.restore();

    // ========================================================================
    // 3. BOUNDED CIRCULAR ARENA (Deep Dark Atmosphere & Perimeter Barrier)
    // ========================================================================
    const arenaX = 0 - camX;
    const arenaY = 0 - camY;
    const arenaR = Player.ARENA_RADIUS;

    ctx.save();

    // 3a. Arena Floor with clean, deep atmospheric gradient matching screenshot 2
    const floorGrad = ctx.createRadialGradient(arenaX, arenaY, 0, arenaX, arenaY, arenaR);
    floorGrad.addColorStop(0, 'rgba(6, 10, 23, 0.65)');
    floorGrad.addColorStop(0.6, 'rgba(4, 7, 17, 0.8)');
    floorGrad.addColorStop(1, 'rgba(2, 4, 10, 0.95)');

    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.arc(arenaX, arenaY, arenaR, 0, Math.PI * 2);
    ctx.fill();

    // 3b. Subtle sacred geometry rings on arena floor
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
    ctx.lineWidth = 1;
    for (const r of [600, 1200, 1800, 2400]) {
      ctx.beginPath();
      ctx.arc(arenaX, arenaY, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3c. Glowing Neon Perimeter Barrier Wall
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(arenaX, arenaY, arenaR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 3d. Render Void Obelisks (Risk/Reward Capture Zones) & Edge Pointers
    for (const ob of obelisks) {
      const sx = ob.x - camX;
      const sy = ob.y - camY;
      const progress = Math.min(1, ob.charge / ob.maxCharge);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Outer capture zone ring
      ctx.strokeStyle = progress > 0 ? '#fbbf24' : '#a855f7';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(sx, sy, ob.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Progress fill arc
      if (progress > 0) {
        ctx.strokeStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(sx, sy, ob.radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.stroke();
      }

      // Rotating Obelisk Crystal Core
      ctx.translate(sx, sy);
      ctx.rotate(ob.animTimer * 1.4);
      ctx.strokeStyle = '#c084fc';
      ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 16;
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

      // Label above Obelisk
      ctx.save();
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = progress > 0 ? '#fbbf24' : '#c084fc';
      ctx.textAlign = 'center';
      ctx.fillText(progress > 0 ? `VOID OBELISK ${Math.floor(progress * 100)}%` : 'VOID OBELISK', sx, sy - 26);
      ctx.restore();

      // Off-screen directional indicator arrow if Obelisk is outside screen view
      const margin = 44;
      if (sx < margin || sx > w - margin || sy < margin + 70 || sy > h - margin) {
        const angle = Math.atan2(sy - h / 2, sx - w / 2);
        const indX = Math.max(margin, Math.min(w - margin, w / 2 + Math.cos(angle) * (w * 0.42)));
        const indY = Math.max(margin + 75, Math.min(h - margin, h / 2 + Math.sin(angle) * (h * 0.38)));

        ctx.save();
        ctx.translate(indX, indY);
        ctx.rotate(angle);
        ctx.fillStyle = '#c084fc';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-8, -6);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 4. Render Drops (with frustum culling!)
    for (const drop of drops) {
      const sx = drop.x - camX;
      const sy = drop.y - camY;
      if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) continue;
      drop.render(ctx, camX, camY);
    }

    // 4b. Render Shadow Rifts (Gravitational Darkness Hazards)
    for (const rift of shadowRifts) {
      const sx = rift.x - camX;
      const sy = rift.y - camY;
      const fade = Math.min(1, Math.min(rift.life, rift.maxLife - rift.life));

      ctx.save();
      ctx.globalAlpha = fade * 0.85;
      const rGrad = ctx.createRadialGradient(sx, sy, 4, sx, sy, rift.radius);
      rGrad.addColorStop(0, '#020108');
      rGrad.addColorStop(0.55, 'rgba(88, 28, 135, 0.45)');
      rGrad.addColorStop(0.85, 'rgba(225, 29, 72, 0.25)');
      rGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = rGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, rift.radius, 0, Math.PI * 2);
      ctx.fill();

      // Swirling vortex arcs
      ctx.translate(sx, sy);
      ctx.rotate(-rift.animTimer * 1.8);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, rift.radius * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4c. Render Solar Burn Zones (from Flare weapon!)
    for (const sz of solarZones) {
      const sx = sz.x - camX;
      const sy = sz.y - camY;
      const alpha = Math.min(1, (sz.maxLife - sz.life) / 0.8);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.75;
      const sGrad = ctx.createRadialGradient(sx, sy, 2, sx, sy, sz.radius);
      sGrad.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
      sGrad.addColorStop(0.65, 'rgba(249, 115, 22, 0.25)');
      sGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, sz.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(sx, sy, sz.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Render Mortar Danger Blast Zones on the ground
    for (const mz of mortarZones) {
      const progress = mz.timer / mz.maxTime;
      const sx = mz.x - camX;
      const sy = mz.y - camY;
      ctx.save();
      // Danger fill fading in
      ctx.fillStyle = `rgba(239, 68, 68, ${0.12 + progress * 0.28})`;
      ctx.beginPath();
      ctx.arc(sx, sy, mz.radius, 0, Math.PI * 2);
      ctx.fill();

      // Outer warning ring
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();

      // Contracting inner warning ring showing time to impact
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(2, mz.radius * (1 - progress)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Render Weapon Visuals (Beacons, Orbiters, Radiance beams, Pulse ring)
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
          ctx.arc(sx, sy, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (w.beacons.length >= 2) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = w.isEvolved ? '#fbbf24' : 'rgba(251, 191, 36, 0.65)';
          ctx.lineWidth = w.isEvolved ? 2.6 : 1.6;
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
        const len = player.getLightRadius(); // Strictly bound to the dashed light line!
        const heat = w.thermalCharge;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = heat > 0.6 ? '#fbbf24' : '#00f3ff';
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 16 + heat * 12;
        ctx.lineWidth = (w.isEvolved ? 4.5 : 3) + heat * 3.5;
        for (const a of angles) {
          ctx.beginPath();
          ctx.moveTo(player.x - camX, player.y - camY);
          ctx.lineTo(player.x + Math.cos(a) * len - camX, player.y + Math.sin(a) * len - camY);
          ctx.stroke();

          // White hot inner core
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.4 + heat * 1.2;
          ctx.stroke();
        }
        ctx.restore();
      } else if (w instanceof OrbitersWeapon) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = w.isEvolved ? '#f59e0b' : '#38bdf8';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 14;
        for (const pos of w.currentOrbPositions) {
          const ox = pos.x - camX;
          const oy = pos.y - camY;
          ctx.beginPath();
          ctx.arc(ox, oy, w.isEvolved ? 7.5 : 5.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = w.isEvolved ? '#f59e0b' : '#38bdf8';
        }
        ctx.restore();
      } else if (w instanceof PulseWeapon) {
        w.render(ctx, camX, camY, player);
      }

      if (w.render && !(w instanceof PulseWeapon)) {
        w.render(ctx, camX, camY);
      }
    }

    // 7. Render Player Projectiles (Glowing Plasma Bolts with Velocity Tails, zero shadowBlur!)
    if (playerProjectiles.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of playerProjectiles) {
        const sx = p.x - camX;
        const sy = p.y - camY;
        if (sx < -35 || sx > w + 35 || sy < -35 || sy > h + 35) continue;
        const spd = Math.hypot(p.vx, p.vy);

        ctx.strokeStyle = p.color;
        ctx.fillStyle = p.color;

        if (spd > 20) {
          const tailLen = Math.min(22, spd * 0.045);
          const nx = p.vx / spd;
          const ny = p.vy / spd;
          ctx.lineWidth = p.radius * 1.4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - nx * tailLen, sy - ny * tailLen);
          ctx.stroke();
        }

        // Fast outer halo circle
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(sx, sy, p.radius * 2.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, p.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 8. Render All Enemies (with frustum culling so off-screen enemies cost 0 GPU time!)
    for (const enemy of enemies) {
      const sx = enemy.x - camX;
      const sy = enemy.y - camY;
      if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue;
      enemy.render(ctx, camX, camY);
    }

    // 9. Render Boss
    if (boss) {
      boss.render(ctx, camX, camY);
    }

    // 10. Render Enemy Projectiles (fast additive glow without shadowBlur!)
    if (enemyProjectiles.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const ep of enemyProjectiles) {
        const sx = ep.x - camX;
        const sy = ep.y - camY;
        if (sx < -25 || sx > w + 25 || sy < -25 || sy > h + 25) continue;

        ctx.fillStyle = ep.color;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(sx, sy, ep.radius * 2.0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(sx, sy, ep.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 11. Render Player
    player.render(ctx, camX, camY);

    // ========================================================================
    // 12. DYNAMIC ATTACK RADIUS & ATMOSPHERIC LIGHTING
    // (Enemies remain visible everywhere on screen, while light highlights range!)
    // ========================================================================
    const lightRadius = player.getLightRadius();
    const playerScreenX = player.x - camX;
    const playerScreenY = player.y - camY;

    ctx.save();

    // Attack zone highlight / ambient glow
    ctx.globalCompositeOperation = 'lighter';
    const lightGlow = ctx.createRadialGradient(
      playerScreenX,
      playerScreenY,
      0,
      playerScreenX,
      playerScreenY,
      lightRadius
    );
    lightGlow.addColorStop(0, 'rgba(56, 189, 248, 0.09)');
    lightGlow.addColorStop(0.65, 'rgba(56, 189, 248, 0.03)');
    lightGlow.addColorStop(1, 'transparent');

    ctx.fillStyle = lightGlow;
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, lightRadius, 0, Math.PI * 2);
    ctx.fill();

    // Attack radius dashed perimeter line (subtle slate-blue matching screenshot 2)
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, lightRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 13. Outer void mask (blacks out beyond the circular arena barrier)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(arenaX, arenaY, arenaR, 0, Math.PI * 2, true); // Hole in rectangle
    ctx.fillStyle = 'rgba(2, 4, 10, 0.88)';
    ctx.fill();
    ctx.restore();

    // 14. Render Particles, Shockwaves, and Floating Damage Numbers
    particles.render(ctx, camX, camY);

    // 15. Low-Light Crimson Danger Vignette (Pulses when Light < 30%)
    const lightPct = player.light / player.maxLight;
    if (lightPct < 0.32) {
      const dangerIntensity = (1 - lightPct / 0.32) * (0.28 + Math.sin(performance.now() * 0.008) * 0.1);
      ctx.save();
      const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, `rgba(225, 29, 72, ${Math.max(0, dangerIntensity)})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}
