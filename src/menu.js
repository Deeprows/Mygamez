// Menu UI: bottom/side navigation (Race / Garage / Upgrades / Records), mode cards, mission picker, upgrade shop.
// DOM only; game state lives in main.js.
import { MODES, MISSIONS } from './modes.js';
import { profile, save, buy, upLevels, upCost, UP_KEYS, UP_MAX, UP_INFO } from './save.js';

const $ = (id) => document.getElementById(id);

const ICON = {
  endless: '<path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"/>',
  time: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  missions: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
};

export function initMenu(S, { cars, onUpgrade }) {
  const P = profile();
  const persist = () => { P.sel = { gm: S.gm, mi: S.missionIdx, tw: S.twoWay }; save(); };

  // ---- navigation
  const views = [...document.querySelectorAll('#panel .view')];
  const navBtns = [...document.querySelectorAll('#mnav button')];
  let tab = 'race';
  function showTab(name) {
    tab = name;
    for (const v of views) v.classList.toggle('on', v.dataset.v === name);
    for (const b of navBtns) b.classList.toggle('on', b.dataset.tab === name);
    $('panel').scrollTop = 0;
    if (name === 'upgrades') refreshShop();
    if (name === 'records') refreshRecords();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) showTab(b.dataset.tab);
  });

  // ---- mode cards
  const tabs = $('modes');
  for (const m of MODES) {
    const b = document.createElement('button');
    b.dataset.gm = m.id;
    b.innerHTML = `<svg viewBox="0 0 24 24">${ICON[m.id] || ''}</svg><span>${m.name}</span>`;
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
    $('modeInfo').innerHTML = mode.desc + (!mis && best > 0 ? `<b class="best">BEST ${best}</b>` : '');
    $('missionPick').classList.toggle('hidden', !mis);
    $('twoWayBtn').classList.toggle('hidden', mis);
    $('twoWayBtn').classList.toggle('on', S.twoWay);
    $('twoWayBtn').setAttribute('aria-checked', S.twoWay ? 'true' : 'false');
    if (mis) {
      const k = MISSIONS[S.missionIdx];
      $('missionName').textContent = `${S.missionIdx + 1}. ${k.title}${P.done[k.id] ? '  \u2713' : ''}`;
      $('missionDesc').textContent = `${k.desc}  \u00b7  ${k.time}s  \u00b7  \u25ce ${k.reward}${k.tw ? '  \u00b7  TWO-WAY' : ''}`;
    }
    $('coinBal').textContent = '\u25ce ' + P.coins;
    if (tab === 'records') refreshRecords();
  }

  // ---- upgrades
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

  // ---- records
  function refreshRecords() {
    const done = MISSIONS.filter((m) => P.done[m.id]).length;
    const stat = (label, val) => `<div class="stat"><small>${label}</small><b>${val}</b></div>`;
    const list = MISSIONS.map((m, i) =>
      `<div class="mrow${P.done[m.id] ? ' ok' : ''}"><span>${i + 1}</span><b>${m.title}</b><em>${P.done[m.id] ? '\u2713' : '\u25ce ' + m.reward}</em></div>`).join('');
    $('records').innerHTML =
      `<div class="stats">${stat('ENDLESS', P.best.endless || '-')}${stat('TIME ATTACK', P.best.time || '-')}` +
      `${stat('MISSIONS', done + '/' + MISSIONS.length)}${stat('COINS', '\u25ce ' + P.coins)}</div>` +
      `<div class="eyebrow">MISSION LOG</div><div class="mlist">${list}</div>`;
  }

  showTab('race');
  return { refresh, persist, showTab };
}
