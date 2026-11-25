// Time-of-day presets. Add a new look by adding a key here and to TODS.
export const TODS = ['day', 'sunset', 'night'];
export const TOD_ICONS = { day: '\u2600', sunset: '\u{1F307}', night: '\u{1F319}' };

export const TOD = {
  day:    { top: 0x2f7fd6, bottom: 0xcfe6f7, fog: 0xbfdcf2, fogFar: 700, hemiS: 0xcfe8ff, hemiG: 0x4a7a3a, hemiI: 0.9,  sun: 0xfff1d6, sunI: 2.6, sunPos: [-30, 60, 50], env: 0.55, exp: 1.0,  lamp: 1, glow: 1,   lights: 0,    stars: 0, cloud: 0xffffff, mount: 0x6f8fb3, bloom: 0.22 },
  sunset: { top: 0x3a4a9a, bottom: 0xffa862, fog: 0xf0a878, fogFar: 650, hemiS: 0xffc8a0, hemiG: 0x3a3326, hemiI: 0.65, sun: 0xff8c3c, sunI: 2.4, sunPos: [-70, 24, 40], env: 0.35, exp: 1.05, lamp: 3, glow: 2.5, lights: 500,  stars: 0, cloud: 0xffb890, mount: 0x7a5a78, bloom: 0.4 },
  night:  { top: 0x02040f, bottom: 0x1a2a4c, fog: 0x0b1630, fogFar: 480, hemiS: 0x5a74b8, hemiG: 0x10162a, hemiI: 0.4,  sun: 0x8aa4ff, sunI: 0.55, sunPos: [-30, 60, 50], env: 0.12, exp: 1.15, lamp: 9, glow: 6,   lights: 2400, stars: 1, cloud: 0x2a3552, mount: 0x141c33, bloom: 0.65 },
};

export function applyTOD(name, c) {
  const p = TOD[name] || TOD.day;
  const u = c.world.sky.material.uniforms;
  u.top.value.setHex(p.top); u.bottom.value.setHex(p.bottom);
  c.scene.fog.color.setHex(p.fog); c.scene.fog.far = p.fogFar;
  c.hemi.color.setHex(p.hemiS); c.hemi.groundColor.setHex(p.hemiG); c.hemi.intensity = p.hemiI;
  c.sun.color.setHex(p.sun); c.sun.intensity = p.sunI;
  c.scene.environmentIntensity = p.env;
  c.renderer.toneMappingExposure = p.exp;
  c.world.setLook(p);
  c.head.intensity = p.lights; c.head.visible = p.lights > 0;
  c.post.bloom.strength = p.bloom;
  c.onGlow(p.glow);
  return p;
}
