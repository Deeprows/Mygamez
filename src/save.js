// Persistent profile (localStorage): coins, per-car upgrades, best scores, finished missions, menu selection.
const KEY = 'hr3d-profile';
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export const UP_KEYS = ['top', 'hnd', 'nit'];
export const UP_MAX = 5;
export const UP_INFO = {
  top: { name: 'TOP SPEED', desc: '+2.5 m/s maximum speed' },
  hnd: { name: 'HANDLING', desc: '+5% steering response' },
  nit: { name: 'NITRO', desc: 'Longer burn, faster refill, more punch' },
};
const COSTS = [150, 300, 550, 900, 1400];
export const upCost = (lvl) => (lvl >= UP_MAX ? Infinity : COSTS[lvl]);

function load() {
  const p = { coins: 0, up: {}, best: { endless: 0, time: 0 }, done: {}, sel: { gm: 'endless', mi: 0, tw: false } };
  let raw = null;
  try { raw = JSON.parse(get(KEY) || 'null'); } catch { raw = null; }
  if (raw && typeof raw === 'object') {
    p.coins = Math.max(0, Number(raw.coins) || 0);
    if (raw.up && typeof raw.up === 'object') p.up = raw.up;
    if (raw.best && typeof raw.best === 'object') Object.assign(p.best, raw.best);
    if (raw.done && typeof raw.done === 'object') p.done = raw.done;
    if (raw.sel && typeof raw.sel === 'object') Object.assign(p.sel, raw.sel);
  } else {
    p.best.endless = Number(get('hr3d-best') || 0) || 0; // migrate the Stage 1-3 best score
  }
  return p;
}

const P = load();
export const profile = () => P;
export const save = () => set(KEY, JSON.stringify(P));

export function upLevels(carId) {
  const u = P.up[carId] || {};
  const lv = {};
  for (const k of UP_KEYS) lv[k] = Math.min(UP_MAX, Math.max(0, Number(u[k]) || 0));
  return lv;
}

/** Try to buy the next level of `key` for car `carId`. Returns true on success. */
export function buy(carId, key) {
  const lv = upLevels(carId);
  const cost = upCost(lv[key]);
  if (!UP_KEYS.includes(key) || lv[key] >= UP_MAX || P.coins < cost) return false;
  P.coins -= cost;
  P.up[carId] = { ...lv, [key]: lv[key] + 1 };
  save();
  return true;
}

export function addCoins(n) { P.coins += n; save(); }

/** Catalog stats + upgrades. top = max m/s, acc/hnd = multipliers, nit = nitro level (0-5). */
export function effStats(entry) {
  const l = upLevels(entry.id);
  return {
    top: entry.stats.top + l.top * 2.5,
    acc: entry.stats.acc,
    hnd: entry.stats.hnd * (1 + 0.05 * l.hnd),
    nit: l.nit,
  };
}
