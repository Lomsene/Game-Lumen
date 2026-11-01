import { forge, PLAYER_CLASSES, PLAYER_SKINS, PlayerClassId, PlayerSkinId } from '../meta/Forge';
import { sound } from '../engine/Sound';
import { ParticleSystem } from '../engine/Particle';
import { Balance } from '../engine/Balance';
import { drawGlow } from '../engine/GlowCache';

export class Player {
  public x: number = 0;
  public y: number = 0;
  public vx: number = 0;
  public vy: number = 0;
  public radius: number = 16;
  /** Smaller collision radius than the drawn orb for fair touch controls. */
  public hurtRadius: number = Balance.playerHurtRadius;

  // Class & Skin Identity
  public classId: PlayerClassId = 'wanderer';
  public skinId: PlayerSkinId = 'cyan';

  // Light System (Health, Sight, Range)
  public light: number = 100;
  public maxLight: number = 100;

  // Level & XP
  public level: number = 1;
  public xp: number = 0;
  public xpToNextLevel: number = 10;

  // Kill-Streak, Overdrive & Arena Hazard State
  public comboCount: number = 0;
  public comboTimer: number = 0;
  public overdriveTimer: number = 0; // Granted by Void Obelisks & Mega Streaks!
  public inShadowRift: boolean = false;

  // Dash
  public dashCooldown: number = 0;
  public dashMaxCooldown: number = 2.8;
  public isDashing: boolean = false;
  public dashTimer: number = 0;
  public dashDuration: number = 0.25;
  public dashDirection: { x: number; y: number } = { x: 1, y: 0 };
  public invulnerableTimer: number = 0;

  // Active Ultimate: Supernova / Licht-Opfer - charged by kills
  public novaCharge: number = 0;
  public novaUses: number = 0;
  /** While > 0 the Supernova protects you: no light drain, no damage. */
  public novaShieldTimer: number = 0;

  // Morgenschild (Forge): shield charges that each absorb one hit completely
  public wardCharges: number = 0;

  // Movement speed
  public baseSpeed: number = 210;

  // Stats & Progression tracking
  public score: number = 0;
  public scoreMultiplier: number = 1.0;
  public kills: number = 0;
  public shardsCollectedThisRun: number = 0;
  public passives: Map<string, number> = new Map();
  /** Stacking damage from repeatable bonus gifts (after everything is maxed). */
  public bonusDamage: number = 0;

  // Shield mechanic (Prism Shield passive)
  public shieldActive: boolean = false;
  public shieldCooldown: number = 0;

  // Visuals & Motion Animation
  public rotation: number = 0;
  private animTimer: number = 0;
  public trailHistory: Array<{ x: number; y: number }> = [];
  private stretchFactor: number = 1.0;
  private tiltX: number = 0;
  private tiltY: number = 0;

  // Circular bounded arena radius (vast battleground: radius 2400px, diameter 4800px!)
  public static readonly ARENA_RADIUS: number = 2400;

  constructor() {
    this.initFromForge();
  }

  public initFromForge() {
    this.classId = forge.selectedClass;
    this.skinId = forge.selectedSkin;

    // Starting Light bonus from Forge + Class modifiers
    const flameLvl = forge.getLevel('eternalFlame');
    const vanguardMastery = this.classId === 'vanguard' ? forge.getLevel('classMasteryVanguard') * 12 : 0;
    const classLightBonus = this.classId === 'vanguard' ? 30 : this.classId === 'hunter' ? -15 : 0;

    this.maxLight = Math.max(60, 100 + flameLvl * 15 + classLightBonus + vanguardMastery);
    this.light = this.maxLight;

    // Dash Cooldown from Forge + Class modifiers
    const quickstepLvl = forge.getLevel('quickstep');
    const hunterDashMult = this.classId === 'hunter' ? 0.75 : 1.0;
    this.dashMaxCooldown = Math.max(1.0, 2.8 * (1 - quickstepLvl * 0.06) * hunterDashMult);

    this.novaCharge = 0;
    this.novaUses = 0;
    this.novaShieldTimer = 0;
    this.wardCharges = forge.getLevel('dawnWard');

    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = Balance.xpToNext(1);
    this.kills = 0;
    this.score = 0;
    this.scoreMultiplier = 1.0;
    this.shardsCollectedThisRun = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.overdriveTimer = 0;
    this.passives.clear();
    this.bonusDamage = 0;
  }

  public getLightRadius(): number {
    const lensBonus = 1 + (this.passives.get('prismaticLens') ?? 0) * 0.25;
    const beaconLvl = this.passives.get('astralBeacon') ?? 0;
    const pactPenalty = (this.passives.get('bloodPact') ?? 0) * 0.1;
    const classRadiusBonus =
      (this.classId === 'architect' ? 0.20 : 0) +
      (this.classId === 'wanderer' ? forge.getLevel('classMasteryWanderer') * 0.08 : 0) +
      (this.passives.get('wandererHarmony') ?? 0) * 0.18 +
      (this.passives.get('architectGrid') ?? 0) * 0.22;

    // Tight starting radius (~165px at 100 light) that noticeably expands with upgrades & maxLight!
    const r = (72 + this.light * 0.92) * (lensBonus + beaconLvl * 0.18 + classRadiusBonus - pactPenalty);
    return Math.max(65, r);
  }

  public getMoveSpeed(): number {
    const swiftLvl = this.passives.get('swiftSteps') ?? 0;
    const overdriveBonus = this.overdriveTimer > 0 ? 0.18 : 0;
    const comboSpeed = Math.min(0.15, this.comboCount * 0.005);
    const classSpeedMod =
      (this.classId === 'vanguard' ? -0.10 : 0) +
      (this.classId === 'hunter' ? 0.08 : 0) +
      (this.passives.get('phantomStep') ?? 0) * 0.14;
    return this.baseSpeed * (1 + swiftLvl * 0.15 + overdriveBonus + comboSpeed + classSpeedMod);
  }

  public getDamageMultiplier(): number {
    // Light scaling bonus: brighter = hits harder (capped so huge max-light builds don't snowball)
    const lightBonus = Math.min(this.light, 160) / 200;
    const radiantLvl = this.passives.get('radiantIntensity') ?? 0;
    const bloodPactLvl = this.passives.get('bloodPact') ?? 0;
    const voidGlassLvl = this.passives.get('voidGlass') ?? 0;
    const solarWrathLvl = this.passives.get('solarWrath') ?? 0;
    const executionerLvl = this.passives.get('voidExecutioner') ?? 0;
    const forgeBonus = forge.getLevel('soulLuminance') * 0.08;
    const classDmgBonus =
      (this.classId === 'hunter' ? 0.30 : 0) +
      (this.classId === 'architect' ? forge.getLevel('classMasteryArchitect') * 0.10 : 0) +
      (this.passives.get('hunterLethality') ?? 0) * 0.25 +
      (this.passives.get('vanguardBastion') ?? 0) * 0.20 +
      (this.passives.get('wandererHarmony') ?? 0) * 0.16;
    const overdriveDmg = this.overdriveTimer > 0 ? 0.25 : 0;
    return (1 + lightBonus) * (1 + radiantLvl * 0.15 + solarWrathLvl * 0.22 + executionerLvl * 0.20 + bloodPactLvl * 0.45 + voidGlassLvl * 0.35 + forgeBonus + classDmgBonus + overdriveDmg + this.bonusDamage);
  }

  public getCooldownMultiplier(): number {
    const resonanceLvl = this.passives.get('resonance') ?? 0;
    const chronoLvl = this.passives.get('chronoAccelerator') ?? 0;
    const wandererMastery = this.classId === 'wanderer' ? forge.getLevel('classMasteryWanderer') * 0.08 : 0;
    const overdriveFactor = this.overdriveTimer > 0 ? 0.65 : 1.0;
    return Math.max(0.28, (1 - resonanceLvl * 0.12 - chronoLvl * 0.15 - wandererMastery) * overdriveFactor);
  }

  public getCritChance(): number {
    const overchargeLvl = this.passives.get('overcharge') ?? 0;
    const hunterMastery = this.classId === 'hunter' ? forge.getLevel('classMasteryHunter') * 0.07 : 0;
    const hunterLethality = (this.passives.get('hunterLethality') ?? 0) * 0.12;
    return 0.06 + overchargeLvl * 0.12 + hunterMastery + hunterLethality;
  }

  public getCritMultiplier(): number {
    const hunterMastery = this.classId === 'hunter' ? forge.getLevel('classMasteryHunter') * 0.10 : 0;
    const hunterLethality = (this.passives.get('hunterLethality') ?? 0) * 0.25;
    return 1.75 + hunterMastery + hunterLethality;
  }

  public registerKill() {
    this.kills += 1;
    this.comboCount += 1;
    this.comboTimer = 3.2; // 3.2s window to chain kills
  }

  public getTotalMultiplier(): number {
    const comboBonus = Math.min(3.0, Math.floor(this.comboCount / 5) * 0.2);
    return (this.scoreMultiplier + comboBonus) * Balance.scoreMultiplier();
  }

  public getMagnetRadius(): number {
    const magnetLvl = this.passives.get('shardMagnet') ?? 0;
    const forgeMagnet = forge.getLevel('shardAttractor') * 0.25;
    const classMagnet = this.classId === 'architect' ? 0.35 : 0;
    return 100 * (1 + magnetLvl * 0.6 + forgeMagnet + classMagnet);
  }

  public getNovaChargeNeeded(): number {
    return Balance.novaChargeNeeded(this.novaUses);
  }

  public isNovaReady(): boolean {
    return this.novaCharge >= this.getNovaChargeNeeded();
  }

  /** Kills charge the Supernova (normal = 1, elite = 5). */
  public addNovaCharge(points: number) {
    const chronoBonus = (this.passives.get('chronoAccelerator') ?? 0) * 0.25;
    const catalystBonus = forge.getLevel('supernovaCatalyst') * 0.08;
    this.novaCharge = Math.min(this.getNovaChargeNeeded(), this.novaCharge + points * (1 + chronoBonus + catalystBonus));
  }

  /**
   * Active Ultimate: Supernova / Licht-Opfer
   * Requires a full kill charge. Sacrifices half of the current light and turns it into
   * a massive blast. Returns the sacrificed light, or 0 if not ready.
   */
  public triggerSupernova(): number {
    if (!this.isNovaReady() || this.light <= 8) return 0;

    const sacrificedLight = this.light * Balance.novaSacrifice;
    this.light -= sacrificedLight;
    this.novaCharge = 0;
    this.novaUses += 1;

    const catalystLvl = forge.getLevel('supernovaCatalyst');
    const ascensionLvl = this.passives.get('novaAscension') ?? 0;
    this.novaShieldTimer = 3.0 + catalystLvl * 0.4 + ascensionLvl * 0.6;
    this.invulnerableTimer = Math.max(this.invulnerableTimer, this.novaShieldTimer);
    this.overdriveTimer = Math.max(this.overdriveTimer, 8.0 + catalystLvl * 1.5 + ascensionLvl * 2.5);

    sound.playLevelUp();
    sound.playPulse();
    return sacrificedLight;
  }

  public triggerDash(): boolean {
    if (this.dashCooldown > 0 || this.isDashing) return false;

    this.isDashing = true;
    this.dashTimer = this.dashDuration;
    const quickstepInvuln = forge.getLevel('quickstep') * 0.04;
    this.invulnerableTimer = Math.max(this.invulnerableTimer, this.dashDuration + 0.1 + quickstepInvuln);
    this.dashCooldown = this.dashMaxCooldown;

    // Blink passive upgrade
    const blinkLvl = this.passives.get('blink') ?? 0;
    if (blinkLvl > 0) {
      this.dashCooldown *= Math.max(0.45, 1 - blinkLvl * 0.22);
    }

    sound.playDash();
    return true;
  }

  /** Returns true if the hit actually cost light. */
  public takeDamage(amount: number, particles?: ParticleSystem): boolean {
    if (this.invulnerableTimer > 0) return false;

    // Morgenschild charges absorb whole hits
    if (this.wardCharges > 0) {
      this.wardCharges -= 1;
      this.invulnerableTimer = Balance.hitInvulnerability;
      if (particles) {
        particles.emitShockwave(this.x, this.y, 110, '#fde68a', 4);
        particles.emitBannerText(this.x, this.y - 20, this.wardCharges > 0 ? `SCHILD (${this.wardCharges})` : 'SCHILD GEBROCHEN', '#fde68a');
      }
      sound.playPulse();
      return false;
    }

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
    this.invulnerableTimer = Balance.hitInvulnerability;
    this.comboCount = Math.floor(this.comboCount * 0.5); // Taking hit halves streak
    sound.playHit();

    if (particles) {
      particles.emitSpark(this.x, this.y, '#f43f5e', 14);
    }

    return true;
  }

  public addLight(amount: number) {
    this.light = Math.min(this.maxLight, this.light + amount);
  }

  /** Adds XP and returns how many levels were gained (can be more than one). */
  public addXp(amount: number): number {
    this.xp += amount * (1 + forge.getLevel('seasonedSoul') * 0.12);
    let gained = 0;
    while (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level += 1;
      this.xpToNextLevel = Balance.xpToNext(this.level);
      gained += 1;
    }
    if (gained > 0) sound.playLevelUp();
    return gained;
  }

  public update(dt: number, moveInput: { x: number; y: number }, particles: ParticleSystem, elapsedMinutes: number = 0) {
    this.animTimer += dt;

    // 1. Drain Light naturally (escalates with elapsed minutes and Shadow Rifts!)
    const enduranceLvl = forge.getLevel('radiantEndurance');
    const innerCoreLvl = this.passives.get('innerCore') ?? 0;
    const bloodPactLvl = this.passives.get('bloodPact') ?? 0;
    const vanguardDrainReduction =
      (this.classId === 'vanguard' ? 0.15 : 0) +
      (this.passives.get('vanguardBastion') ?? 0) * 0.14;
    const drainReduction = Math.max(0.35, 1 - enduranceLvl * 0.06 - innerCoreLvl * 0.18 - vanguardDrainReduction + bloodPactLvl * 0.2);
    const riftMultiplier = this.inShadowRift ? 2.1 : 1.0;
    const effectiveDrain = Math.max(1.0, Balance.lightDrain(elapsedMinutes) * drainReduction * riftMultiplier);
    // Supernova protection pauses the drain so the sacrifice is never an instant death
    if (this.novaShieldTimer <= 0) {
      this.light = Math.max(0, this.light - effectiveDrain * dt);
    }
    this.inShadowRift = false;

    // 2. Dash & Movement
    const skin = PLAYER_SKINS[this.skinId] ?? PLAYER_SKINS.cyan;
    if (this.isDashing) {
      this.dashTimer -= dt;
      const dashSpeed = this.getMoveSpeed() * 2.8;
      this.vx = this.dashDirection.x * dashSpeed;
      this.vy = this.dashDirection.y * dashSpeed;

      // Spawn dash glow trail matching equipped skin
      particles.emitDashTrail(this.x, this.y, skin.primaryColor);

      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    } else {
      const speed = this.getMoveSpeed();
      if (moveInput.x !== 0 || moveInput.y !== 0) {
        const targetVx = moveInput.x * speed;
        const targetVy = moveInput.y * speed;
        this.vx += (targetVx - this.vx) * Math.min(1, dt * 16);
        this.vy += (targetVy - this.vy) * Math.min(1, dt * 16);
        this.dashDirection = { x: moveInput.x, y: moveInput.y };
        const targetRot = Math.atan2(this.vy, this.vx);
        const rotDiff = Math.atan2(Math.sin(targetRot - this.rotation), Math.cos(targetRot - this.rotation));
        this.rotation += rotDiff * Math.min(1, dt * 18);
      } else {
        // Friction slowdown
        this.vx *= Math.pow(0.002, dt);
        this.vy *= Math.pow(0.002, dt);
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Smooth motion animation state (tilt, stretch, and ribbon trail)
    const curSpeed = Math.hypot(this.vx, this.vy);
    const speedRatio = Math.min(1.6, curSpeed / Math.max(1, this.baseSpeed));
    const targetStretch = 1 + speedRatio * 0.14;
    this.stretchFactor += (targetStretch - this.stretchFactor) * Math.min(1, dt * 14);
    this.tiltX += ((this.vx / Math.max(1, this.baseSpeed)) * 4.5 - this.tiltX) * Math.min(1, dt * 12);
    this.tiltY += ((this.vy / Math.max(1, this.baseSpeed)) * 4.5 - this.tiltY) * Math.min(1, dt * 12);

    this.trailHistory.unshift({ x: this.x, y: this.y });
    if (this.trailHistory.length > 12) {
      this.trailHistory.pop();
    }

    // Keep player strictly inside bounded circular arena
    const distCenter = Math.hypot(this.x, this.y);
    const maxBound = Player.ARENA_RADIUS - this.radius;
    if (distCenter > maxBound) {
      const a = Math.atan2(this.y, this.x);
      this.x = Math.cos(a) * maxBound;
      this.y = Math.sin(a) * maxBound;
    }

    // 3. Timers
    if (this.dashCooldown > 0) {
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    }
    if (this.novaShieldTimer > 0) {
      this.novaShieldTimer = Math.max(0, this.novaShieldTimer - dt);
    }
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
      }
    }
    if (this.overdriveTimer > 0) {
      this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
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
    const skin = PLAYER_SKINS[this.skinId] ?? PLAYER_SKINS.cyan;

    // Prismatic dynamic hue cycling if prismatic skin is equipped
    const isPrismatic = skin.ringStyle === 'prismatic';
    const hue = Math.floor((this.animTimer * 75) % 360);
    const primaryCol = isPrismatic ? `hsl(${hue}, 95%, 62%)` : skin.primaryColor;
    const secondaryCol = isPrismatic ? `hsl(${(hue + 60) % 360}, 95%, 55%)` : skin.secondaryColor;

    ctx.save();

    // 1. Smooth glowing motion trail when moving
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 20 && this.trailHistory.length > 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i < this.trailHistory.length; i++) {
        const pt = this.trailHistory[i];
        const ratio = 1 - i / this.trailHistory.length;
        ctx.fillStyle = isPrismatic
          ? `hsla(${(hue + i * 18) % 360}, 90%, 60%, ${ratio * 0.24})`
          : `rgba(${skin.trailRgba}, ${ratio * 0.22})`;
        ctx.beginPath();
        ctx.arc(pt.x - cameraX, pt.y - cameraY, this.radius * 0.65 * ratio, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Invulnerability flashing
    if (this.invulnerableTimer > 0 && Math.floor(this.animTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    // Gentle floating breathing
    const pulse = 1 + Math.sin(this.animTimer * 4) * 0.04;

    ctx.globalCompositeOperation = 'lighter';

    // 2. Soft wide outer bloom matching equipped skin or Overdrive
    const isOverdrive = this.overdriveTimer > 0;
    const bloomColor = isOverdrive ? '#fbbf24' : isPrismatic ? '#ec4899' : skin.primaryColor;
    const baseAlpha = ctx.globalAlpha;
    ctx.globalAlpha = baseAlpha * 0.6;
    drawGlow(ctx, screenX, screenY, this.radius * 3.4, bloomColor);
    ctx.globalAlpha = baseAlpha * 0.8;
    drawGlow(ctx, screenX, screenY, this.radius * 1.4, '#ffffff');
    ctx.globalAlpha = baseAlpha;

    // Supernova protection bubble
    if (this.novaShieldTimer > 0) {
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = baseAlpha * (0.5 + Math.sin(this.animTimer * 12) * 0.25);
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.radius + 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = baseAlpha;
    }
    // Morgenschild charges as small orbiting pips
    for (let i = 0; i < this.wardCharges; i++) {
      const a = this.animTimer * 2 + (i / Math.max(1, this.wardCharges)) * Math.PI * 2;
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(screenX + Math.cos(a) * (this.radius + 10), screenY + Math.sin(a) * (this.radius + 10), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Rotating geometric ring around core based on Skin style!
    ctx.save();
    ctx.translate(screenX + this.tiltX * 0.35, screenY + this.tiltY * 0.35);
    const ringRot = this.animTimer * (isOverdrive ? 3.2 : 1.6) + (speed > 15 ? this.rotation * 0.35 : 0);
    ctx.rotate(ringRot);

    ctx.strokeStyle = isOverdrive ? '#fde68a' : primaryCol;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';

    const ringR = (this.radius * 0.95) * pulse;

    switch (skin.ringStyle) {
      case 'crown': {
        // 4 solar crown arcs + cardinal sun rays
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          ctx.beginPath();
          ctx.arc(0, 0, ringR, a - 0.25, a + 0.25);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (ringR + 2), Math.sin(a) * (ringR + 2));
          ctx.lineTo(Math.cos(a) * (ringR + 6), Math.sin(a) * (ringR + 6));
          ctx.stroke();
        }
        break;
      }
      case 'diamond': {
        // Rotating crystal diamond
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          const px = Math.cos(a) * (ringR * 1.12);
          const py = Math.sin(a) * (ringR * 1.12);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'hex': {
        // Void hexagon rune ring
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const px = Math.cos(a) * (ringR * 1.05);
          const py = Math.sin(a) * (ringR * 1.05);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'blades': {
        // 3 crimson scythe arcs
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(0, 0, ringR * 1.04, a, a + 0.9);
          ctx.stroke();
        }
        break;
      }
      case 'prismatic': {
        // Dual counter-rotating spectral rings
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.38, Math.PI * 0.38);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, ringR, Math.PI * 0.62, Math.PI * 1.38);
        ctx.stroke();

        ctx.rotate(-ringRot * 2.2);
        ctx.strokeStyle = secondaryCol;
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * (ringR * 1.15), Math.sin(a) * (ringR * 1.15), 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      default: {
        // Default Aether Left/Right bracket arcs
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.34, Math.PI * 0.34);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, ringR, Math.PI * 0.66, Math.PI * 1.34);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();

    // 4. Inner bright core with subtle directional squash/stretch
    ctx.save();
    ctx.translate(screenX + this.tiltX * 0.5, screenY + this.tiltY * 0.5);
    ctx.rotate(this.rotation);
    const squash = 1 / Math.sqrt(this.stretchFactor);
    ctx.scale(this.stretchFactor, squash);

    ctx.fillStyle = skin.coreColor;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.58 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Prism Shield visual ring if active
    if (this.shieldActive) {
      ctx.strokeStyle = primaryCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.radius + 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
