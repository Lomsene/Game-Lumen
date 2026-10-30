/**
 * AETHER: ECLIPSE - Studio-Grade Procedural Dark-Synthwave Sequencer & SFX Engine
 * 100% self-contained Web Audio API synthesizer with zero external dependencies.
 * Features:
 * - Dynamic 124 BPM Dark-Synthwave Soundtrack (Deep Sub-Bass, Punchy Kick/Snare/HiHat, Atmospheric Pads & Arpeggiator)
 * - Musical scale-locked SFX (D Minor Pentatonic / Dorian) so pickups & combat blend into the music
 * - Rich multi-layered FM + Filtered Noise weapon & explosion synthesis
 */
import { settings } from '../meta/Settings';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private stepTimer: number | null = null;
  private currentStep: number = 0;
  /** AudioContext time of the next sequencer step (look-ahead scheduling). */
  private nextStepTime: number = 0;
  private intensity: number = 0.25; // 0.0 to 1.0 (scales with combat / boss)
  private lastHeartbeat: number = 0;
  private lastHitTime: number = 0;
  private lastDeathTime: number = 0;

  // D Minor scale frequencies for harmonic SFX & Arp
  // D2=73.42, F2=87.31, G2=98.00, A2=110.00, Bb2=116.54, C3=130.81, D3=146.83
  private readonly BASS_PROGRESSION = [
    73.42, 73.42, 73.42, 73.42, // D2
    58.27, 58.27, 58.27, 58.27, // Bb1
    65.41, 65.41, 65.41, 65.41, // C2
    55.00, 55.00, 65.41, 69.30  // A1 -> C2 -> C#2
  ];

  // D Minor Arp notes (D4, F4, A4, C5, D5, F5, A4, F4)
  private readonly ARP_NOTES = [
    293.66, 349.23, 440.00, 523.25,
    587.33, 523.25, 440.00, 349.23,
    293.66, 349.23, 466.16, 587.33,
    659.25, 587.33, 466.16, 440.00
  ];

  // Harmonic pickup scale (D5, F5, G5, A5, C6, D6, F6)
  private readonly CHIME_SCALE = [587.33, 698.46, 783.99, 880.00, 1046.50, 1174.66, 1396.91];
  private chimeIndex: number = 0;
  private lastChimeTime: number = 0;

  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // Lazy-initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.7 * settings.data.musicVolume, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.85 * settings.data.sfxVolume, this.ctx.currentTime);

      this.musicGain.connect(this.compressor);
      this.sfxGain.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.createNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  /** Applies volume / mute values from the settings. */
  public applySettings() {
    this.setMuted(settings.data.muted);
    if (this.ctx && this.musicGain && this.sfxGain) {
      this.musicGain.gain.setTargetAtTime(0.7 * settings.data.musicVolume, this.ctx.currentTime, 0.05);
      this.sfxGain.gain.setTargetAtTime(0.85 * settings.data.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  /** Pause all audio (app in background). */
  public suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
      this.nextStepTime = this.ctx.currentTime + 0.05;
    }
  }

  public setIntensity(val: number) {
    this.intensity = Math.max(0.15, Math.min(1.0, val));
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.04);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  // ==========================================================================
  // PROCEDURAL DARK-SYNTHWAVE SOUNDTRACK SEQUENCER (124 BPM, 16th-note steps)
  // ==========================================================================
  public startAmbience() {
    this.initContext();
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = (this.ctx?.currentTime ?? 0) + 0.05;

    // 124 BPM -> 16th note = ~121ms. A short timer schedules notes slightly ahead on the
    // audio clock, so the beat stays tight even when the main thread stutters on mobile.
    const stepSec = 60 / 124 / 4;
    this.stepTimer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      if (this.nextStepTime < now - 0.2) this.nextStepTime = now + 0.02; // Resync after a stall
      while (this.nextStepTime < now + 0.12) {
        if (!this.isMuted) this.playSequencerStep(this.currentStep, this.nextStepTime);
        this.currentStep = (this.currentStep + 1) % 64;
        this.nextStepTime += stepSec;
      }
    }, 30);
  }

  public stopAmbience() {
    this.isMusicPlaying = false;
    if (this.stepTimer !== null) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private playSequencerStep(step: number, now: number) {
    if (!this.ctx || !this.musicGain) return;
    const barStep = step % 16;
    const barIndex = Math.floor(step / 4) % 16;

    // 1. PUNCHY SYNTH KICK (Four-on-the-floor: steps 0, 4, 8, 12 + syncopated 14 on high intensity)
    if (barStep % 4 === 0 || (this.intensity > 0.65 && barStep === 14)) {
      this.triggerSynthKick(now);
    }

    // 2. CRISP SYNTH SNARE / CLAP (Steps 4 and 12)
    if (barStep === 4 || barStep === 12) {
      this.triggerSynthSnare(now);
    }

    // 3. OFF-BEAT HI-HAT GROOVE
    if (barStep % 2 === 1 || (this.intensity > 0.45 && barStep % 2 === 0)) {
      const isOpen = barStep % 4 === 2;
      this.triggerHiHat(now, isOpen ? 0.08 : 0.03, isOpen ? 0.09 : 0.04);
    }

    // 4. DRIVING REESE / ROLLING SYNTHWAVE BASSLINE (Every 16th note!)
    const bassRoot = this.BASS_PROGRESSION[barIndex];
    const isOctaveJump = barStep % 2 === 1;
    const bassFreq = isOctaveJump ? bassRoot * 2 : bassRoot;
    this.triggerBassPluck(now, bassFreq, barStep % 4 === 0 ? 0.14 : 0.1);

    // 5. ATMOSPHERIC CYBERPUNK ARPEGGIATOR (Scales with combat intensity)
    if (step % 2 === 0 || this.intensity > 0.5) {
      const arpNote = this.ARP_NOTES[step % this.ARP_NOTES.length];
      const transpose = barIndex >= 8 && barIndex < 12 ? 1.122 : 1.0; // Subtle harmonic shift
      this.triggerArpPluck(now, arpNote * transpose);
    }

    // 6. WARM DARK PAD CHORD (Triggered at start of every 16-step bar)
    if (barStep === 0) {
      this.triggerPadChord(now, bassRoot * 2);
    }
  }

  private triggerSynthKick(t: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.11);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.19);
  }

  private triggerSynthSnare(t: number) {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;

    // Body tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(85, t + 0.08);
    oscGain.gain.setValueAtTime(0.16, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(oscGain);
    oscGain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.1);

    // Filtered noise snap
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.Q.setValueAtTime(1.2, t);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.18 * (0.6 + this.intensity * 0.4), t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.musicGain);
    noise.start(t);
    noise.stop(t + 0.15);
  }

  private triggerHiHat(t: number, duration: number, vol: number) {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    noise.start(t);
    noise.stop(t + duration + 0.01);
  }

  private triggerBassPluck(t: number, freq: number, vol: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    const cutoff = 280 + this.intensity * 550;
    filter.frequency.setValueAtTime(cutoff * 2.2, t);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.5, t + 0.11);
    filter.Q.setValueAtTime(3.2, t);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.115);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  private triggerArpPluck(t: number, freq: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400 + this.intensity * 1800, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.14);

    const vol = 0.05 + this.intensity * 0.06;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  private triggerPadChord(t: number, rootFreq: number) {
    if (!this.ctx || !this.musicGain) return;
    // Minor triad + 7th (Root, Minor 3rd = 1.189, Fifth = 1.498)
    const freqs = [rootFreq, rootFreq * 1.1892, rootFreq * 1.4983];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.035, t + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.85);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(t);
      osc.stop(t + 1.9);
    }
  }

  // ==========================================================================
  // STUDIO SFX SYNTHESIS (Harmonic, Warm, Punchy – Never Harsh)
  // ==========================================================================

  // --- LASER / WEAPON SHOT (Soft Sub-Tonal Plasma Pluck) ---
  public playShoot(frequency: number = 600, duration: number = 0.11) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    // Quantize slightly towards D-minor harmonics for pleasant feel
    const startFreq = Math.min(880, Math.max(220, frequency * 0.75));
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.22, now + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + duration);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  // --- PULSE SHOCKWAVE (Deep Sub-Bass Drop + Shimmering Chord Swell) ---
  public playPulse() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;

    // 1. Sub-bass impact drop
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.32);

    subGain.gain.setValueAtTime(0.24, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.35);

    // 2. Harmonic fifth shimmer (D4 + A4)
    for (const f of [293.66, 440.0]) {
      const shimmer = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(f, now);
      shimmer.frequency.exponentialRampToValueAtTime(f * 1.02, now + 0.25);

      sGain.gain.setValueAtTime(0.045, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      shimmer.connect(sGain);
      sGain.connect(this.sfxGain);
      shimmer.start(now);
      shimmer.stop(now + 0.27);
    }
  }

  // --- HIT / DAMAGE (Punchy Low-Mid Thud) ---
  public playHit() {
    if (this.isMuted) return;
    const perfNow = performance.now();
    if (perfNow - this.lastHitTime < 45) return; // Prevent ear-fatigue spam
    this.lastHitTime = perfNow;

    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // --- ENEMY DEFEATED (Satisfying Crisp Pop + Sub Bubble) ---
  public playEnemyDeath() {
    if (this.isMuted) return;
    const perfNow = performance.now();
    if (perfNow - this.lastDeathTime < 35) return;
    this.lastDeathTime = perfNow;

    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Upward crystal pop followed by warm tail
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.045);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  // --- DASH WHOOSH (Filtered Air Sweep + Harmonic Boost) ---
  public playDash() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(2.5, now);
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(1600, now + 0.09);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.24);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.16, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.26);
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(293.66, now);
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.14);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  // --- SHARD / LIGHT PICKUP (Ascending Musical Chime in D-Minor Scale!) ---
  public playShard(highPitch: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const perfNow = performance.now();
    if (perfNow - this.lastChimeTime < 900) {
      this.chimeIndex = Math.min(this.CHIME_SCALE.length - 1, this.chimeIndex + 1);
    } else {
      this.chimeIndex = 0;
    }
    this.lastChimeTime = perfNow;

    const now = this.ctx.currentTime;
    const baseFreq = this.CHIME_SCALE[this.chimeIndex] * (highPitch ? 1.25 : 1.0);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.23);
  }

  // --- LEVEL UP / OBELISK COMPLETE FANFARE (Lush D-Minor Add9 Synth Chord) ---
  public playLevelUp() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    // D4, F4, A4, C5, E5, A5
    const notes = [293.66, 349.23, 440.0, 523.25, 659.25, 880.0];
    notes.forEach((freq, idx) => {
      const startTime = this.ctx!.currentTime + idx * 0.055;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.11, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.46);
    });
  }

  // --- BOSS / EVENT WARNING HORN (Cinematic Deep Braaam) ---
  public playBossAlarm() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const freqs = [73.42, 146.83, 220.0]; // D2 + D3 + A3
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.96, now + 0.7);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(220, now + 0.7);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.75);
    }
  }

  // --- LOW LIGHT HEARTBEAT ---
  public updateHeartbeat(lightPercent: number) {
    if (this.isMuted || lightPercent > 0.28) return;
    const now = performance.now();
    const interval = 580 + lightPercent * 900;
    if (now - this.lastHeartbeat > interval) {
      this.lastHeartbeat = now;
      this.playHeartbeat();
    }
  }

  private playHeartbeat() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    for (const offset of [0, 0.16]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + offset;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(68, t);
      osc.frequency.exponentialRampToValueAtTime(34, t + 0.13);

      gain.gain.setValueAtTime(offset === 0 ? 0.22 : 0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.15);
    }
  }
}

export const sound = new SoundEngine();
