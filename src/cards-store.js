export const CARD_KEY = 'double-ear.cards.v1';
export const TAKE_KEY = 'double-ear.takes.v1';
export const MAX_HAND = 6;
export const MAX_TAKE_MS = 90000;

export function readCollection(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('本機資料格式不正確，未覆寫收藏。');
  return value;
}
export function saveCollection(key, entries) { localStorage.setItem(key, JSON.stringify(entries)); }
export function drawPool(catalogue, hand, random = Math.random) {
  const candidates = catalogue.filter(item => !hand.includes(item.id));
  for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
  return candidates.slice(0, 4);
}
export function snapshotCard(name, state) {
  const snapshot = structuredClone(state);
  const ids = snapshot.handIds || snapshot.layers.filter(layer => layer.enabled).map(layer => layer.id);
  snapshot.layers = snapshot.layers.filter(layer => ids.includes(layer.id)).slice(0, MAX_HAND);
  snapshot.handIds = snapshot.layers.map(layer => layer.id);
  return { id: crypto.randomUUID(), name: name.trim() || '未命名基底', type: 'BLEND', createdAt: new Date().toISOString(), state: snapshot };
}
export function downloadJSON(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The initial state embeds complete cards, so takes survive later edits to the collection.
export function makeTake(name, initial, events, duration) {
  const bounded = Math.max(1, Math.min(MAX_TAKE_MS, duration));
  return { version: 1, id: crypto.randomUUID(), name: name.trim() || '未命名演奏', createdAt: new Date().toISOString(), duration: bounded,
    initial: structuredClone(initial), events: structuredClone(events.filter(event => event.t >= 0 && event.t <= bounded).sort((a, b) => a.t - b.t)) };
}
