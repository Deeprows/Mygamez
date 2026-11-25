// Game modes + mission definitions. Pure data/helpers (no DOM, no three.js).
export const MODES = [
  { id: 'endless', name: 'ENDLESS', desc: 'Dodge traffic as long as you can. The scenery changes every 2.5 km.' },
  { id: 'time', name: 'TIME ATTACK', desc: 'Race the clock. Every 1 km checkpoint adds time.' },
  { id: 'missions', name: 'MISSIONS', desc: 'Finish objectives to earn coins for upgrades.' },
];

/**
 * type: overtake | speed (hold `target` km/h for `hold` s) | combo | coins | distance (km) | onc (near misses with oncoming cars)
 * tw: two-way road (lanes 1-2 on the left carry oncoming traffic). diff: 0..1 traffic difficulty. time: seconds limit.
 */
export const MISSIONS = [
  { id: 'm1',  title: 'WARM-UP',        desc: 'Overtake 15 cars',                 type: 'overtake', target: 15, time: 100, biome: 'highway', tw: false, diff: 0.0,  reward: 100 },
  { id: 'm2',  title: 'NEED FOR SPEED', desc: 'Hold 190 km/h for 4 s',            type: 'speed',    target: 190, hold: 4, time: 70, biome: 'highway', tw: false, diff: 0.1, reward: 150 },
  { id: 'm3',  title: 'CLOSE SHAVE',    desc: 'Reach a x5 near-miss combo',       type: 'combo',    target: 5,  time: 120, biome: 'city',    tw: false, diff: 0.25, reward: 200 },
  { id: 'm4',  title: 'COIN RUSH',      desc: 'Collect 30 coins',                 type: 'coins',    target: 30, time: 90,  biome: 'desert',  tw: false, diff: 0.25, reward: 220 },
  { id: 'm5',  title: 'WRONG WAY',      desc: '6 near misses with oncoming cars', type: 'onc',      target: 6,  time: 100, biome: 'city',    tw: true,  diff: 0.3,  reward: 300 },
  { id: 'm6',  title: 'SNOW SPRINT',    desc: 'Drive 3 km',                       type: 'distance', target: 3,  time: 100, biome: 'snow',    tw: false, diff: 0.4,  reward: 300 },
  { id: 'm7',  title: 'RUSH HOUR',      desc: 'Overtake 40 cars',                 type: 'overtake', target: 40, time: 140, biome: 'city',    tw: false, diff: 0.6,  reward: 400 },
  { id: 'm8',  title: 'COMBO KING',     desc: 'Reach a x10 near-miss combo',      type: 'combo',    target: 10, time: 150, biome: 'desert',  tw: false, diff: 0.7,  reward: 500 },
  { id: 'm9',  title: 'REDLINE',        desc: 'Hold 230 km/h for 5 s',            type: 'speed',    target: 230, hold: 5, time: 90, biome: 'highway', tw: false, diff: 0.8, reward: 600 },
  { id: 'm10', title: 'GHOST ROAD',     desc: 'Drive 5 km on a two-way snow road', type: 'distance', target: 5, time: 150, biome: 'snow',    tw: true,  diff: 0.9,  reward: 1000 },
];

export function goalValue(m, S) {
  switch (m.type) {
    case 'overtake': return S.overtakes;
    case 'speed': return Math.min(m.hold, S.holdT);
    case 'combo': return S.bestCombo;
    case 'coins': return S.runCoins;
    case 'distance': return S.dist / 1000;
    case 'onc': return S.oncMisses;
    default: return 0;
  }
}
export const goalTarget = (m) => (m.type === 'speed' ? m.hold : m.target);

export function goalLabel(m, S) {
  const v = goalValue(m, S);
  switch (m.type) {
    case 'overtake': return `OVERTAKE ${Math.floor(v)}/${m.target}`;
    case 'speed': return `${m.target} KM/H  ${v.toFixed(1)}/${m.hold}s`;
    case 'combo': return `COMBO x${Math.floor(v)}/${m.target}`;
    case 'coins': return `COINS ${Math.floor(v)}/${m.target}`;
    case 'distance': return `DISTANCE ${v.toFixed(1)}/${m.target} KM`;
    case 'onc': return `ONCOMING MISSES ${Math.floor(v)}/${m.target}`;
    default: return '';
  }
}

export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
