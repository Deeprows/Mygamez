const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MAXW = 1.6; // max wheel rotation in radians (~92 deg)

export class Controls {
  constructor() {
    this.steer = 0; this.gas = 0; this.brake = 0;
    this.keys = new Set();
    this.wheelAngle = 0;
    this.dragging = false;
    this.padGas = false; this.padBrake = false; this.padNitro = false; this.nitro = 0;
    this.wheelEl = document.getElementById('wheel');
    this.svg = this.wheelEl.firstElementChild;

    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    this._pedal('gas', 'padGas');
    this._pedal('brake', 'padBrake');
    this._pedal('nitroBtn', 'padNitro');
    this._wheel();
  }

  _pedal(id, flag) {
    const el = document.getElementById(id);
    const on = (e) => { this[flag] = true; el.classList.add('active'); el.setPointerCapture?.(e.pointerId); e.preventDefault(); };
    const off = () => { this[flag] = false; el.classList.remove('active'); };
    el.addEventListener('pointerdown', on);
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, off);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _wheel() {
    const el = this.wheelEl;
    let a0 = 0, w0 = 0;
    const ang = (e) => {
      const r = el.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    el.addEventListener('pointerdown', (e) => {
      this.dragging = true; a0 = ang(e); w0 = this.wheelAngle;
      el.setPointerCapture?.(e.pointerId); e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      let d = ang(e) - a0;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      this.wheelAngle = clamp(w0 + d, -MAXW, MAXW);
    });
    const end = () => { this.dragging = false; };
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, end);
  }

  update(dt) {
    const k = this.keys;
    const left = k.has('ArrowLeft') || k.has('KeyA');
    const right = k.has('ArrowRight') || k.has('KeyD');
    const kx = (right ? 1 : 0) - (left ? 1 : 0);
    if (!this.dragging) {
      const target = kx * MAXW;
      this.wheelAngle += (target - this.wheelAngle) * Math.min(1, (kx ? 6 : 9) * dt);
    }
    this.steer = this.wheelAngle / MAXW;
    this.gas = (k.has('ArrowUp') || k.has('KeyW') || this.padGas) ? 1 : 0;
    this.brake = (k.has('ArrowDown') || k.has('KeyS') || k.has('Space') || this.padBrake) ? 1 : 0;
    this.nitro = (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyE') || this.padNitro) ? 1 : 0;
    this.svg.style.transform = `rotate(${this.wheelAngle}rad)`;
  }
}
