// Procedural audio: engine, skid, nitro whoosh, crash, horn, near-miss blip, optional synth music.
// (No sample files are bundled; to use samples later, replace the oscillators with AudioBufferSourceNodes.)
const CHORDS = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]; // Am F C G

export class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.music = false; this.timer = 0; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(ctx.destination);

    // engine
    this.osc = ctx.createOscillator(); this.osc.type = 'sawtooth';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'square';
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 600;
    this.eng = ctx.createGain(); this.eng.gain.value = 0;
    this.osc.connect(this.lp); this.osc2.connect(this.lp); this.lp.connect(this.eng); this.eng.connect(this.master);
    this.osc.start(); this.osc2.start();

    // looping noise bed -> skid + nitro
    const len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    const loop = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; return s; };
    const skid = loop(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
    this.skid = ctx.createGain(); this.skid.gain.value = 0; skid.connect(bp); bp.connect(this.skid); this.skid.connect(this.master); skid.start();
    const nit = loop(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    this.nit = ctx.createGain(); this.nit.gain.value = 0; nit.connect(hp); hp.connect(this.nit); this.nit.connect(this.master); nit.start();

    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.35; this.musicBus.connect(this.master);
    if (this.music) this._musicStart();

    document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }
  setMusic(on) {
    this.music = on;
    if (!this.ctx) return;
    if (on) this._musicStart(); else this._musicStop();
  }

  update(speed01, gas, on = true, skid = 0, nitro = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const gf = Math.min(speed01, 1.15) * 5, gear = Math.min(4, Math.floor(gf));
    const rpm = 0.25 + 0.75 * Math.min(1, gf - gear);
    const f = 48 + rpm * 130 + nitro * 25;
    this.osc.frequency.setTargetAtTime(f, t, 0.04);
    this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
    this.lp.frequency.setTargetAtTime(500 + rpm * 1500 + (gas ? 600 : 0) + nitro * 800, t, 0.08);
    this.eng.gain.setTargetAtTime(on ? 0.04 + 0.04 * gas + 0.02 * nitro : 0, t, 0.1);
    this.skid.gain.setTargetAtTime(on ? skid * 0.11 : 0, t, 0.06);
    this.nit.gain.setTargetAtTime(on ? nitro * 0.09 : 0, t, 0.08);
  }

  stop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const g of [this.eng, this.skid, this.nit]) g.gain.setTargetAtTime(0, t, 0.1);
  }

  crash() {
    if (!this.ctx) return;
    const ctx = this.ctx, len = (ctx.sampleRate * 0.5) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(g); g.connect(this.master); src.start();
  }

  horn() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    g.connect(this.master);
    for (const hz of [392, 494]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz; o.connect(g); o.start(t); o.stop(t + 0.5); }
  }

  blip() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(1300, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.2);
  }

  coin() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1100, t); o.frequency.setValueAtTime(1650, t + 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.25);
  }

  // ---- tiny synthwave loop (Am F C G, bass + arpeggio) ----
  _musicStart() {
    if (this.timer) return;
    this.step = 0; this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this._sched(), 100);
  }
  _musicStop() { clearInterval(this.timer); this.timer = 0; }
  _sched() {
    const ctx = this.ctx, dur = 60 / 118 / 2;
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.4) {
      const s = this.step, chord = CHORDS[Math.floor(s / 8) % 4], k = s % 8;
      this._note(chord[0] - 24, 'sawtooth', this.next, dur * 0.9, 0.16, 500);
      this._note(chord[k % 3] + (k > 2 ? 24 : 12), 'triangle', this.next, dur * 1.4, 0.1, 2400);
      this.step++; this.next += dur;
    }
  }
  _note(midi, type, t, d, v, cut) {
    const ctx = this.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    f.type = 'lowpass'; f.frequency.value = cut;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(f); f.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + d + 0.05);
  }
}
