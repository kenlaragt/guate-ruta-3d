import { CarSpec } from '../types/game';

class SimulatorSoundEngine {
  private ctx: AudioContext | null = null;
  private mainOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private muted = false;
  private running = false;

  public init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 380;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.mainOsc = this.ctx.createOscillator();
    this.subOsc = this.ctx.createOscillator();
    this.mainOsc.type = 'sawtooth';
    this.subOsc.type = 'triangle';

    this.mainOsc.connect(this.filterNode);
    this.subOsc.connect(this.filterNode);
    this.filterNode.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.mainOsc.start();
    this.subOsc.start();
    this.running = true;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(mute ? 0 : 0.04, this.ctx.currentTime, 0.05);
    }
  }

  public updateEngine(rpm: number, throttle: number, spec: CarSpec, active: boolean) {
    if (
      !this.ctx ||
      !this.running ||
      !this.mainOsc ||
      !this.subOsc ||
      !this.engineGain ||
      !this.filterNode
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const normRpm = Math.max(0.08, Math.min(1.1, rpm / spec.redlineRpm));

    if (spec.engineTone === 'bicycle_chain') {
      // Soft bicycle freewheel click / chain breeze
      this.mainOsc.type = 'triangle';
      this.subOsc.type = 'sine';
      const cadenceFreq = 65 + normRpm * 140;
      this.mainOsc.frequency.setTargetAtTime(cadenceFreq, now, 0.04);
      this.subOsc.frequency.setTargetAtTime(cadenceFreq * 2.0, now, 0.04);
      this.filterNode.frequency.setTargetAtTime(420 + throttle * 260, now, 0.04);
      this.engineGain.gain.setTargetAtTime(0.008 + throttle * 0.012, now, 0.05);
      return;
    }

    if (spec.engineTone === 'tuktuk_2stroke') {
      // Characteristic Guatemalan 200cc Tuk-Tuk crisp single-cylinder pop
      this.mainOsc.type = 'square';
      this.subOsc.type = 'sawtooth';
      const tukFreq = 52 + normRpm * 135;
      this.mainOsc.frequency.setTargetAtTime(tukFreq, now, 0.03);
      this.subOsc.frequency.setTargetAtTime(tukFreq * 1.5, now, 0.03);
      this.filterNode.frequency.setTargetAtTime(340 + normRpm * 620 + throttle * 280, now, 0.04);
      this.engineGain.gain.setTargetAtTime(0.024 + throttle * 0.03, now, 0.04);
      return;
    }

    if (spec.engineTone === 'diesel_truck') {
      // Heavy 6-cylinder turbo diesel low-end rumble
      this.mainOsc.type = 'sawtooth';
      this.subOsc.type = 'square';
      const dieselFreq = 28 + normRpm * 72;
      this.mainOsc.frequency.setTargetAtTime(dieselFreq, now, 0.04);
      this.subOsc.frequency.setTargetAtTime(dieselFreq * 0.5, now, 0.04);
      this.filterNode.frequency.setTargetAtTime(190 + normRpm * 420 + throttle * 220, now, 0.05);
      this.engineGain.gain.setTargetAtTime(0.036 + throttle * 0.04, now, 0.05);
      return;
    }

    if (spec.engineTone === 'ev') {
      this.mainOsc.type = 'sine';
      this.subOsc.type = 'triangle';
      const evFreq = 140 + normRpm * 520;
      this.mainOsc.frequency.setTargetAtTime(evFreq, now, 0.03);
      this.subOsc.frequency.setTargetAtTime(evFreq * 1.5, now, 0.03);
      this.filterNode.frequency.setTargetAtTime(900 + throttle * 600, now, 0.04);
      this.engineGain.gain.setTargetAtTime(0.02 + throttle * 0.028, now, 0.04);
      return;
    }

    this.mainOsc.type = 'sawtooth';
    this.subOsc.type = spec.engineTone === 'v10_scream' ? 'sawtooth' : 'triangle';

    const baseMult =
      spec.engineTone === 'v10_scream'
        ? 1.45
        : spec.engineTone === 'rb26_race'
          ? 1.25
          : spec.engineTone === 'inline6_turbo'
            ? 1.12
            : 0.95;

    const baseFreq = (42 + normRpm * 155) * baseMult;
    this.mainOsc.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.subOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.03);
    this.filterNode.frequency.setTargetAtTime(280 + normRpm * 980 + throttle * 350, now, 0.04);
    this.engineGain.gain.setTargetAtTime(0.032 + throttle * 0.038, now, 0.04);
  }

  public playShiftClick(isTurbo: boolean) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isTurbo ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(isTurbo ? 920 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(isTurbo ? 340 : 95, now + 0.09);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playCheckpointChime() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playGrandTrophyFanfare() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.09;
      const dur = idx === notes.length - 1 ? 0.55 : 0.26;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
  }

  public playBirdSongChirp(isParrot = false) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (isParrot) {
      const notes = [880, 1174.66, 987.77];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const t = now + idx * 0.085;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.18, t + 0.06);
        gain.gain.setValueAtTime(0.022, t);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.09);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      });
      return;
    }

    const melody = [1567.98, 1975.53, 1760.0, 2093.0];
    melody.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, t + 0.055);
      gain.gain.setValueAtTime(0.018, t);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.075);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.085);
    });
  }

  public stopSilence() {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
    }
  }
}

export const soundEngine = new SimulatorSoundEngine();
