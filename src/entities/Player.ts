import { forge } from '../meta/Forge';
import { sound } from '../engine/Sound';
import { ParticleSystem } from '../engine/Particle';

export class Player {
  public x: number = 0;
  public y: number = 0;
  public vx: number = 0;
  public vy: number = 0;
  public radius: number = 16;

  // Light System (Health, Sight, Range)
  public light: number = 100;
  public maxLight: number = 100;
  public baseDrainRate: number = 2.2; // light drained per second

  // Level & XP
  public level: number = 1;
  public xp: number = 0;
  public xpToNextLevel: number = 12;

  // Dash
  public dashCooldown: number = 0;
  public dashMaxCooldown: number = 2.8;
  public isDashing: boolean = false;
  public dashTimer: number = 0;
  public dashDuration: number = 0.25;
  public dashDirection: { x: number; y: number } = { x: 1, y: 0 };
  public invulnerableTimer: number = 0;

  // Movement speed
  public baseSpeed: number = 210;

  // Stats & Progression tracking
  public score: number = 0;
  public scoreMultiplier: number = 1.0;
  public kills: number = 0;
  public shardsCollectedThisRun: number = 0;
  public passives: Map<string, number> = new Map();

  // Shield mechanic (Prism Shield passive)
  public shieldActive: boolean = false;
  public shieldCooldown: number = 0;

  // Visuals
  public rotation: number = 0;
  private animTimer: number = 0;

  constructor() {
    this.initFromForge();
  }

  public initFromForge() {
    // Starting Light bonus from Forge
    const flameLvl = forge.getLevel('eternalFlame');
    this.maxLight = 100 + flameLvl * 12;
    this.light = this.maxLight;

    // Dash Cooldown from Forge
    const quickstepLvl = forge.getLevel('quickstep');
    this.dashMaxCooldown = Math.max(1.2, 2.8 * (1 - quickstepLvl * 0.06));

    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 12;
    this.kills = 0;
    this.score = 0;
    this.scoreMultiplier = 1.0;
    this.shardsCollectedThisRun = 0;
    this.passives.clear();
  }

  public getLightRadius(): number {
    const lensBonus = 1 + (this.passives.get('prismaticLens') ?? 0) * 0.2;
    // Minimum 100px so player can always see nearby, scaling up to 450px+
    const r = (120 + this.light * 2.8) * lensBonus;
    return Math.max(80, r);
  }

  public getMoveSpeed(): number {
    const swiftLvl = this.passives.get('swiftSteps') ?? 0;
    return this.baseSpeed * (1 + swiftLvl * 0.15);
  }

  public getDamageMultiplier(): number {
    // Light scaling bonus: brighter = hits harder
    const lightBonus = this.light / 200;
    const radiantLvl = this.passives.get('radiantIntensity') ?? 0;
    const forgeBonus = forge.getLevel('soulLuminance') * 0.06;
    return (1 + lightBonus) * (1 + radiantLvl * 0.15 + forgeBonus);
  }

  public getCooldownMultiplier(): number {
    const resonanceLvl = this.passives.get('resonance') ?? 0;
    return Math.max(0.4, 1 - resonanceLvl * 0.12);
  }

  public getMagnetRadius(): number {
    const magnetLvl = this.passives.get('shardMagnet') ?? 0;
    const forgeMagnet = forge.getLevel('shardAttractor') * 0.25;
    return 100 * (1 + magnetLvl * 0.6 + forgeMagnet);
  }

  public triggerDash(): boolean {
    if (this.dashCooldown > 0 || this.isDashing) return false;

    this.isDashing = true;
    this.dashTimer = this.dashDuration;
    this.invulnerableTimer = this.dashDuration + 0.1;
    this.dashCooldown = this.dashMaxCooldown;

    // Blink passive upgrade
    const blinkLvl = this.passives.get('blink') ?? 0;
    if (blinkLvl > 0) {
      this.dashCooldown *= Math.max(0.45, 1 - blinkLvl * 0.22);
    }

    sound.playDash();
    return true;
  }

  public takeDamage(amount: number, particles?: ParticleSystem): boolean {
    if (this.invulnerableTimer > 0) return false;

    // Prism Shield absorption
    if (this.shieldActive) {
      this.shieldActive = false;
      this.shieldCooldown = 20;
      this.invulnerableTimer = 0.5;
      if (particles) {
        particles.emitShockwave(this.x, this.y, 140, '#00f3ff', 5);
      }
      sound.playPulse();
      return false;
    }

    this.light = Math.max(0, this.light - amount);
    this.invulnerableTimer = 0.4;
    sound.playHit();

    if (particles) {
      particles.emitSpark(this.x, this.y, '#f43f5e', 14);
    }

    return true;
  }

  public addLight(amount: number) {
    this.light = Math.min(this.maxLight, this.light + amount);
  }

  public addXp(amount: number): boolean {
    this.xp += amount;
    if (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level += 1;
      this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.35 + 8);
      sound.playLevelUp();
      return true; // Level up triggered!
    }
    return false;
  }

  public update(dt: number, moveInput: { x: number; y: number }, particles: ParticleSystem) {
    this.animTimer += dt;

    // 1. Drain Light naturally
    const enduranceLvl = forge.getLevel('radiantEndurance');
    const innerCoreLvl = this.passives.get('innerCore') ?? 0;
    const drainReduction = 1 - enduranceLvl * 0.05 - innerCoreLvl * 0.2;
    const effectiveDrain = Math.max(0.6, this.baseDrainRate * drainReduction);
    this.light = Math.max(0, this.light - effectiveDrain * dt);

    // 2. Dash & Movement
    if (this.isDashing) {
      this.dashTimer -= dt;
      const dashSpeed = this.getMoveSpeed() * 2.8;
      this.vx = this.dashDirection.x * dashSpeed;
      this.vy = this.dashDirection.y * dashSpeed;

      // Spawn dash glow trail
      particles.emitDashTrail(this.x, this.y, '#00f3ff');

      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    } else {
      const speed = this.getMoveSpeed();
      if (moveInput.x !== 0 || moveInput.y !== 0) {
        this.vx = moveInput.x * speed;
        this.vy = moveInput.y * speed;
        this.dashDirection = { x: moveInput.x, y: moveInput.y };
        this.rotation = Math.atan2(moveInput.y, moveInput.x);
      } else {
        // Friction slowdown
        this.vx *= 0.85;
        this.vy *= 0.85;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 3. Timers
    if (this.dashCooldown > 0) {
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    }
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }

    // Shield recharge
    if ((this.passives.get('prismShield') ?? 0) > 0) {
      if (!this.shieldActive) {
        this.shieldCooldown -= dt;
        if (this.shieldCooldown <= 0) {
          this.shieldActive = true;
        }
      }
    }

    // Sound alert for low light
    sound.updateHeartbeat(this.light / this.maxLight);
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    ctx.save();

    // Invulnerability flashing
    if (this.invulnerableTimer > 0 && Math.floor(this.animTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Outer aura ring
    const auraPulse = 1 + Math.sin(this.animTimer * 4) * 0.1;
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, (this.radius + 8) * auraPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glowing core
    ctx.globalCompositeOperation = 'lighter';
    const gradient = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, this.radius + 12);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, '#00f3ff');
    gradient.addColorStop(0.7, 'rgba(14, 165, 233, 0.4)');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, this.radius + 12, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright orb
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(screenX, screenY, this.radius * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Prism Shield visual ring if active
    if (this.shieldActive) {
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.radius + 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
