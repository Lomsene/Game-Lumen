import { Player } from '../entities/Player';
import { Enemy, EnemyProjectile, EnemyType, MortarZone, VoidObelisk, ShadowRift, SolarBurnZone } from '../entities/Enemy';
import { Boss, BossSpawnRequests } from '../entities/Boss';
import { Drop } from '../entities/Drop';
import { Weapon, PlayerProjectile } from '../weapons/Weapon';
import { OrbitersWeapon } from '../weapons/WeaponRegistry';
import { createWeapon } from '../upgrades/UpgradePool';
import { ParticleSystem } from './Particle';
import { GameRenderer } from './Renderer';
import { InputManager } from './Input';
import { SpatialGrid } from './SpatialGrid';
import { Balance } from './Balance';
import { HUD } from '../ui/HUD';
import { GiftModal } from '../ui/GiftModal';
import { ForgeModal } from '../ui/ForgeModal';
import { MenuUI } from '../ui/MenuUI';
import { forge, PLAYER_CLASSES, PLAYER_SKINS } from '../meta/Forge';
import { settings, haptic } from '../meta/Settings';
import { sound } from './Sound';

export type GameState = 'menu' | 'playing' | 'paused' | 'levelup' | 'gameover';

/** Fixed simulation step: identical game speed on 60/90/120/144 Hz displays. */
const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

export class Game {
  public canvas: HTMLCanvasElement;
  public renderer: GameRenderer;
  public input: InputManager;
  public particles: ParticleSystem;
  public hud: HUD;
  public giftModal: GiftModal;
  public forgeModal: ForgeModal;
  public menus: MenuUI;

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

  private enemyGrid = new SpatialGrid<Enemy>(64);
  private bossSpawns: BossSpawnRequests = { minions: [], rifts: [] };

  // Spawning & events
  private enemySpawnTimer: number = 0;
  private obeliskSpawnTimer: number = 0;
  private swarmEventTimer: number = 0;
  private riftSpawnTimer: number = 0;
  private lastTime: number = 0;
  private accumulator: number = 0;
  /** Frames rendered since the game stopped simulating (menus/pause only need one). */
  private staticFrames: number = 0;

  // Endless boss chain
  private nextBossNumber: number = 1;
  private bossFreeTimer: number = 0;
  public bossesDefeated: number = 0;

  // Level-ups are queued so multi-level XP gains are never lost or skipped
  private pendingLevelUps: number = 0;
  private pendingStartGifts: number = 0;

  // Tutorial hints (first run only)
  private tutorialStep: number = 0;

  // DOM Screen Overlays
  private hudOverlay: HTMLElement | null;
  private mainMenuOverlay: HTMLElement | null;
  private gameoverOverlay: HTMLElement | null;
  private guideOverlay: HTMLElement | null;
  private fpsEl: HTMLElement | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new GameRenderer(canvas);
    this.input = new InputManager();
    this.particles = new ParticleSystem();
    this.renderer.attachParticles(this.particles);
    this.particles.showDamageNumbers = settings.data.damageNumbers;
    this.hud = new HUD();
    this.giftModal = new GiftModal();
    this.forgeModal = new ForgeModal();
    this.menus = new MenuUI({
      onResume: () => this.resume(),
      onQuit: () => this.quitRun(),
      getBuildInfo: () => ({ player: this.player, weapons: this.weapons, survivalTime: this.survivalTime })
    });

    this.player = new Player();

    this.hudOverlay = document.getElementById('hud');
    this.mainMenuOverlay = document.getElementById('main-menu');
    this.gameoverOverlay = document.getElementById('gameover-modal');
    this.guideOverlay = document.getElementById('guide-modal');
    this.fpsEl = document.getElementById('fps-counter');

    settings.onChange((s) => {
      this.particles.showDamageNumbers = s.damageNumbers;
      sound.applySettings();
      this.fpsEl?.classList.toggle('hidden', !s.showFps);
      this.staticFrames = 0; // Quality changes resize (and clear) the canvas - redraw it
    });
    this.fpsEl?.classList.toggle('hidden', !settings.data.showFps);
    sound.applySettings();

    this.initEventListeners();
    this.updateMenuStats();

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.staticFrames = 0;
    });

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private initEventListeners() {
    document.getElementById('btn-start-game')?.addEventListener('click', () => this.startNewRun());
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
    document.getElementById('btn-open-settings')?.addEventListener('click', () => this.menus.showSettings());

    document.getElementById('pause-btn')?.addEventListener('click', () => this.pause());

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
      this.state = 'menu';
    });
    document.getElementById('btn-gameover-menu')?.addEventListener('click', () => this.showMainMenu());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      } else if (e.code === 'Enter' && this.state === 'gameover') {
        this.gameoverOverlay?.classList.add('hidden');
        this.startNewRun();
      }
    });

    // Auto-pause when the app/tab goes into the background
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'playing') this.pause();
        sound.suspend();
      } else {
        sound.resume();
      }
    });
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.pause();
    });

    // Android hardware back button (dispatched by MainActivity)
    window.addEventListener('aether-back', () => {
      if (this.menus.closeTopOverlay()) return;
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    });
  }

  public updateMenuStats() {
    const shardsEl = document.getElementById('menu-shards');
    const recordEl = document.getElementById('menu-record');
    const bossRecordEl = document.getElementById('menu-boss-record');
    const classEl = document.getElementById('menu-active-class');
    const skinEl = document.getElementById('menu-active-skin');
    const orbEl = document.querySelector('.lumen-orb-anim') as HTMLElement | null;

    if (shardsEl) shardsEl.textContent = `${forge.shards}`;
    if (recordEl) recordEl.textContent = formatTime(forge.bestSurvivalTime);
    if (bossRecordEl) bossRecordEl.textContent = `${forge.bestBossesDefeated}`;
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
    if (this.player && this.state === 'menu') {
      this.player.skinId = forge.selectedSkin;
      this.player.classId = forge.selectedClass;
    }
  }

  public startNewRun() {
    this.player = new Player();
    this.player.initFromForge();

    // Starting weapon from class, pre-levelled by the "Vorbereitung" forge upgrade
    const classDef = PLAYER_CLASSES[this.player.classId] ?? PLAYER_CLASSES.wanderer;
    const startWeapon = createWeapon(classDef.startingWeaponId) ?? createWeapon('pulse')!;
    for (let i = 0; i < forge.getLevel('headStart'); i++) startWeapon.upgrade();
    this.weapons = [startWeapon];

    this.enemies = [];
    this.boss = null;
    this.drops = [];
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.mortarZones = [];
    this.obelisks = [];
    this.shadowRifts = [];
    this.solarZones = [];
    this.particles.clear();

    this.survivalTime = 0;
    this.enemySpawnTimer = 0;
    this.obeliskSpawnTimer = 15; // First Obelisk after ~20s
    this.swarmEventTimer = 0;
    this.riftSpawnTimer = 0;
    this.nextBossNumber = 1;
    this.bossFreeTimer = 0;
    this.bossesDefeated = 0;
    this.pendingLevelUps = 0;
    this.pendingStartGifts = forge.getLevel('firstGift');
    this.tutorialStep = settings.data.tutorialSeen ? -1 : 0;
    this.accumulator = 0;

    this.renderer.cameraX = this.player.x - this.renderer.viewWidth / 2;
    this.renderer.cameraY = this.player.y - this.renderer.viewHeight / 2;

    this.mainMenuOverlay?.classList.add('hidden');
    this.gameoverOverlay?.classList.add('hidden');
    this.hudOverlay?.classList.remove('hidden');
    this.hud.reset();

    this.input.clearActions();
    this.state = 'playing';
    sound.startAmbience();
  }

  public pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.clearActions();
    this.menus.showPause();
  }

  public resume() {
    if (this.state !== 'paused') return;
    this.menus.hidePause();
    this.input.clearActions();
    this.state = 'playing';
    this.lastTime = performance.now();
  }

  private quitRun() {
    this.menus.hidePause();
    this.handleGameOver();
  }

  private showMainMenu() {
    this.gameoverOverlay?.classList.add('hidden');
    this.hudOverlay?.classList.add('hidden');
    this.mainMenuOverlay?.classList.remove('hidden');
    this.state = 'menu';
    this.updateMenuStats();
  }

  private loop(timestamp: number) {
    const frameMs = timestamp - this.lastTime;
    this.lastTime = timestamp;
    const frameDt = Math.min(frameMs / 1000, 0.1);

    if (this.state === 'playing') {
      this.renderer.reportFrameTime(frameMs);
      this.staticFrames = 0;
      this.accumulator += frameDt;
      let steps = 0;
      while (this.accumulator >= STEP && steps < MAX_STEPS_PER_FRAME && this.state === 'playing') {
        this.update(STEP);
        this.accumulator -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0; // Device too slow - drop the backlog
      this.hud.update(this.player, this.survivalTime, this.boss, this.weapons, this.getPhaseLabel());
      this.processLevelUpQueue();
    } else {
      this.accumulator = 0;
      this.staticFrames++;
    }

    // While paused / in menus the scene is frozen: render a couple of frames, then idle (saves battery)
    if (this.staticFrames > 3) {
      requestAnimationFrame((t) => this.loop(t));
      return;
    }

    this.renderer.render(
      frameDt,
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

    if (this.fpsEl && settings.data.showFps) {
      this.fpsEl.textContent = `${Math.round(this.renderer.fps)} FPS • ${this.renderer.quality.toUpperCase()} • ${this.enemies.length} E • ${this.particles.particles.length} P`;
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  private getPhaseLabel(): string {
    if (this.boss && !this.boss.isDefeated) return this.boss.name;
    const remaining = Math.max(0, Balance.bossInterval(this.nextBossNumber) - this.bossFreeTimer);
    return `BOSS ${this.nextBossNumber} IN ${formatTime(remaining)}`;
  }

  private processLevelUpQueue() {
    if (this.state !== 'playing') return;
    if (this.pendingStartGifts > 0) {
      this.pendingStartGifts -= 1;
      this.openGiftModal('STARTGABE');
    } else if (this.pendingLevelUps > 0) {
      this.pendingLevelUps -= 1;
      this.openGiftModal(`LEVEL ${this.player.level - this.pendingLevelUps}`);
    }
  }

  private openGiftModal(label: string) {
    this.state = 'levelup';
    this.input.clearActions();
    haptic(25);
    const rerollBonus = forge.getLevel('fortuneReroll');
    this.giftModal.show(this.player, this.weapons, rerollBonus, label, () => {
      this.input.clearActions();
      this.state = 'playing';
      this.lastTime = performance.now();
    });
  }

  private update(dt: number) {
    this.survivalTime += dt;
    const minutes = this.survivalTime / 60;
    const player = this.player;

    player.score += dt * 10 * player.getTotalMultiplier();

    const bossFactor = this.boss ? 0.45 : 0;
    const swarmFactor = Math.min(0.45, this.enemies.length / 45);
    const overdriveFactor = player.overdriveTimer > 0 ? 0.25 : 0;
    sound.setIntensity(0.22 + bossFactor + swarmFactor + overdriveFactor);

    this.updateTutorial();

    // 1. Input & player
    const playerScreenPos = { x: player.x - this.renderer.cameraX, y: player.y - this.renderer.cameraY };
    const moveInput = this.input.getMovementVector(playerScreenPos);

    if (this.input.consumeDash() && player.triggerDash()) {
      // Dash shockwave clears nearby enemy projectiles
      const phantomBonus = (player.passives.get('phantomStep') ?? 0) * 35;
      const dashWaveRadius = 85 + phantomBonus;
      this.particles.emitShockwave(player.x, player.y, dashWaveRadius, '#00f3ff', 3);
      const r2 = (dashWaveRadius + 5) ** 2;
      this.enemyProjectiles = this.enemyProjectiles.filter((ep) => {
        const hit = (ep.x - player.x) ** 2 + (ep.y - player.y) ** 2 < r2;
        if (hit) this.particles.emitSpark(ep.x, ep.y, '#00f3ff', 3);
        return !hit;
      });
    }

    if (this.input.consumeSupernova()) {
      const sacrificedLight = player.triggerSupernova();
      if (sacrificedLight > 0) {
        this.executeSupernovaBlast(sacrificedLight, minutes);
      } else if (!player.isNovaReady()) {
        const pct = Math.floor((player.novaCharge / player.getNovaChargeNeeded()) * 100);
        this.particles.emitBannerText(player.x, player.y - 30, `SUPERNOVA LÄDT… ${pct}%`, '#f43f5e');
      } else {
        this.particles.emitBannerText(player.x, player.y - 30, 'ZU WENIG LICHT FÜR SUPERNOVA!', '#f43f5e');
      }
    }

    player.update(dt, moveInput, this.particles, minutes);

    if (player.light <= 0) {
      this.handleGameOver();
      return;
    }

    // 2. Spawning
    this.handleSpawning(dt);

    // Spatial grid for this step (separation, projectile hits)
    this.enemyGrid.rebuild(this.enemies);

    // 3. Weapons (auto-aim)
    for (const weapon of this.weapons) {
      weapon.update(dt, player, this.enemies, this.boss, this.particles, this.playerProjectiles);
    }

    // 4. Player projectiles
    this.updatePlayerProjectiles(dt);

    // 5. Enemies: separation, AI, contact damage
    this.separateEnemies();
    const projectileSpeedBonus = 1 + Math.min(0.55, minutes * 0.08);
    const lightRadius = player.getLightRadius();
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.update(dt, player, this.enemyProjectiles, this.mortarZones, this.particles, projectileSpeedBonus, lightRadius);

      const hitDist = enemy.radius + player.hurtRadius;
      if ((enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2 < hitDist * hitDist) {
        if (player.takeDamage(enemy.damage, this.particles)) {
          this.onPlayerHit(7);
          // Leech steals light, heals itself, and grows until killed
          if (enemy.type === 'leech') {
            enemy.stolenLight += 12;
            enemy.hp = Math.min(enemy.maxHp * 2, enemy.hp + 35);
            enemy.radius = Math.min(22, enemy.radius + 2.5);
            this.particles.emitBannerText(enemy.x, enemy.y, 'LICHT GESTOHLEN!', '#c084fc');
          }
        }
      }
    }

    // 6. Hazards & zones
    this.updateSolarZones(dt);
    this.updateShadowRifts(dt);
    this.updateMortarZones(dt);
    this.updateObelisks(dt);

    // 7. Boss
    if (this.boss && !this.boss.isDefeated) {
      const boss = this.boss;
      boss.update(dt, player, this.enemyProjectiles, this.mortarZones, this.particles, this.bossSpawns);
      this.consumeBossSpawns(minutes);
      const hit = boss.radius + player.hurtRadius;
      if ((boss.x - player.x) ** 2 + (boss.y - player.y) ** 2 < hit * hit) {
        const contactDmg = 28 * Balance.bossDamageScale(boss.bossNumber) * (boss.isCharging ? 1.4 : 1);
        if (player.takeDamage(contactDmg, this.particles)) this.onPlayerHit(12);
      }
    }

    // 8. Enemy projectiles (Orbiters can block them)
    this.updateEnemyProjectiles(dt);

    // 9. Resolve all deaths from every damage source in one place
    this.resolveDeaths();

    // 10. Drops
    this.updateDrops(dt);

    // 11. Particles
    this.particles.update(dt);
  }

  private onPlayerHit(shake: number) {
    this.renderer.triggerScreenShake(shake, 0.22);
    haptic(40);
  }

  private updatePlayerProjectiles(dt: number) {
    const player = this.player;
    const lightRadius = player.getLightRadius();
    const critChance = player.getCritChance();
    const critMult = player.getCritMultiplier();
    const boss = this.boss && !this.boss.isDefeated ? this.boss : null;

    for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
      const p = this.playerProjectiles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        if (p.spawnsSolarZone) this.spawnSolarBurnZone(p.x, p.y, p.damage);
        this.removePlayerProjectile(i);
        continue;
      }

      // Homing: steer towards the nearest living target
      if (p.isHoming) {
        let nearestTarget: Enemy | Boss | null = null;
        const searchR = p.boundToLightRadius ? lightRadius + 15 : 750;
        let minDistSq = searchR * searchR;
        const boundSq = (lightRadius + 20) ** 2;
        for (const enemy of this.enemyGrid.query(p.x, p.y, Math.min(searchR, 420))) {
          if (enemy.dead) continue;
          if (p.boundToLightRadius && (enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2 > boundSq) continue;
          const d = (enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2;
          if (d < minDistSq) {
            minDistSq = d;
            nearestTarget = enemy;
          }
        }
        if (boss) {
          const d = (boss.x - p.x) ** 2 + (boss.y - p.y) ** 2;
          if (d < minDistSq) nearestTarget = boss;
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

      // Most projectiles end at the dashed light perimeter
      if (p.boundToLightRadius && (p.x - player.x) ** 2 + (p.y - player.y) ** 2 >= lightRadius * lightRadius) {
        if (p.spawnsSolarZone) this.spawnSolarBurnZone(p.x, p.y, p.damage);
        this.particles.emitSpark(p.x, p.y, p.color, 2);
        this.removePlayerProjectile(i);
        continue;
      }

      let hit = false;
      for (const enemy of this.enemyGrid.query(p.x, p.y, p.radius)) {
        if (enemy.dead) continue;
        const rr = enemy.radius + p.radius;
        if ((enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2 >= rr * rr) continue;

        const isCrit = p.bypassesShield || Math.random() < critChance;
        const finalDmg = isCrit ? p.damage * critMult : p.damage;
        const hitOrigin = p.bypassesShield ? undefined : { x: p.x, y: p.y };
        enemy.takeDamage(finalDmg, this.particles, hitOrigin, isCrit);

        if (p.staggerStrength && p.staggerStrength > 0) {
          const spd = Math.hypot(p.vx, p.vy) || 1;
          enemy.applyKnockback((p.vx / spd) * p.staggerStrength, (p.vy / spd) * p.staggerStrength);
        }
        if (p.spawnsSolarZone) {
          this.spawnSolarBurnZone(p.x, p.y, p.damage);
          p.spawnsSolarZone = false;
        }

        // Sparks chain-bounce to another nearby enemy
        if (p.chainBouncesLeft && p.chainBouncesLeft > 0) {
          p.chainBouncesLeft -= 1;
          let bounceTarget: Enemy | null = null;
          let bDist = 260 * 260;
          for (const other of this.enemyGrid.query(p.x, p.y, 260)) {
            if (other === enemy || other.dead) continue;
            const d = (other.x - p.x) ** 2 + (other.y - p.y) ** 2;
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
            this.particles.emitSpark(p.x, p.y, '#34d399', 4);
          }
        }

        p.pierce -= 1;
        hit = true;
        if (p.onHitExplode) this.particles.emitExplosion(p.x, p.y, p.color, 12);
        if (p.pierce <= 0) break;
      }

      if (!hit && boss && (boss.x - p.x) ** 2 + (boss.y - p.y) ** 2 < (boss.radius + p.radius) ** 2) {
        const isCrit = p.bypassesShield || Math.random() < critChance;
        boss.takeDamage(isCrit ? p.damage * critMult : p.damage, this.particles, isCrit);
        if (p.spawnsSolarZone) {
          this.spawnSolarBurnZone(p.x, p.y, p.damage);
          p.spawnsSolarZone = false;
        }
        p.pierce -= 1;
        if (p.onHitExplode) this.particles.emitExplosion(p.x, p.y, p.color, 16);
      }

      if (p.pierce <= 0) this.removePlayerProjectile(i);
    }
  }

  private removePlayerProjectile(i: number) {
    const last = this.playerProjectiles.length - 1;
    if (i !== last) this.playerProjectiles[i] = this.playerProjectiles[last];
    this.playerProjectiles.pop();
  }

  /** Swarm separation via spatial grid (was O(n²)). */
  private separateEnemies() {
    for (const e1 of this.enemies) {
      for (const e2 of this.enemyGrid.query(e1.x, e1.y, e1.radius + 30)) {
        if (e2 === e1 || e2.dead) continue;
        // Process each pair once
        if (e2.x < e1.x || (e2.x === e1.x && e2.y <= e1.y)) continue;
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
  }

  private updateSolarZones(dt: number) {
    const boss = this.boss && !this.boss.isDefeated ? this.boss : null;
    for (let i = this.solarZones.length - 1; i >= 0; i--) {
      const sz = this.solarZones[i];
      sz.life += dt;
      if (sz.life >= sz.maxLife) {
        this.solarZones.splice(i, 1);
        continue;
      }
      const tick = sz.damagePerSec * dt;
      for (const enemy of this.enemyGrid.query(sz.x, sz.y, sz.radius)) {
        if (enemy.dead) continue;
        const rr = sz.radius + enemy.radius;
        if ((enemy.x - sz.x) ** 2 + (enemy.y - sz.y) ** 2 <= rr * rr) {
          enemy.slowTimer = 0.25;
          enemy.takeDamage(tick, this.particles, undefined, false, true);
        }
      }
      if (boss && (boss.x - sz.x) ** 2 + (boss.y - sz.y) ** 2 <= (sz.radius + boss.radius) ** 2) {
        boss.takeDamage(tick, this.particles, false, true);
      }
    }
  }

  private updateShadowRifts(dt: number) {
    const player = this.player;
    for (let i = this.shadowRifts.length - 1; i >= 0; i--) {
      const rift = this.shadowRifts[i];
      rift.life += dt;
      rift.animTimer += dt;
      if (rift.life >= rift.maxLife) {
        this.shadowRifts.splice(i, 1);
        continue;
      }
      const pDist = Math.hypot(player.x - rift.x, player.y - rift.y);
      if (pDist < rift.radius + 65) {
        const pull = (1 - pDist / (rift.radius + 65)) * 75;
        const a = Math.atan2(rift.y - player.y, rift.x - player.x);
        player.x += Math.cos(a) * pull * dt;
        player.y += Math.sin(a) * pull * dt;
        if (pDist < rift.radius) player.inShadowRift = true;
      }
    }
  }

  private updateMortarZones(dt: number) {
    const player = this.player;
    for (let i = this.mortarZones.length - 1; i >= 0; i--) {
      const mz = this.mortarZones[i];
      mz.timer += dt;
      if (mz.timer < mz.maxTime) continue;
      this.particles.emitExplosion(mz.x, mz.y, '#eab308', 20);
      this.renderer.triggerScreenShake(6, 0.2);
      sound.playPulse();
      if (Math.hypot(player.x - mz.x, player.y - mz.y) <= mz.radius + player.hurtRadius) {
        if (player.takeDamage(mz.damage, this.particles)) this.onPlayerHit(8);
      }
      this.mortarZones.splice(i, 1);
    }
  }

  private updateObelisks(dt: number) {
    const player = this.player;
    const architectSpeedMult =
      1 +
      (player.classId === 'architect' ? forge.getLevel('classMasteryArchitect') * 0.12 : 0) +
      (player.passives.get('architectGrid') ?? 0) * 0.3;

    for (let i = this.obelisks.length - 1; i >= 0; i--) {
      const ob = this.obelisks[i];
      ob.animTimer += dt;
      const dist = Math.hypot(player.x - ob.x, player.y - ob.y);

      if (dist > ob.radius) {
        ob.charge = Math.max(0, ob.charge - dt * 0.4);
        continue;
      }
      ob.charge += dt * architectSpeedMult;
      ob.spawnGuardTimer += dt;

      // While charging, the obelisk summons fast Void Stalkers
      if (ob.spawnGuardTimer >= 1.6 && this.enemies.length < this.getMaxEnemies()) {
        ob.spawnGuardTimer = 0;
        const a = Math.random() * Math.PI * 2;
        const m = this.survivalTime / 60;
        this.addEnemy(ob.x + Math.cos(a) * 240, ob.y + Math.sin(a) * 240, 'stalker', Balance.enemyHpScale(m), false);
      }

      if (ob.charge >= ob.maxCharge) {
        this.particles.emitShockwave(ob.x, ob.y, 420, '#fbbf24', 8);
        this.particles.emitExplosion(ob.x, ob.y, '#a855f7', 35);
        this.particles.emitBannerText(player.x, player.y, 'OBELISK OVERDRIVE! +35 LICHT', '#fbbf24');
        this.renderer.triggerScreenShake(14, 0.4);
        sound.playLevelUp();
        haptic([30, 40, 30]);

        player.addLight(35);
        player.overdriveTimer = Math.max(player.overdriveTimer, 8.0);

        // Nova blast scales with time so obelisks stay worth capturing
        const blast = 180 * Balance.enemyHpScale(this.survivalTime / 60);
        for (const enemy of this.enemyGrid.query(ob.x, ob.y, 380)) {
          if (!enemy.dead && Math.hypot(enemy.x - ob.x, enemy.y - ob.y) <= 380) {
            enemy.takeDamage(blast, this.particles, { x: ob.x, y: ob.y }, true);
          }
        }
        this.drops.push(Drop.shard(ob.x, ob.y, 'big', 40));
        for (let s = 0; s < 3; s++) this.drops.push(Drop.shard(ob.x, ob.y, 'small', 40));
        this.obelisks.splice(i, 1);
      }
    }
  }

  private updateEnemyProjectiles(dt: number) {
    const player = this.player;
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

      if (activeOrbiters) {
        let deflected = false;
        for (const orb of activeOrbiters.currentOrbPositions) {
          if ((ep.x - orb.x) ** 2 + (ep.y - orb.y) ** 2 < (ep.radius + 12) ** 2) {
            this.particles.emitSpark(ep.x, ep.y, '#38bdf8', 4);
            deflected = true;
            break;
          }
        }
        if (deflected) {
          this.enemyProjectiles.splice(i, 1);
          continue;
        }
      }

      const hr = ep.radius + player.hurtRadius;
      if ((ep.x - player.x) ** 2 + (ep.y - player.y) ** 2 < hr * hr) {
        if (player.takeDamage(ep.damage, this.particles)) this.onPlayerHit(8);
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  private updateDrops(dt: number) {
    const player = this.player;
    const magnetRadius = player.getMagnetRadius();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const alive = drop.update(dt, player.x, player.y, magnetRadius);
      if (drop.isCollected) {
        if (drop.type === 'light') {
          player.addLight(drop.value);
          sound.playShard(false);
        } else {
          player.shardsCollectedThisRun += drop.value;
          sound.playShard(true);
        }
        if (drop.size === 'big') {
          this.particles.emitBannerText(drop.x, drop.y, drop.type === 'light' ? `+${Math.round(drop.value)} LICHT` : `+${drop.value} ✦`, drop.color);
        }
        this.particles.emitSpark(drop.x, drop.y, drop.color, drop.size === 'big' ? 8 : 3);
      }
      if (drop.isCollected || !alive) {
        const last = this.drops.length - 1;
        if (i !== last) this.drops[i] = this.drops[last];
        this.drops.pop();
      }
    }
  }

  /** Collects every enemy that died this step (any damage source) and rewards it once. */
  private resolveDeaths() {
    let write = 0;
    for (let read = 0; read < this.enemies.length; read++) {
      const enemy = this.enemies[read];
      if (!enemy.dead) enemy.checkDeath(this.particles);
      if (enemy.dead) {
        this.handleEnemyDefeat(enemy);
      } else {
        this.enemies[write++] = enemy;
      }
    }
    // handleEnemyDefeat may append splitter children after `read` finished - keep them
    this.enemies.length = write;
    if (this.splitterQueue.length > 0) {
      this.enemies.push(...this.splitterQueue);
      this.splitterQueue.length = 0;
    }

    if (this.boss && this.boss.isDefeated) this.handleBossDefeat();
  }

  private splitterQueue: Enemy[] = [];

  private getMaxEnemies(): number {
    const base = this.renderer.quality === 'low' ? 95 : this.renderer.quality === 'medium' ? 125 : 150;
    return this.boss && !this.boss.isDefeated ? Math.floor(base * 0.6) : base;
  }

  private addEnemy(x: number, y: number, type: EnemyType, hpScale: number, elite: boolean, speedScale: number = 1) {
    const m = this.survivalTime / 60;
    const enemy = new Enemy(x, y, type, hpScale, elite, speedScale, Balance.enemyDamageScale(m));
    this.enemies.push(enemy);
    return enemy;
  }

  private handleSpawning(dt: number) {
    this.enemySpawnTimer += dt;
    this.obeliskSpawnTimer += dt;
    this.swarmEventTimer += dt;
    this.riftSpawnTimer += dt;
    const bossActive = !!this.boss && !this.boss.isDefeated;

    // Endless boss chain: the next boss comes after a stretch of boss-free time
    if (!bossActive) {
      this.bossFreeTimer += dt;
      const remaining = Balance.bossInterval(this.nextBossNumber) - this.bossFreeTimer;
      if (remaining <= 10 && remaining + dt > 10) {
        this.particles.emitBannerText(this.player.x, this.player.y - 40, `⚠ BOSS ${this.nextBossNumber} NAHT ⚠`, '#f43f5e');
      }
      if (remaining <= 0) {
        this.spawnBoss(this.nextBossNumber);
        this.nextBossNumber += 1;
        this.bossFreeTimer = 0;
      }
    }

    // Void Obelisks every 35s (max 2)
    if (this.obeliskSpawnTimer >= 35 && this.obelisks.length < 2) {
      this.obeliskSpawnTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      const dist = 360 + Math.random() * 240;
      const pos = clampToArena(this.player.x + Math.cos(angle) * dist, this.player.y + Math.sin(angle) * dist, 140);
      this.obelisks.push({ x: pos.x, y: pos.y, radius: 95, charge: 0, maxCharge: 4.5, animTimer: 0, spawnGuardTimer: 0 });
      this.particles.emitBannerText(this.player.x, this.player.y, 'VOID OBELISK ERSCHIENEN!', '#c084fc');
    }

    // Swarm encirclement every 48s (not during boss fights)
    if (this.swarmEventTimer >= 48 && !bossActive && this.enemies.length < this.getMaxEnemies() - 10) {
      this.swarmEventTimer = 0;
      this.spawnSwarmRing();
    }

    // Shadow rifts from 0:45
    if (this.survivalTime >= 45 && this.riftSpawnTimer >= 28 && this.shadowRifts.length < 3) {
      this.riftSpawnTimer = 0;
      const a = Math.random() * Math.PI * 2;
      const d = 180 + Math.random() * 220;
      this.addRift(this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d);
    }

    const lightRatio = this.player.light / 100;
    const spawnInterval = Balance.spawnInterval(this.survivalTime, lightRatio, bossActive);
    if (this.enemySpawnTimer >= spawnInterval && this.enemies.length < this.getMaxEnemies()) {
      this.enemySpawnTimer = 0;
      const packSize = bossActive ? 1 : Balance.packSize(this.survivalTime);
      for (let p = 0; p < packSize; p++) this.spawnEnemyWave();
    }
  }

  private addRift(x: number, y: number) {
    const pos = clampToArena(x, y, 100);
    this.shadowRifts.push({ x: pos.x, y: pos.y, radius: 85, life: 0, maxLife: 18, animTimer: 0 });
  }

  private consumeBossSpawns(minutes: number) {
    const hpScale = Balance.enemyHpScale(minutes) * 0.7;
    for (const m of this.bossSpawns.minions) {
      if (this.enemies.length >= this.getMaxEnemies() + 20) break;
      this.addEnemy(m.x, m.y, Math.random() < 0.6 ? 'mote' : 'stalker', hpScale, false, Balance.enemySpeedScale(minutes));
    }
    for (const r of this.bossSpawns.rifts) {
      if (this.shadowRifts.length < 4) this.addRift(r.x, r.y);
    }
    this.bossSpawns.minions.length = 0;
    this.bossSpawns.rifts.length = 0;
  }

  private spawnSwarmRing() {
    const minutes = this.survivalTime / 60;
    const hpScaling = Balance.enemyHpScale(minutes) * 0.75;
    const count = Math.min(16, 8 + Math.floor(minutes * 1.2));
    const ringRadius = 460;

    this.particles.emitBannerText(this.player.x, this.player.y, '⚠ SCHWARM-UMZINGELUNG ⚠', '#f43f5e');
    sound.playBossAlarm();

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const pos = clampToArena(this.player.x + Math.cos(a) * ringRadius, this.player.y + Math.sin(a) * ringRadius, 40);
      const swarmType: EnemyType = minutes >= 1.5 && i % 4 === 0 ? 'stalker' : 'mote';
      this.addEnemy(pos.x, pos.y, swarmType, hpScaling, false, Balance.enemySpeedScale(minutes));
    }
  }

  private executeSupernovaBlast(sacrificedLight: number, minutes: number) {
    const px = this.player.x;
    const py = this.player.y;

    const catalystLvl = forge.getLevel('supernovaCatalyst');
    const ascensionLvl = this.player.passives.get('novaAscension') ?? 0;
    const dmgBonusMult = 1 + catalystLvl * 0.25 + ascensionLvl * 0.45;
    // Scales with enemy HP so the ultimate stays a real screen-clear late in a run
    const blastDamage = (260 + sacrificedLight * 9) * Balance.enemyHpScale(minutes) * dmgBonusMult;

    this.particles.emitShockwave(px, py, 950, '#fbbf24', 12, 0.6);
    this.particles.emitShockwave(px, py, 650, '#00f3ff', 8, 0.5);
    this.particles.emitExplosion(px, py, '#fbbf24', 50);
    this.particles.emitBannerText(px, py - 24, '⚡ SUPERNOVA! ⚡', '#fbbf24');
    this.renderer.triggerScreenShake(24, 0.75);
    haptic([60, 40, 120]);

    for (const ep of this.enemyProjectiles) this.particles.emitSpark(ep.x, ep.y, '#fbbf24', 2);
    this.enemyProjectiles = [];
    this.mortarZones = [];
    this.shadowRifts = [];

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (Math.hypot(enemy.x - px, enemy.y - py) <= 1150) {
        enemy.slowTimer = 5.0;
        enemy.takeDamage(blastDamage, this.particles, undefined, true);
      }
    }

    if (this.boss && !this.boss.isDefeated) {
      // Bosses take a fixed share of their max HP so the nova matters in every boss fight
      this.boss.takeDamage(this.boss.maxHp * (0.12 + ascensionLvl * 0.03), this.particles, true);
    }

    // Protective ring of solar fields
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.spawnSolarBurnZone(px + Math.cos(a) * 105, py + Math.sin(a) * 105, 95 * dmgBonusMult * Balance.enemyHpScale(minutes) * 0.5);
    }
  }

  private spawnSolarBurnZone(x: number, y: number, baseDmg: number) {
    if (this.solarZones.length > 24) this.solarZones.shift();
    this.solarZones.push({ x, y, radius: 68, damagePerSec: baseDmg * 0.65, life: 0, maxLife: 3.2 });
    this.particles.emitExplosion(x, y, '#f97316', 12);
  }

  private spawnEnemyWave() {
    const seconds = this.survivalTime;
    const minutes = seconds / 60;

    const types: EnemyType[] = ['mote', 'mote'];
    if (seconds > 15) types.push('splitter', 'leech');
    if (seconds > 30) types.push('stalker');
    if (seconds > 45) types.push('charger');
    if (seconds >= 60) types.push('spitter', 'phantom');
    if (seconds >= 95) types.push('scatterer', 'sniper');
    if (seconds >= 140) types.push('mortar', 'vanguard');
    if (seconds >= 190) types.push('behemoth', 'eclipseOrb');

    const chosenType = types[Math.floor(Math.random() * types.length)];
    const isElite = Math.random() < Balance.eliteChance(seconds);

    // Spawn just outside the visible screen (corner distance + margin)
    const angle = Math.random() * Math.PI * 2;
    const halfDiag = Math.hypot(this.renderer.viewWidth, this.renderer.viewHeight) / 2;
    const dist = halfDiag + 50 + Math.random() * 80;
    const pos = clampToArena(this.player.x + Math.cos(angle) * dist, this.player.y + Math.sin(angle) * dist, 40);

    this.addEnemy(pos.x, pos.y, chosenType, Balance.enemyHpScale(minutes), isElite, Balance.enemySpeedScale(minutes));
  }

  private spawnBoss(bossNumber: number) {
    const angle = Math.random() * Math.PI * 2;
    const pos = clampToArena(this.player.x + Math.cos(angle) * 520, this.player.y + Math.sin(angle) * 520, 80);
    this.boss = new Boss(bossNumber, pos.x, pos.y);
    this.particles.emitBannerText(this.player.x, this.player.y - 50, `BOSS ${bossNumber}: ${this.boss.name}`, this.boss.color);
    this.renderer.triggerScreenShake(20, 0.8);
    haptic([80, 60, 80]);
  }

  private handleEnemyDefeat(enemy: Enemy) {
    const player = this.player;
    player.registerKill();
    player.score += enemy.scoreValue * player.getTotalMultiplier();
    player.addNovaCharge(enemy.isElite ? 5 : 1);

    // Light: small drop, sometimes a big one; elites always drop big
    const harvesterLvl = player.passives.get('lightHarvester') ?? 0;
    const vanguardLightMastery = player.classId === 'vanguard' ? forge.getLevel('classMasteryVanguard') * 0.1 : 0;
    const lightMult = 1 + harvesterLvl * 0.3 + vanguardLightMastery;
    const minutes = this.survivalTime / 60;
    if (enemy.isElite || enemy.stolenLight > 0 || Math.random() < Balance.lightDropChance(minutes)) {
      const bigLight = enemy.isElite || Math.random() < Balance.bigLightChance;
      const lightDrop = Drop.light(enemy.x, enemy.y, bigLight ? 'big' : 'small', lightMult);
      lightDrop.value += enemy.stolenLight; // Leeches give back stolen light
      this.drops.push(lightDrop);
    }

    // Shards
    if (enemy.isElite) {
      if (Math.random() < 0.3) this.drops.push(Drop.shard(enemy.x, enemy.y, 'big'));
      else this.drops.push(Drop.shard(enemy.x, enemy.y, 'small'));
      this.particles.emitShockwave(enemy.x, enemy.y, 80, '#fbbf24', 4);
    } else {
      const greedMult = 1 + forge.getLevel('shardGreed') * 0.15;
      if (Math.random() < Balance.bigShardChance(minutes) * greedMult) {
        this.drops.push(Drop.shard(enemy.x, enemy.y, 'big'));
      } else if (Math.random() < Balance.shardChance(minutes) * greedMult) {
        this.drops.push(Drop.shard(enemy.x, enemy.y, 'small'));
      }
    }

    // Splitter spawns 2 small motes (queued, added after the death sweep)
    if (enemy.type === 'splitter') {
      const hp = Balance.enemyHpScale(this.survivalTime / 60) * 0.5;
      const dmg = Balance.enemyDamageScale(this.survivalTime / 60);
      this.splitterQueue.push(new Enemy(enemy.x + 12, enemy.y, 'mote', hp, false, 1, dmg));
      this.splitterQueue.push(new Enemy(enemy.x - 12, enemy.y, 'mote', hp, false, 1, dmg));
    }

    this.pendingLevelUps += player.addXp(enemy.xpValue);
  }

  private handleBossDefeat() {
    if (!this.boss) return;
    const boss = this.boss;
    boss.dropRewards(this.drops);
    this.bossesDefeated += 1;
    this.player.score += 2500 * boss.bossNumber * this.player.scoreMultiplier;
    this.player.addNovaCharge(this.player.getNovaChargeNeeded()); // Boss kill fully charges the nova
    this.particles.emitBannerText(this.player.x, this.player.y - 50, `${boss.name} BESIEGT!`, '#fbbf24');
    this.renderer.triggerScreenShake(20, 0.8);
    haptic([100, 50, 100, 50, 150]);
    this.pendingLevelUps += this.player.addXp(40 + boss.bossNumber * 30);
    this.boss = null;
  }

  private updateTutorial() {
    if (this.tutorialStep < 0) return;
    const hints: Array<{ at: number; text: string }> = [
      { at: 1, text: this.input.isTouchDevice ? 'Ziehe irgendwo auf dem Bildschirm, um dich zu bewegen' : 'Bewege dich mit WASD oder den Pfeiltasten' },
      { at: 6, text: 'Deine Waffen feuern automatisch – dein Licht ist Leben UND Reichweite' },
      { at: 12, text: 'Sammle die blauen Kristalle, sonst erlischt dein Licht' },
      { at: 20, text: this.input.isTouchDevice ? 'DASH macht kurz unverwundbar' : 'Leertaste/Shift: Dash mit kurzer Unverwundbarkeit' },
      { at: 30, text: 'Kills laden die SUPERNOVA – zünde sie, wenn es eng wird' }
    ];
    const hint = hints[this.tutorialStep];
    if (!hint) {
      this.tutorialStep = -1;
      settings.set('tutorialSeen', true);
      return;
    }
    if (this.survivalTime >= hint.at) {
      this.menus.showToast(hint.text);
      this.tutorialStep += 1;
    }
  }

  private handleGameOver() {
    this.state = 'gameover';
    sound.stopAmbience();
    sound.playEnemyDeath();
    haptic([200]);

    const isRecord = this.survivalTime > forge.bestSurvivalTime;
    forge.addShards(this.player.shardsCollectedThisRun);
    forge.recordRun(this.survivalTime, this.player.score, this.bossesDefeated);

    const set = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('stat-time', formatTime(this.survivalTime) + (isRecord ? ' ★' : ''));
    set('stat-score', `${Math.floor(this.player.score)}`);
    set('stat-kills', `${this.player.kills}`);
    set('stat-shards', `✨ ${this.player.shardsCollectedThisRun}`);
    set('stat-level', `${this.player.level}`);
    set('stat-bosses', `${this.bossesDefeated}`);
    set('gameover-subtitle', isRecord ? 'Neuer Rekord! Die Dunkelheit hat dich trotzdem verschlungen.' : 'Die Dunkelheit hat dich verschlungen.');

    this.gameoverOverlay?.classList.remove('hidden');
  }
}

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function clampToArena(x: number, y: number, margin: number): { x: number; y: number } {
  const maxR = Player.ARENA_RADIUS - margin;
  const d = Math.hypot(x, y);
  if (d <= maxR) return { x, y };
  return { x: (x / d) * maxR, y: (y / d) * maxR };
}
