export class CathedralAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private noiseBuf: AudioBuffer | null = null;
  private crackleIn = 0;

  get isMuted() {
    return this.muted;
  }

  unlock() {
    if (!this.ctx) this.build();
    void this.ctx?.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  update(dt: number) {
    if (!this.ctx || this.muted) return;
    this.crackleIn -= dt;
    if (this.crackleIn <= 0) {
      this.crackleIn = 0.4 + Math.random() * 1.6;
      this.noise(0.05 + Math.random() * 0.05, 0.012, 1800 + Math.random() * 2000, 'highpass');
    }
  }

  enter() {
    this.unlock();
    this.bell(174.61);
    this.bell(261.63, 0.08);
    this.bell(349.23, 0.16);
  }

  select() {
    this.tone({ freq: 740, dur: 0.12, gain: 0.035, type: 'sine' });
  }

  reject() {
    this.tone({ freq: 110, dur: 0.14, gain: 0.04, type: 'triangle' });
  }

  move(weight: number) {
    this.noise(0.07, 0.08, 900, 'bandpass');
    this.tone({ freq: weight, dur: 0.16, gain: 0.07, type: 'sine' });
  }

  shatter(glass: boolean) {
    this.noise(0.28, glass ? 0.22 : 0.16, glass ? 1400 : 500, 'lowpass');
    this.noise(0.12, 0.12, glass ? 3200 : 900, 'highpass');
    const partials = glass ? [1800, 2400, 3100, 4200] : [220, 340, 520];
    partials.forEach((freq, i) => {
      this.tone({ freq, dur: glass ? 0.35 : 0.22, gain: 0.045 - i * 0.008, type: 'sine', delay: i * 0.012 });
    });
    this.tone({ freq: glass ? 90 : 70, dur: 0.3, gain: 0.12, type: 'sine' });
  }

  check() {
    this.tone({ freq: 196, dur: 0.4, gain: 0.06, type: 'sawtooth' });
    this.tone({ freq: 233, dur: 0.45, gain: 0.04, type: 'sawtooth', delay: 0.02 });
  }

  finale(win: boolean) {
    const chord = win ? [261.6, 329.6, 392, 523.25] : [196, 233, 293.7];
    chord.forEach((freq, i) => this.bell(freq, i * 0.12));
  }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.8;
    master.connect(ctx.destination);
    this.master = master;

    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    const convolver = ctx.createConvolver();
    convolver.buffer = this.impulse(2.6);
    convolver.connect(wet);
    wet.connect(master);
    this.wet = wet;
    this.dry = ctx.createGain();
    this.dry.gain.value = 0.85;
    this.dry.connect(master);

    const n = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    this.pad(110, 0.018);
    this.pad(164.81, 0.012);
    this.pad(220, 0.01);
    this.pad(329.63, 0.006);
  }

  private dry: GainNode | null = null;
  private wet: GainNode | null = null;

  private connect(node: AudioNode) {
    if (this.dry) node.connect(this.dry);
    if (this.wet) node.connect(this.wet);
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.4);
      }
    }
    return impulse;
  }

  private pad(freq: number, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07 + Math.random() * 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = gain * 0.45;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    o.connect(g);
    g.connect(this.wet!);
    o.start();
    lfo.start();
  }

  private tone(opts: { freq: number; dur: number; gain: number; type: OscillatorType; delay?: number }) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + (opts.delay ?? 0);
    const o = this.ctx.createOscillator();
    o.type = opts.type;
    o.frequency.setValueAtTime(opts.freq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    o.connect(g);
    this.connect(g);
    o.start(t);
    o.stop(t + opts.dur + 0.02);
  }

  private noise(dur: number, gain: number, freq: number, type: BiquadFilterType) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    this.connect(g);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private bell(freq: number, delay = 0) {
    this.tone({ freq, dur: 2.8, gain: 0.07, type: 'sine', delay });
    this.tone({ freq: freq * 2.01, dur: 2.2, gain: 0.03, type: 'sine', delay });
    this.tone({ freq: freq * 3, dur: 1.6, gain: 0.015, type: 'sine', delay });
  }
}
