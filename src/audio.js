// Tiny WebAudio engine synth + crash noise. No audio files needed (Stage 3 replaces with samples).
export class Sfx {
  constructor() { this.ctx = null; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.osc = ctx.createOscillator(); this.osc.type = 'sawtooth';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'square';
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 600;
    this.gain = ctx.createGain(); this.gain.gain.value = 0;
    this.osc.connect(this.lp); this.osc2.connect(this.lp);
    this.lp.connect(this.gain); this.gain.connect(ctx.destination);
    this.osc.start(); this.osc2.start();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  }

  update(speed01, gas, on = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const gf = speed01 * 5, gear = Math.min(4, Math.floor(gf));
    const rpm = 0.25 + 0.75 * Math.min(1, gf - gear);
    const f = 48 + rpm * 130;
    this.osc.frequency.setTargetAtTime(f, t, 0.04);
    this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
    this.lp.frequency.setTargetAtTime(500 + rpm * 1500 + (gas ? 600 : 0), t, 0.08);
    this.gain.gain.setTargetAtTime(on ? 0.04 + 0.04 * gas : 0, t, 0.1);
  }

  stop() { if (this.ctx) this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); }

  crash() {
    if (!this.ctx) return;
    const ctx = this.ctx, len = (ctx.sampleRate * 0.5) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(g); g.connect(ctx.destination); src.start();
  }
}