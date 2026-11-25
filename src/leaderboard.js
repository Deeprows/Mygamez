const KEY = 'hr3d-scores';
const cfg = window.HR3D_LEADERBOARD || {};
const endpoint = String(cfg.supabaseUrl || '').replace(/\/$/, '');
const anonKey = String(cfg.anonKey || '');

function readScores() {
  try { const rows = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(rows) ? rows : []; }
  catch { return []; }
}
function safeName(value) { return String(value || 'Racer').trim().slice(0, 18) || 'Racer'; }

export function recordScore(entry) {
  const row = { ...entry, name: safeName(entry.name), score: Math.max(0, Math.floor(Number(entry.score) || 0)), created_at: new Date().toISOString() };
  const rows = [...readScores(), row].sort((a, b) => b.score - a.score).slice(0, 50);
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* private mode / storage full */ }
  return row;
}

export function getLocalScores(mode = 'endless') {
  return readScores().filter(row => row.mode === mode).sort((a, b) => b.score - a.score).slice(0, 10);
}

export async function fetchOnlineScores(mode = 'endless') {
  if (!endpoint || !anonKey) return { configured: false, rows: [] };
  try {
    const url = new URL(endpoint + '/rest/v1/scores');
    url.search = new URLSearchParams({ select: 'player_name,score,mode,distance,car,created_at', mode: 'eq.' + mode, order: 'score.desc', limit: '10' }).toString();
    const response = await fetch(url, { headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey } });
    if (!response.ok) return { configured: true, rows: [] };
    const rows = await response.json();
    return { configured: true, rows: Array.isArray(rows) ? rows : [] };
  } catch { return { configured: true, rows: [] }; }
}

export async function submitOnlineScore(entry) {
  if (!endpoint || !anonKey) return { configured: false, ok: false };
  try {
    const response = await fetch(endpoint + '/rest/v1/scores', {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        player_name: safeName(entry.name),
        score: Math.max(0, Math.floor(Number(entry.score) || 0)),
        mode: entry.mode,
        distance: Math.max(0, Math.floor(Number(entry.distance) || 0)),
        car: String(entry.car || '').slice(0, 40),
      }),
    });
    return { configured: true, ok: response.ok };
  } catch { return { configured: true, ok: false }; }
}
