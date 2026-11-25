export class Hud {
  constructor(canvas) {
    this.c = canvas.getContext('2d');
    this.W = canvas.width;
  }

  draw(kmh) {
    const c = this.c, W = this.W, cx = W / 2, cy = W / 2, R = W / 2 - 6, max = 240;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const f = Math.min(1, kmh / max);
    const gear = Math.max(1, Math.min(6, 1 + Math.floor(kmh / 45)));

    c.clearRect(0, 0, W, W);
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fillStyle = 'rgba(8,14,28,0.78)'; c.fill();
    c.lineWidth = 3; c.strokeStyle = 'rgba(120,200,255,0.45)'; c.stroke();

    c.lineCap = 'round';
    c.lineWidth = 10; c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.beginPath(); c.arc(cx, cy, R - 16, a0, a1); c.stroke();
    if (f > 0.002) {
      c.strokeStyle = `hsl(${190 - 190 * f},95%,58%)`;
      c.beginPath(); c.arc(cx, cy, R - 16, a0, a0 + (a1 - a0) * f); c.stroke();
    }

    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = 'bold 13px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let v = 0; v <= max; v += 20) {
      const a = a0 + (a1 - a0) * v / max, ca = Math.cos(a), sa = Math.sin(a);
      c.beginPath();
      c.moveTo(cx + ca * (R - 36), cy + sa * (R - 36));
      c.lineTo(cx + ca * (R - 30), cy + sa * (R - 30));
      c.stroke();
      if (v % 40 === 0) c.fillText(String(v), cx + ca * (R - 49), cy + sa * (R - 49));
    }

    c.fillStyle = '#fff'; c.font = '800 64px system-ui,sans-serif';
    c.fillText(String(kmh), cx, cy - 2);
    c.font = '700 15px system-ui,sans-serif'; c.fillStyle = 'rgba(255,255,255,0.75)';
    c.fillText('KM/H', cx, cy + 36);
    c.font = '800 24px system-ui,sans-serif'; c.fillStyle = '#4dd2ff';
    c.fillText('D' + gear, cx, cy + R - 20);
  }
}
