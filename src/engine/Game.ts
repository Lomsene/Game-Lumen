import { Player } from '../entities/Player';
import { Enemy, EnemyProjectile, EnemyType, MortarZone, VoidObelisk, ShadowRift, SolarBurnZone } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Drop } from '../entities/Drop';
import { Weapon, PlayerProjectile } from '../weapons/Weapon';
import { PulseWeapon, OrbitersWeapon, NeedlesWeapon, BeaconWeapon } from '../weapons/WeaponRegistry';
import { ParticleSystem } from './Particle';
import { GameRenderer } from './Renderer';
import { InputManager } from './Input';
import { HUD } from '../ui/HUD';
import { GiftModal } from '../ui/GiftModal';
import { ForgeModal } from '../ui/ForgeModal';
import { forge, PLAYER_CLASSES, PLAYER_SKINS } from '../meta/Forge';
import { sound } from './Sound';

export type GameState = 'menu' | 'playing' | 'paused' | 'levelup' | 'gameover';

export class Game {
  public canvas: HTMLCanvasElement;
  public renderer: GameRenderer;
  public input: InputManager;
  public particles: ParticleSystem;
  public hud: HUD;
  public giftModal: GiftModal;
  public forgeModal: ForgeModal;

  public state: GameState = 'menu';
  public survivalTime: number = 0; // seconds

  // Entities
  public player: Player;
  public enemies: Enemy[] = [];
  public boss: Boss | null = null;
  public drops: Drop[] = [];
  public weapons: Weapon[] = [];
  public playerProjectiles: PlayerProjectile[] = [];
  public enemyProjectiles: EnemyProjectile[] = [];
  public mortarZones: MortarZone[] = [];
  public obelisks: VoidObelisk[] = [];
  public shadowRifts: ShadowRift[] = [];
  public solarZones: SolarBurnZone[] = [];

  // Spawning & Events
  private enemySpawnTimer: number = 0;
  private obeliskSpawnTimer: number = 0;
  private swarmEventTimer: number = 0;
  private riftSpawnTimer: number = 0;
  private lastTime: number = 0;
  private boss1Spawned: boolean = false;
  private boss2Spawned: boolean = false;
  private boss3Spawned: boolean = false;

  // DOM Screen Overlays
  private hudOverlay: HTMLElement | null;
  private mainMenuOverlay: HTMLElement | null;
  private gameoverOverlay: HTMLElement | null;
  private guideOverlay: HTMLElement | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new GameRenderer(canvas);
    this.input = new InputManager();
    this.input.setCanvas(canvas);
    this.particles = new ParticleSystem();
    this.hud = new HUD();
    this.giftModal = new GiftModal();
    this.forgeModal = new ForgeModal();

    this.player = new Player();

    this.hudOverlay = document.getElementById('hud');
    this.mainMenuOverlay = document.getElementById('main-menu');
    this.gameoverOverlay = document.getElementById('gameover-modal');
    this.guideOverlay = document.getElementById('guide-modal');

    this.initEventListeners();
    this.updateMenuStats();

    // Resize listener
    window.addEventListener('resize', () => {
      this.renderer.resize();
    });

    // Start Animation Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private initEventListeners() {
    // Menu buttons
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.startNewRun();
    });

    document.getElementById('btn-open-forge')?.addEventListener('click', () => {
      this.forgeModal.show(() => this.updateMenuStats(), 'upgrades');
    });

    document.getElementById('btn-open-classes')?.addEventListener('click', () => {
      this.forgeModal.show(() => this.updateMenuStats(), 'classes');
    });

    document.getElementById('btn-open-skins')?.addEventListener('click', () => {
      this.forgeModal.show(() => this.updateMenuStats(), 'skins');
    });

    document.getElementById('btn-open-guide')?.addEventListener('click', () => {
      this.guideOverlay?.classList.remove('hidden');
    });

    document.getElementById('btn-close-guide')?.addEventListener('click', () => {
      this.guideOverlay?.classList.add('hidden');
    });

    // Sound toggle
    const soundToggle = document.getElementById('btn-toggle-sound');
    soundToggle?.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      if (soundToggle) {
        soundToggle.textContent = isMuted ? '🔇 Audio: Aus' : '🔊 Audio: An';
      }
    });

    // Pause button
    document.getElementById('pause-btn')?.addEventListener('click', () => {
      this.togglePause();
    });

    // Game Over buttons
    document.getElementById('btn-gameover-restart')?.addEventListener('click', () => {
      this.gameoverOverlay?.classList.add('hidden');
      this.startNewRun();
    });

    document.getElementById('btn-gameover-forge')?.addEventListener('click', () => {
      this.gameoverOverlay?.classList.add('hidden');
      this.hudOverlay?.classList.add('hidden');
      this.forgeModal.show(() => {
        this.updateMenuStats();
        this.mainMenuOverlay?.classList.remove('hidden');
      });
    });

    document.getElementById('btn-gameover-menu')?.addEventListener('click', () => {
      this.gameoverOverlay?.classList.add('hidden');
      this.hudOverlay?.classList.add('hidden');
      this.mainMenuOverlay?.classList.remove('hidden');
      this.updateMenuStats();
      this.state = 'menu';
    });

    // Key shortcut for pause (ESC or P) and restart (Space on Gameover)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing' || this.state === 'paused') {
          this.togglePause();
        }
      } else if (e.code === 'Space' && this.state === 'gameover') {
        this.gameoverOverlay?.classList.add('hidden');
        this.startNewRun();
      }
    });
  }

  public updateMenuStats() {
    const shardsEl = document.getElementById('menu-shards');
    const recordEl = document.getElementById('menu-record');
    const classEl = document.getElementById('menu-active-class');
    const skinEl = document.getElementById('menu-active-skin');
    const orbEl = document.querySelector('.lumen-orb-anim') as HTMLElement | null;

    if (shardsEl) shardsEl.textContent = `${forge.shards}`;
    if (recordEl) {
      const m = Math.floor(forge.bestSurvivalTime / 60);
      const s = Math.floor(forge.bestSurvivalTime % 60);
      recordEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    }
    const cDef = PLAYER_CLASSES[forge.selectedClass] ?? PLAYER_CLASSES.wanderer;
    const sDef = PLAYER_SKINS[forge.selectedSkin] ?? PLAYER_SKINS.cyan;
    if (classEl) classEl.textContent = `${cDef.icon} ${cDef.name}`;
    if (skinEl) skinEl.textContent = sDef.name;
    if (orbEl) {
      if (sDef.ringStyle === 'prismatic') {
        orbEl.style.background = 'conic-gradient(#00f3ff, #a855f7, #ec4899, #fbbf24, #34d399, #00f3ff)';
        orbEl.style.boxShadow = '0 0 35px #ec4899, 0 0 70px rgba(236, 72, 153, 0.5)';
      } else {
        orbEl.style.background = `radial-gradient(circle, ${sDef.coreColor} 0%, ${sDef.primaryColor} 60%, transparent 100%)`;
        orbEl.style.boxShadow = `0 0 35px ${sDef.primaryColor}, 0 0 70px rgba(${sDef.trailRgba}, 0.5)`;
      }
    }
    // Keep live background player skin & class updated in menu!
    if (this.player && this.state === 'menu') {
      this.player.skinId = forge.selectedSkin;
      this.player.classId = forge.selectedClass;
    }
  }

  public startNewRun() {
    // Reset player
    this.player = new Player();
    this.player.initFromForge();

    // Starting weapon based on selected class!
    const classDef = PLAYER_CLASSES[this.player.classId] ?? PLAYER_CLASSES.wanderer;
    switch (classDef.startingWeaponId) {
      case 'orbiters':
        this.weapons = [new OrbitersWeapon()];
        break;
      case 'needles':
        this.weapons = [new NeedlesWeapon()];
        break;
      case 'beacon':
        this.weapons = [new BeaconWeapon()];
        break;
      default:
        this.weapons = [new PulseWeapon()];
        break;
    }

    // Clear state
    this.enemies = [];
    this.boss = null;
    this.drops = [];
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.particles.clear();

    this.survivalTime = 0;
    this.enemySpawnTimer = 0;
    this.obeliskSpawnTimer = 15; // First Obelisk spawns at 20s!
    this.swarmEventTimer = 0;
    this.riftSpawnTimer = 0;
    this.boss1Spawned = false;
    this.boss2Spawned = false;
    this.boss3Spawned = false;
    this.mortarZones = [];
    this.obelisks = [];
    this.shadowRifts = [];
    this.solarZones = [];

    // UI visibility
    this.mainMenuOverlay?.classList.add('hidden');
    this.gameoverOverlay?.classList.add('hidden');
    this.hudOverlay?.classList.remove('hidden');

    this.state = 'playing';
    sound.startAmbience();
  }

  public togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
    } else if (this.state === 'paused') {
      this.state = 'playing';
    }
  }

  private loop(timestamp: number) {
    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const dt = Math.min(rawDt, 0.1); // Cap delta time to prevent physics glitches

    if (this.state === 'playing') {
      this.update(dt);
    }

    // Always render so freeze effects / modals have crisp visuals behind them
    this.renderer.render(
      dt,
      this.player,
      this.enemies,
      this.boss,
      this.drops,
      this.weapons,
      this.playerProjectiles,
      this.enemyProjectiles,
      this.mortarZones,
      this.particles,
      this.obelisks,
      this.shadowRifts,
      this.solarZones
    );

    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number) {
    this.survivalTime += dt;

    // Score over time with total combo multiplier
    this.player.score += dt * 10 * this.player.getTotalMultiplier();

    // Update dynamic soundtrack intensity based on combat pressure
    const bossFactor = this.boss ? 0.45 : 0;
    const swarmFactor = Math.min(0.45, this.enemies.length / 45);
    const overdriveFactor = this.player.overdriveTimer > 0 ? 0.25 : 0;
    sound.setIntensity(0.22 + bossFactor + swarmFactor + overdriveFactor);

    // 1. Input & Player update
    const playerScreenPos = {
      x: this.player.x - this.renderer.cameraX,
      y: this.player.y - this.renderer.cameraY
    };
    const moveInput = this.input.getMovementVector(playerScreenPos);

    if (this.input.consumeDash()) {
      const dashed = this.player.triggerDash();
      if (dashed) {
        // Dash shockwave clears nearby enemy projectiles!
        const phantomBonus = (this.player.passives.get('phantomStep') ?? 0) * 35;
        const dashWaveRadius = 85 + phantomBonus;
        this.particles.emitShockwave(this.player.x, this.player.y, dashWaveRadius, '#00f3ff', 3);
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
          const ep = this.enemyProjectiles[i];
          if (Math.hypot(ep.x - this.player.x, ep.y - this.player.y) < dashWaveRadius + 5) {
            this.particles.emitSpark(ep.x, ep.y, '#00f3ff', 5);
            this.enemyProjectiles.splice(i, 1);
          }
        }
      }
    }

    // Active Ultimate: Supernova / Licht-Opfer (97% Light Sacrifice, 1x per 10 min)
    if (this.input.consumeSupernova()) {
      const sacrificedLight = this.player.triggerSupernova();
      if (sacrificedLight > 0) {
        this.executeSupernovaBlast(sacrificedLight);
      } else if (this.player.supernovaCooldown > 0) {
        const remMin = Math.floor(this.player.supernovaCooldown / 60);
        const remSec = Math.ceil(this.player.supernovaCooldown % 60);
        this.particles.emitBannerText(
          this.player.x,
          this.player.y - 30,
          `SUPERNOVA COOLDOWN (${remMin}:${remSec < 10 ? '0' : ''}${remSec})`,
          '#f43f5e'
        );
      } else {
        this.particles.emitBannerText(this.player.x, this.player.y - 30, 'ZU WENIG LICHT FÜR SUPERNOVA!', '#f43f5e');
      }
    }

    const minutes = this.survivalTime / 60;
    this.player.update(dt, moveInput, this.particles, minutes);

    // 2. Check Player Light death
    if (this.player.light <= 0) {
      this.handleGameOver();
      return;
    }

    // 3. Spawning
    this.handleSpawning(dt);

    // 4. Update Weapons (Auto-aiming!)
    for (const weapon of this.weapons) {
      weapon.update(
        dt,
        this.player,
        this.enemies,
        this.boss,
        this.particles,
        this.playerProjectiles
      );
    }

    // 5. Update Player Projectiles & Collision
    const lightRadius = this.player.getLightRadius();
    for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
      const p = this.playerProjectiles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        if (p.spawnsSolarZone) {
          this.spawnSolarBurnZone(p.x, p.y, p.damage);
        }
        this.playerProjectiles.splice(i, 1);
        continue;
      }

      // Homing logic (all targeted projectiles smoothly steer towards the nearest enemy!)
      if (p.isHoming) {
        let nearestTarget: Enemy | Boss | null = null;
        let minDist = p.boundToLightRadius ? lightRadius + 15 : 750;

        for (const enemy of this.enemies) {
          if (p.boundToLightRadius && Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) > lightRadius + 20) {
            continue;
          }
          const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
          if (d < minDist) {
            minDist = d;
            nearestTarget = enemy;
          }
        }
        if (this.boss && !this.boss.isDefeated) {
          const d = Math.hypot(this.boss.x - p.x, this.boss.y - p.y);
          if (d < minDist) {
            minDist = d;
            nearestTarget = this.boss;
          }
        }

        if (nearestTarget) {
          const targetAngle = Math.atan2(nearestTarget.y - p.y, nearestTarget.x - p.x);
          const curAngle = Math.atan2(p.vy, p.vx);
          const diff = Math.atan2(Math.sin(targetAngle - curAngle), Math.cos(targetAngle - curAngle));
          const turnSpeed = 9.5 * dt;
          const newAngle = curAngle + Math.max(-turnSpeed, Math.min(turnSpeed, diff));
          const spd = p.homingSpeed ?? Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(newAngle) * spd;
          p.vy = Math.sin(newAngle) * spd;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Strictly bind non-Sparks projectiles to the dashed light perimeter line!
      if (p.boundToLightRadius) {
        const distFromPlayer = Math.hypot(p.x - this.player.x, p.y - this.player.y);
        if (distFromPlayer >= lightRadius) {
          if (p.spawnsSolarZone) {
            this.spawnSolarBurnZone(p.x, p.y, p.damage);
          }
          this.particles.emitSpark(p.x, p.y, p.color, 4);
          this.playerProjectiles.splice(i, 1);
          continue;
        }
      }

      // Projectile hit enemies (with Overcharge + Hunter crit check & Sparks chain bounce!)
      const critChance = this.player.getCritChance();
      const critMult = this.player.getCritMultiplier();
      let hit = false;
      for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
        const enemy = this.enemies[eIdx];
        if (Math.hypot(enemy.x - p.x, enemy.y - p.y) < enemy.radius + p.radius) {
          const isCrit = p.bypassesShield || Math.random() < critChance;
          const finalDmg = isCrit ? p.damage * critMult : p.damage;
          const hitOrigin = p.bypassesShield ? undefined : { x: p.x, y: p.y };
          const isDead = enemy.takeDamage(finalDmg, this.particles, hitOrigin, isCrit);

          if (p.staggerStrength && p.staggerStrength > 0) {
            const spd = Math.hypot(p.vx, p.vy) || 1;
            enemy.vx += (p.vx / spd) * p.staggerStrength;
            enemy.vy += (p.vy / spd) * p.staggerStrength;
          }

          if (isDead) {
            this.handleEnemyDefeat(enemy);
            this.enemies.splice(eIdx, 1);
          }

          if (p.spawnsSolarZone) {
            this.spawnSolarBurnZone(p.x, p.y, p.damage);
            p.spawnsSolarZone = false;
          }

          // Sparks Chain-Bounce to another nearby enemy!
          if (p.chainBouncesLeft && p.chainBouncesLeft > 0) {
            p.chainBouncesLeft -= 1;
            let bounceTarget: Enemy | null = null;
            let bDist = 260;
            for (const other of this.enemies) {
              if (other === enemy) continue;
              const d = Math.hypot(other.x - p.x, other.y - p.y);
              if (d < bDist) {
                bDist = d;
                bounceTarget = other;
              }
            }
            if (bounceTarget) {
              const ba = Math.atan2(bounceTarget.y - p.y, bounceTarget.x - p.x);
              const spd = p.homingSpeed ?? 390;
              p.vx = Math.cos(ba) * spd;
              p.vy = Math.sin(ba) * spd;
              p.pierce += 1;
              this.particles.emitSpark(p.x, p.y, '#34d399', 6);
            }
          }

          p.pierce -= 1;
          hit = true;
          if (p.onHitExplode) {
            this.particles.emitExplosion(p.x, p.y, p.color, 18);
          }
          if (p.pierce <= 0) break;
        }
      }

      // Projectile hit boss
      if (!hit && this.boss && Math.hypot(this.boss.x - p.x, this.boss.y - p.y) < this.boss.radius + p.radius) {
        const isCrit = p.bypassesShield || Math.random() < critChance;
        const finalDmg = isCrit ? p.damage * critMult : p.damage;
        const isDead = this.boss.takeDamage(finalDmg, this.particles, isCrit);
        if (isDead) {
          this.handleBossDefeat();
        }
        if (p.spawnsSolarZone) {
          this.spawnSolarBurnZone(p.x, p.y, p.damage);
          p.spawnsSolarZone = false;
        }
        p.pierce -= 1;
        if (p.onHitExplode) {
          this.particles.emitExplosion(p.x, p.y, p.color, 24);
        }
      }

      if (p.pierce <= 0) {
        this.playerProjectiles.splice(i, 1);
      }
    }

    // 6. Update Enemies with minute scaling, swarm separation & Leech light-steal
    const projectileSpeedBonus = 1 + Math.min(0.55, minutes * 0.08);

    // Swarm separation physics: fast squared-distance check so Math.sqrt only runs on overlapping pairs!
    for (let i = 0; i < this.enemies.length; i++) {
      const e1 = this.enemies[i];
      for (let j = i + 1; j < this.enemies.length; j++) {
        const e2 = this.enemies[j];
        const dx = e2.x - e1.x;
        const dy = e2.y - e1.y;
        const minSep = e1.radius + e2.radius + 4;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0.01 && distSq < minSep * minSep) {
          const dist = Math.sqrt(distSq);
          const push = (minSep - dist) * 0.45;
          const nx = dx / dist;
          const ny = dy / dist;
          e1.x -= nx * push;
          e1.y -= ny * push;
          e2.x += nx * push;
          e2.y += ny * push;
        }
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, this.player, this.enemyProjectiles, this.mortarZones, this.particles, projectileSpeedBonus);

      // Check if enemy died from burn/phosphor
      if (enemy.hp <= 0) {
        this.handleEnemyDefeat(enemy);
        this.enemies.splice(i, 1);
        continue;
      }

      // Collision with player
      const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
      if (dist < enemy.radius + this.player.radius) {
        const tookHit = this.player.takeDamage(enemy.damage, this.particles);
        if (tookHit) {
          this.renderer.triggerScreenShake(7, 0.22);
          // Leech steals light, heals itself, and grows until killed!
          if (enemy.type === 'leech') {
            enemy.stolenLight += 12;
            enemy.hp = Math.min(enemy.maxHp * 2, enemy.hp + 35);
            enemy.radius = Math.min(22, enemy.radius + 2.5);
            this.particles.emitBannerText(enemy.x, enemy.y, 'LIGHT STOLEN!', '#c084fc');
          }
        }
      }
    }

    // 6a. Update Solar Burn Zones (from Flare weapon!)
    for (let i = this.solarZones.length - 1; i >= 0; i--) {
      const sz = this.solarZones[i];
      sz.life += dt;
      if (sz.life >= sz.maxLife) {
        this.solarZones.splice(i, 1);
        continue;
      }
      for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
        const enemy = this.enemies[eIdx];
        if (Math.hypot(enemy.x - sz.x, enemy.y - sz.y) <= sz.radius + enemy.radius) {
          enemy.slowTimer = 0.25;
          enemy.hp -= sz.damagePerSec * dt;
          if (enemy.hp <= 0) {
            this.handleEnemyDefeat(enemy);
            this.enemies.splice(eIdx, 1);
          }
        }
      }
      if (this.boss && Math.hypot(this.boss.x - sz.x, this.boss.y - sz.y) <= sz.radius + this.boss.radius) {
        this.boss.takeDamage(sz.damagePerSec * dt, this.particles);
      }
    }

    // 6a-2. Update Shadow Rifts (Gravitational Darkness Hazards)
    for (let i = this.shadowRifts.length - 1; i >= 0; i--) {
      const rift = this.shadowRifts[i];
      rift.life += dt;
      rift.animTimer += dt;
      if (rift.life >= rift.maxLife) {
        this.shadowRifts.splice(i, 1);
        continue;
      }
      const pDist = Math.hypot(this.player.x - rift.x, this.player.y - rift.y);
      if (pDist < rift.radius + 65) {
        // Gentle gravitational pull towards the rift center
        const pull = (1 - pDist / (rift.radius + 65)) * 75;
        const a = Math.atan2(rift.y - this.player.y, rift.x - this.player.x);
        this.player.x += Math.cos(a) * pull * dt;
        this.player.y += Math.sin(a) * pull * dt;
        if (pDist < rift.radius) {
          this.player.inShadowRift = true;
        }
      }
    }

    // 6b. Update Mortar Danger Zones
    for (let i = this.mortarZones.length - 1; i >= 0; i--) {
      const mz = this.mortarZones[i];
      mz.timer += dt;
      if (mz.timer >= mz.maxTime) {
        this.particles.emitExplosion(mz.x, mz.y, '#eab308', 28);
        this.renderer.triggerScreenShake(8, 0.25);
        sound.playPulse();

        // Check if player took hit
        const pDist = Math.hypot(this.player.x - mz.x, this.player.y - mz.y);
        if (pDist <= mz.radius + this.player.radius) {
          this.player.takeDamage(mz.damage, this.particles);
        }
        this.mortarZones.splice(i, 1);
      }
    }

    // 6c. Update Void Obelisks (Risk/Reward Capture Zones)
    const architectSpeedMult =
      1 +
      (this.player.classId === 'architect' ? forge.getLevel('classMasteryArchitect') * 0.12 : 0) +
      (this.player.passives.get('architectGrid') ?? 0) * 0.30;

    for (let i = this.obelisks.length - 1; i >= 0; i--) {
      const ob = this.obelisks[i];
      ob.animTimer += dt;
      const dist = Math.hypot(this.player.x - ob.x, this.player.y - ob.y);

      if (dist <= ob.radius) {
        ob.charge += dt * architectSpeedMult;
        ob.spawnGuardTimer += dt;

        // While charging, Obelisk summons fast Void Stalkers to pressure the player!
        if (ob.spawnGuardTimer >= 1.6 && this.enemies.length < 180) {
          ob.spawnGuardTimer = 0;
          const a = Math.random() * Math.PI * 2;
          const gx = ob.x + Math.cos(a) * 240;
          const gy = ob.y + Math.sin(a) * 240;
          const hpScale = Math.pow(1.28, this.survivalTime / 60);
          this.enemies.push(new Enemy(gx, gy, 'stalker', hpScale, false));
          this.particles.emitSpark(gx, gy, '#a855f7', 10);
        }

        if (ob.charge >= ob.maxCharge) {
          // Obelisk Captured -> PRISMA NOVA + OVERDRIVE!
          this.particles.emitShockwave(ob.x, ob.y, 420, '#fbbf24', 8);
          this.particles.emitExplosion(ob.x, ob.y, '#a855f7', 45);
          this.particles.emitBannerText(this.player.x, this.player.y, 'OBELISK OVERDRIVE! +35 LIGHT', '#fbbf24');
          this.renderer.triggerScreenShake(14, 0.4);
          sound.playLevelUp();

          this.player.addLight(35);
          this.player.overdriveTimer = 8.0; // 8s of supercharged fire rate & speed

          // Damage nearby enemies in the nova blast
          for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
            const enemy = this.enemies[eIdx];
            if (Math.hypot(enemy.x - ob.x, enemy.y - ob.y) <= 380) {
              const dead = enemy.takeDamage(180, this.particles, { x: ob.x, y: ob.y }, true);
              if (dead) {
                this.handleEnemyDefeat(enemy);
                this.enemies.splice(eIdx, 1);
              }
            }
          }

          // Drop guaranteed Shards & Light
          for (let s = 0; s < 4; s++) {
            this.drops.push(new Drop(ob.x, ob.y, 'shard', 1));
          }
          this.obelisks.splice(i, 1);
        }
      } else {
        ob.charge = Math.max(0, ob.charge - dt * 0.4);
      }
    }

    // 7. Update Boss
    if (this.boss && !this.boss.isDefeated) {
      this.boss.update(dt, this.player, this.enemyProjectiles, this.particles, this.drops);
      const bDist = Math.hypot(this.boss.x - this.player.x, this.boss.y - this.player.y);
      if (bDist < this.boss.radius + this.player.radius) {
        this.player.takeDamage(30, this.particles);
        this.renderer.triggerScreenShake(12, 0.35);
      }
    }

    // 8. Update Enemy Projectiles (and check Orbiters projectile deflection!)
    const activeOrbiters = this.weapons.find((w) => w instanceof OrbitersWeapon) as OrbitersWeapon | undefined;
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      ep.life += dt;
      if (ep.life >= ep.maxLife) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
      ep.x += ep.vx * dt;
      ep.y += ep.vy * dt;

      // Check if Orbiters block this enemy projectile!
      if (activeOrbiters) {
        let deflected = false;
        for (const orb of activeOrbiters.currentOrbPositions) {
          if (Math.hypot(ep.x - orb.x, ep.y - orb.y) < ep.radius + 12) {
            this.particles.emitSpark(ep.x, ep.y, '#38bdf8', 6);
            this.enemyProjectiles.splice(i, 1);
            deflected = true;
            break;
          }
        }
        if (deflected) continue;
      }

      // Check collision with player
      if (Math.hypot(ep.x - this.player.x, ep.y - this.player.y) < ep.radius + this.player.radius) {
        this.player.takeDamage(ep.damage, this.particles);
        this.renderer.triggerScreenShake(8, 0.25);
        this.enemyProjectiles.splice(i, 1);
      }
    }

    // 9. Update Drops (Light & Shards)
    const magnetRadius = this.player.getMagnetRadius();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const alive = drop.update(dt, this.player.x, this.player.y, magnetRadius);

      if (drop.isCollected) {
        if (drop.type === 'light') {
          this.player.addLight(drop.value);
          sound.playShard(false);
        } else {
          this.player.shardsCollectedThisRun += drop.value;
          sound.playShard(true);
        }
        this.particles.emitSpark(drop.x, drop.y, drop.color, 6);
        this.drops.splice(i, 1);
      } else if (!alive) {
        this.drops.splice(i, 1);
      }
    }

    // 10. Update Particles
    this.particles.update(dt);

    // 11. Update HUD
    this.hud.update(this.player, this.survivalTime, this.boss, this.weapons);
  }

  private handleSpawning(dt: number) {
    this.enemySpawnTimer += dt;
    this.obeliskSpawnTimer += dt;
    this.swarmEventTimer += dt;

    // Boss spawns at 2m (120s), 4m30s (270s), 7m30s (450s) so action escalates much faster!
    if (this.survivalTime >= 120 && !this.boss1Spawned) {
      this.boss1Spawned = true;
      this.spawnBoss(1);
    } else if (this.survivalTime >= 270 && !this.boss2Spawned) {
      this.boss2Spawned = true;
      this.spawnBoss(2);
    } else if (this.survivalTime >= 450 && !this.boss3Spawned) {
      this.boss3Spawned = true;
      this.spawnBoss(3);
    }

    // Spawn Void Obelisks every 35 seconds (max 2 active at once)
    if (this.obeliskSpawnTimer >= 35 && this.obelisks.length < 2) {
      this.obeliskSpawnTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      const dist = 360 + Math.random() * 240;
      let ox = this.player.x + Math.cos(angle) * dist;
      let oy = this.player.y + Math.sin(angle) * dist;
      const dCenter = Math.hypot(ox, oy);
      if (dCenter > Player.ARENA_RADIUS - 140) {
        const a = Math.atan2(oy, ox);
        ox = Math.cos(a) * (Player.ARENA_RADIUS - 140);
        oy = Math.sin(a) * (Player.ARENA_RADIUS - 140);
      }
      this.obelisks.push({
        x: ox,
        y: oy,
        radius: 95,
        charge: 0,
        maxCharge: 4.5,
        animTimer: 0,
        spawnGuardTimer: 0
      });
      this.particles.emitBannerText(this.player.x, this.player.y, 'VOID OBELISK MANIFESTED!', '#c084fc');
    }

    // Coordinated Swarm Ambush Events every 48 seconds (paused while a Boss is active!)
    if (this.swarmEventTimer >= 48 && !this.boss && this.enemies.length < 110) {
      this.swarmEventTimer = 0;
      this.spawnSwarmRing();
    }

    // Spawn Shadow Rifts starting at 45s (gravitational light-draining hazards)
    this.riftSpawnTimer += dt;
    if (this.survivalTime >= 45 && this.riftSpawnTimer >= 28 && this.shadowRifts.length < 3) {
      this.riftSpawnTimer = 0;
      const a = Math.random() * Math.PI * 2;
      const d = 180 + Math.random() * 220;
      this.shadowRifts.push({
        x: this.player.x + Math.cos(a) * d,
        y: this.player.y + Math.sin(a) * d,
        radius: 85,
        life: 0,
        maxLife: 18,
        animTimer: 0
      });
    }

    // Spawn rate: scales with time AND player's light, but slows down by 40% during Boss fights!
    const lightFactor = this.player.light / 100;
    const timeFactor = 1 + this.survivalTime / 78;
    const bossSlowdown = this.boss && !this.boss.isDefeated ? 1.65 : 1.0;
    const spawnInterval = Math.max(0.26, (1.35 * bossSlowdown) / (timeFactor * (0.75 + lightFactor * 0.45)));
    const maxEnemies = this.boss && !this.boss.isDefeated ? 75 : 130;

    if (this.enemySpawnTimer >= spawnInterval && this.enemies.length < maxEnemies) {
      this.enemySpawnTimer = 0;
      // Spawn packs of 1-2 enemies (only 1 during boss fight so you aren't overwhelmed!)
      const packSize = this.boss ? 1 : this.survivalTime > 110 ? 2 : this.survivalTime > 45 && Math.random() < 0.45 ? 2 : 1;
      for (let p = 0; p < packSize; p++) {
        this.spawnEnemyWave();
      }
    }
  }

  private spawnSwarmRing() {
    const minutes = this.survivalTime / 60;
    const hpScaling = Math.pow(1.30, minutes) * 0.78;
    const count = Math.min(12, 8 + Math.floor(minutes * 1.5));
    const ringRadius = 460;

    this.particles.emitBannerText(this.player.x, this.player.y, '⚠ SWARM ENCIRCLEMENT ⚠', '#f43f5e');
    sound.playBossAlarm();

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      let sx = this.player.x + Math.cos(a) * ringRadius;
      let sy = this.player.y + Math.sin(a) * ringRadius;
      const dCenter = Math.hypot(sx, sy);
      if (dCenter > Player.ARENA_RADIUS - 40) {
        const ca = Math.atan2(sy, sx);
        sx = Math.cos(ca) * (Player.ARENA_RADIUS - 40);
        sy = Math.sin(ca) * (Player.ARENA_RADIUS - 40);
      }
      const swarmType: EnemyType = minutes >= 1.5 && i % 4 === 0 ? 'stalker' : 'mote';
      this.enemies.push(new Enemy(sx, sy, swarmType, hpScaling, false));
    }
  }

  private executeSupernovaBlast(sacrificedLight: number) {
    const px = this.player.x;
    const py = this.player.y;

    const catalystLvl = forge.getLevel('supernovaCatalyst');
    const ascensionLvl = this.player.passives.get('novaAscension') ?? 0;
    const dmgBonusMult = 1 + catalystLvl * 0.25 + ascensionLvl * 0.45;
    const blastDamage = (500 + sacrificedLight * 18) * dmgBonusMult;

    // 1. Massive dual shockwaves + explosion + screen shake
    this.particles.emitShockwave(px, py, 950, '#fbbf24', 12);
    this.particles.emitShockwave(px, py, 650, '#00f3ff', 8);
    this.particles.emitExplosion(px, py, '#fbbf24', 65);
    this.particles.emitBannerText(px, py - 24, '⚡ SUPERNOVA OPFER! (-97% LICHT) ⚡', '#fbbf24');
    this.renderer.triggerScreenShake(24, 0.75);

    // 2. Wipe all enemy projectiles, mortar zones, and shadow rifts
    for (const ep of this.enemyProjectiles) {
      this.particles.emitSpark(ep.x, ep.y, '#fbbf24', 3);
    }
    this.enemyProjectiles = [];
    this.mortarZones = [];
    this.shadowRifts = [];

    // 3. Devastate all enemies on screen / within 1150px
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const d = Math.hypot(enemy.x - px, enemy.y - py);
      if (d <= 1150) {
        enemy.slowTimer = 5.0; // Freeze/slow survivors
        const isDead = enemy.takeDamage(blastDamage, this.particles, undefined, true);
        if (isDead) {
          this.handleEnemyDefeat(enemy);
          this.enemies.splice(i, 1);
        }
      }
    }

    // 4. Heavy damage to Boss if active
    if (this.boss && !this.boss.isDefeated) {
      const bossDead = this.boss.takeDamage(blastDamage * 0.65, this.particles, true);
      if (bossDead) {
        this.handleBossDefeat();
      }
    }

    // 5. Leave a ring of 6 Solar Burn Zones around the player to protect them while at 3% Light!
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const zx = px + Math.cos(a) * 105;
      const zy = py + Math.sin(a) * 105;
      this.spawnSolarBurnZone(zx, zy, 95 * dmgBonusMult);
    }
  }

  private spawnSolarBurnZone(x: number, y: number, baseDmg: number) {
    this.solarZones.push({
      x,
      y,
      radius: 68,
      damagePerSec: baseDmg * 0.65,
      life: 0,
      maxLife: 3.2
    });
    this.particles.emitExplosion(x, y, '#f97316', 22);
  }

  private spawnEnemyWave() {
    const minutes = this.survivalTime / 60;
    // Balanced dynamic scaling: +32% HP and +6% speed per elapsed minute!
    const hpScaling = Math.pow(1.32, minutes);
    const speedScaling = 1 + Math.min(0.5, minutes * 0.06);

    // Faster enemy variety progression so combat stays exciting right from the first minute!
    const types: EnemyType[] = ['mote', 'mote'];
    if (this.survivalTime > 15) types.push('splitter', 'leech');
    if (this.survivalTime > 30) types.push('stalker');
    if (this.survivalTime > 45) types.push('charger');
    if (this.survivalTime >= 60) types.push('spitter', 'phantom');
    if (this.survivalTime >= 95) types.push('scatterer', 'sniper');
    if (this.survivalTime >= 140) types.push('mortar', 'vanguard');
    if (this.survivalTime >= 190) types.push('behemoth', 'eclipseOrb');

    const chosenType = types[Math.floor(Math.random() * types.length)];

    // Elite Champions appear starting at 0:50
    let isElite = false;
    if (this.survivalTime >= 50) {
      const eliteChance = Math.min(0.32, 0.08 + minutes * 0.04);
      isElite = Math.random() < eliteChance;
    }

    // Spawn just outside the player's screen view, clamped inside the vast circular arena
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(window.innerWidth, window.innerHeight) * 0.58 + Math.random() * 80;
    let spawnX = this.player.x + Math.cos(angle) * dist;
    let spawnY = this.player.y + Math.sin(angle) * dist;

    const spawnDistCenter = Math.hypot(spawnX, spawnY);
    if (spawnDistCenter > Player.ARENA_RADIUS - 40) {
      const a = Math.atan2(spawnY, spawnX);
      spawnX = Math.cos(a) * (Player.ARENA_RADIUS - 40);
      spawnY = Math.sin(a) * (Player.ARENA_RADIUS - 40);
    }

    this.enemies.push(new Enemy(spawnX, spawnY, chosenType, hpScaling, isElite, speedScaling));
  }

  private spawnBoss(bossId: number) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 520;
    let bx = this.player.x + Math.cos(angle) * dist;
    let by = this.player.y + Math.sin(angle) * dist;

    const bDistCenter = Math.hypot(bx, by);
    if (bDistCenter > Player.ARENA_RADIUS - 80) {
      const a = Math.atan2(by, bx);
      bx = Math.cos(a) * (Player.ARENA_RADIUS - 80);
      by = Math.sin(a) * (Player.ARENA_RADIUS - 80);
    }

    this.boss = new Boss(bossId, bx, by);
    this.renderer.triggerScreenShake(20, 0.8);
  }

  private handleEnemyDefeat(enemy: Enemy) {
    this.player.registerKill();
    this.player.score += enemy.scoreValue * this.player.getTotalMultiplier();

    // Balanced Light Mote recovery (5.0-8.0 base light + returns any stolen Leech light!)
    const harvesterLvl = this.player.passives.get('lightHarvester') ?? 0;
    const vanguardLightMastery = this.player.classId === 'vanguard' ? forge.getLevel('classMasteryVanguard') * 0.10 : 0;
    const baseLight = enemy.isElite ? 22 : (5.0 + Math.random() * 3.0);
    const lightVal = baseLight * (1 + harvesterLvl * 0.3 + vanguardLightMastery) + enemy.stolenLight;
    this.drops.push(new Drop(enemy.x, enemy.y, 'light', lightVal));

    // Chance to drop Forge Shard (currency) - Guaranteed 3-5 shards for Elites!
    if (enemy.isElite) {
      const shardBonus = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < shardBonus; i++) {
        this.drops.push(new Drop(enemy.x, enemy.y, 'shard', 1));
      }
      this.particles.emitShockwave(enemy.x, enemy.y, 80, '#fbbf24', 4);
    } else {
      const greedBonus = forge.getLevel('shardGreed') * 0.08;
      const shardChance = Math.min(0.85, 0.45 + greedBonus);
      if (Math.random() < shardChance) {
        this.drops.push(new Drop(enemy.x, enemy.y, 'shard', 1));
      }
    }

    // Splitter enemy spawns 2 small motes
    if (enemy.type === 'splitter') {
      const minutes = this.survivalTime / 60;
      const hpScaling = Math.pow(1.20, minutes);
      this.enemies.push(new Enemy(enemy.x + 12, enemy.y, 'mote', hpScaling * 0.7));
      this.enemies.push(new Enemy(enemy.x - 12, enemy.y, 'mote', hpScaling * 0.7));
    }

    // Add XP & check Level Up
    const leveledUp = this.player.addXp(enemy.xpValue);
    if (leveledUp) {
      this.triggerLevelUp();
    }
  }

  private handleBossDefeat() {
    if (!this.boss) return;
    this.boss.dropRewards(this.drops);
    this.player.score += 2500 * this.player.scoreMultiplier;
    this.renderer.triggerScreenShake(20, 0.8);
    this.boss = null;
  }

  private triggerLevelUp() {
    this.state = 'levelup';
    const rerollBonus = forge.getLevel('fortuneReroll');
    this.giftModal.show(this.player, this.weapons, rerollBonus, () => {
      this.state = 'playing';
    });
  }

  private handleGameOver() {
    this.state = 'gameover';
    sound.stopAmbience();
    sound.playEnemyDeath();

    // Persist shards to Forge & update highscores
    forge.addShards(this.player.shardsCollectedThisRun);
    forge.recordRun(this.survivalTime, this.player.score);

    // Update Game Over Modal elements
    const statTime = document.getElementById('stat-time');
    const statScore = document.getElementById('stat-score');
    const statKills = document.getElementById('stat-kills');
    const statShards = document.getElementById('stat-shards');

    const m = Math.floor(this.survivalTime / 60);
    const s = Math.floor(this.survivalTime % 60);
    if (statTime) statTime.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    if (statScore) statScore.textContent = `${Math.floor(this.player.score)}`;
    if (statKills) statKills.textContent = `${this.player.kills}`;
    if (statShards) statShards.textContent = `✨ ${this.player.shardsCollectedThisRun}`;

    this.gameoverOverlay?.classList.remove('hidden');
  }
}
