import { Player } from '../entities/Player';
import { Enemy, EnemyProjectile, EnemyType } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Drop } from '../entities/Drop';
import { Weapon, PlayerProjectile } from '../weapons/Weapon';
import { PulseWeapon } from '../weapons/WeaponRegistry';
import { ParticleSystem } from './Particle';
import { GameRenderer } from './Renderer';
import { InputManager } from './Input';
import { HUD } from '../ui/HUD';
import { GiftModal } from '../ui/GiftModal';
import { ForgeModal } from '../ui/ForgeModal';
import { forge } from '../meta/Forge';
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

  // Spawning
  private enemySpawnTimer: number = 0;
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
      this.forgeModal.show(() => this.updateMenuStats());
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
    if (shardsEl) shardsEl.textContent = `${forge.shards}`;
    if (recordEl) {
      const m = Math.floor(forge.bestSurvivalTime / 60);
      const s = Math.floor(forge.bestSurvivalTime % 60);
      recordEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    }
  }

  public startNewRun() {
    // Reset player
    this.player = new Player();
    this.player.initFromForge();

    // Starting weapon: PULSE
    this.weapons = [new PulseWeapon()];

    // Clear state
    this.enemies = [];
    this.boss = null;
    this.drops = [];
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.particles.clear();

    this.survivalTime = 0;
    this.enemySpawnTimer = 0;
    this.boss1Spawned = false;
    this.boss2Spawned = false;
    this.boss3Spawned = false;

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
      this.particles
    );

    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number) {
    this.survivalTime += dt;

    // Score over time with multiplier
    this.player.score += dt * 10 * this.player.scoreMultiplier;

    // 1. Input & Player update
    const playerScreenPos = {
      x: this.player.x - this.renderer.cameraX,
      y: this.player.y - this.renderer.cameraY
    };
    const moveInput = this.input.getMovementVector(playerScreenPos);

    if (this.input.consumeDash()) {
      this.player.triggerDash();
    }

    this.player.update(dt, moveInput, this.particles);

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
    for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
      const p = this.playerProjectiles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.playerProjectiles.splice(i, 1);
        continue;
      }

      // Homing logic (for Sparks)
      if (p.isHoming) {
        let nearestTarget: Enemy | Boss | null = null;
        let minDist = 400;

        for (const enemy of this.enemies) {
          const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
          if (d < minDist) {
            minDist = d;
            nearestTarget = enemy;
          }
        }
        if (this.boss) {
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
          const newAngle = curAngle + diff * 0.18;
          const spd = p.homingSpeed ?? 320;
          p.vx = Math.cos(newAngle) * spd;
          p.vy = Math.sin(newAngle) * spd;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Projectile hit enemies
      let hit = false;
      for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
        const enemy = this.enemies[eIdx];
        if (Math.hypot(enemy.x - p.x, enemy.y - p.y) < enemy.radius + p.radius) {
          const isDead = enemy.takeDamage(p.damage, this.particles);
          if (isDead) {
            this.handleEnemyDefeat(enemy);
            this.enemies.splice(eIdx, 1);
          }
          p.pierce -= 1;
          hit = true;
          if (p.onHitExplode) {
            this.particles.emitExplosion(p.x, p.y, '#34d399', 18);
          }
          if (p.pierce <= 0) break;
        }
      }

      // Projectile hit boss
      if (!hit && this.boss && Math.hypot(this.boss.x - p.x, this.boss.y - p.y) < this.boss.radius + p.radius) {
        const isDead = this.boss.takeDamage(p.damage, this.particles);
        if (isDead) {
          this.handleBossDefeat();
        }
        p.pierce -= 1;
        if (p.onHitExplode) {
          this.particles.emitExplosion(p.x, p.y, '#34d399', 24);
        }
      }

      if (p.pierce <= 0) {
        this.playerProjectiles.splice(i, 1);
      }
    }

    // 6. Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, this.player, this.enemyProjectiles, this.particles);

      // Check if enemy died from burn/phosphor
      if (enemy.hp <= 0) {
        this.handleEnemyDefeat(enemy);
        this.enemies.splice(i, 1);
        continue;
      }

      // Collision with player
      const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
      if (dist < enemy.radius + this.player.radius) {
        this.player.takeDamage(enemy.damage, this.particles);
        this.renderer.triggerScreenShake(6, 0.2);
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

    // 8. Update Enemy Projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      ep.life += dt;
      if (ep.life >= ep.maxLife) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
      ep.x += ep.vx * dt;
      ep.y += ep.vy * dt;

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

    // Boss spawns at 3m (180s), 6m (360s), 10m (600s)
    if (this.survivalTime >= 180 && !this.boss1Spawned) {
      this.boss1Spawned = true;
      this.spawnBoss(1);
    } else if (this.survivalTime >= 360 && !this.boss2Spawned) {
      this.boss2Spawned = true;
      this.spawnBoss(2);
    } else if (this.survivalTime >= 600 && !this.boss3Spawned) {
      this.boss3Spawned = true;
      this.spawnBoss(3);
    }

    // Spawn rate: scales with time AND player's light!
    // (A brighter light attracts more enemies!)
    const lightFactor = this.player.light / 100; // 0.5 to 2.0
    const timeFactor = 1 + this.survivalTime / 120;
    const spawnInterval = Math.max(0.25, (1.8 / (timeFactor * (0.8 + lightFactor * 0.6))));

    if (this.enemySpawnTimer >= spawnInterval && this.enemies.length < 160) {
      this.enemySpawnTimer = 0;
      this.spawnEnemyWave();
    }
  }

  private spawnEnemyWave() {
    // Pick enemy types unlocked by time
    const types: EnemyType[] = ['mote'];
    if (this.survivalTime > 40) types.push('splitter');
    if (this.survivalTime > 75) types.push('stalker');
    if (this.survivalTime > 110) types.push('charger');
    if (this.survivalTime > 150) types.push('spitter');
    if (this.survivalTime > 210) types.push('phantom');
    if (this.survivalTime > 270) types.push('leech');
    if (this.survivalTime > 330) types.push('behemoth');
    if (this.survivalTime > 420) types.push('eclipseOrb');

    const chosenType = types[Math.floor(Math.random() * types.length)];
    const timeScaling = 1 + this.survivalTime / 240;

    // Spawn in a ring outside screen
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(window.innerWidth, window.innerHeight) * 0.65 + Math.random() * 80;
    const spawnX = this.player.x + Math.cos(angle) * dist;
    const spawnY = this.player.y + Math.sin(angle) * dist;

    this.enemies.push(new Enemy(spawnX, spawnY, chosenType, timeScaling));
  }

  private spawnBoss(bossId: number) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 420;
    const bx = this.player.x + Math.cos(angle) * dist;
    const by = this.player.y + Math.sin(angle) * dist;
    this.boss = new Boss(bossId, bx, by);
    this.renderer.triggerScreenShake(15, 0.6);
  }

  private handleEnemyDefeat(enemy: Enemy) {
    this.player.kills += 1;
    this.player.score += enemy.scoreValue * this.player.scoreMultiplier;

    // Drop Light Mote (Health/Light recovery)
    const harvesterLvl = this.player.passives.get('lightHarvester') ?? 0;
    const lightVal = (8 + Math.floor(Math.random() * 8)) * (1 + harvesterLvl * 0.3);
    this.drops.push(new Drop(enemy.x, enemy.y, 'light', lightVal));

    // Chance to drop Forge Shard (currency)
    const shardChance = 0.45;
    if (Math.random() < shardChance) {
      this.drops.push(new Drop(enemy.x, enemy.y, 'shard', 1));
    }

    // Splitter enemy spawns 2 small motes
    if (enemy.type === 'splitter') {
      this.enemies.push(new Enemy(enemy.x + 12, enemy.y, 'mote', 0.8));
      this.enemies.push(new Enemy(enemy.x - 12, enemy.y, 'mote', 0.8));
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
