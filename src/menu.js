// Menu UI: mode tabs, mission picker, two-way toggle, upgrade shop. DOM only; game state lives in main.js.
import { MODES, MISSIONS } from './modes.js';
import { profile, save, buy, upLevels, upCost, UP_KEYS, UP_MAX, UP_INFO } from './save.js';

const $ = (id) => document.getElementById(id);

export function initMenu(S, { cars, onUpgrade }) {
  const P = profile();
  const persist = () => { P.sel = { gm: S.gm, mi: S.missionIdx, tw: S.twoWay }; save(); };

  const tabs = $('modes');
  for (const m of MODES) {
    const b = document.createElement('button');
    b.dataset.gm = m.id; b.textContent = m.name;
    b.addEventListener('click', () => { S.gm = m.id; persist(); refresh(); });
    tabs.appendChild(b);
  }
  $('prevM').addEventListener('click', () => { S.missionIdx = (S.missionIdx + MISSIONS.length - 1) % MISSIONS.length; persist(); refresh(); });
  $('nextM').addEventListener('click', () => { S.missionIdx = (S.missionIdx + 1) % MISSIONS.length; persist(); refresh(); });
  $('twoWayBtn').addEventListener('click', () => { S.twoWay = !S.twoWay; persist(); refresh(); });

  function refresh() {
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.gm === S.gm);
    const mode = MODES.find((m) => m.id === S.gm);
    const mis = S.gm === 'missions';
    const best = S.gm === 'time' ? P.best.time : P.best.endless;
    $('modeInfo').textContent = mode.desc + (!mis && best > 0 ? `  Best: ${best}` : '');
    $('missionPick').classList.toggle('hidden', !mis);
    $('twoWayBtn').classList.toggle('hidden', mis);
    $('twoWayBtn').textContent = 'TWO-WAY ROAD: ' + (S.twoWay ? 'ON  (x2 score on the oncoming side)' : 'OFF');
    $('twoWayBtn').classList.toggle('on', S.twoWay);
    if (mis) {
      const k = MISSIONS[S.missionIdx];
      $('missionName').textContent = `${S.missionIdx + 1}. ${k.title}${P.done[k.id] ? '  \u2713' : ''}`;
      $('missionDesc').textContent = `${k.desc}  \u00b7  ${k.time}s  \u00b7  \u25ce ${k.reward}${k.tw ? '  \u00b7  TWO-WAY' : ''}`;
    }
    $('coinBal').textContent = '\u25ce ' + P.coins;
  }

  // ---- shop
  function refreshShop() {
    const car = cars[S.carIdx], lv = upLevels(car.id);
    $('shopCar').textContent = car.name.toUpperCase();
    $('shopCoins').textContent = '\u25ce ' + P.coins;
    const rows = $('shopRows');
    rows.innerHTML = '';
    for (const k of UP_KEYS) {
      const l = lv[k], max = l >= UP_MAX, cost = upCost(l);
      const pips = Array.from({ length: UP_MAX }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
      const row = document.createElement('div');
      row.className = 'shrow';
      row.innerHTML = `<div><b>${UP_INFO[k].name}</b><small>${UP_INFO[k].desc}</small><div class="pips">${pips}</div></div>` +
        `<button data-k="${k}" ${max || P.coins < cost ? 'disabled' : ''}>${max ? 'MAX' : '\u25ce ' + cost}</button>`;
      rows.appendChild(row);
    }
  }
  $('shopRows').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]');
    if (!b || b.disabled) return;
    if (buy(cars[S.carIdx].id, b.dataset.k)) { refreshShop(); refresh(); onUpgrade(); }
  });
  $('shopBtn').addEventListener('click', () => { $('shop').classList.remove('hidden'); refreshShop(); });
  $('shopBack').addEventListener('click', () => { $('shop').classList.add('hidden'); refresh(); onUpgrade(); });

  return { refresh, persist };
}
