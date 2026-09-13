import { clamp } from './audio-utils.js';

export function cardGesture(element, { value, volume, select, remove, replace }) {
  let start = null, moved = false, suppress = false, hold;
  element.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    start = { y: e.clientY, level: value() }; moved = false; suppress = false;
    element.setPointerCapture(e.pointerId);
    if (replace) hold = setTimeout(() => { suppress = true; start = null; replace(); }, 550);
  });
  element.addEventListener('pointermove', e => {
    if (!start) return;
    const delta = start.y - e.clientY;
    if (Math.abs(delta) > 5) { moved = true; clearTimeout(hold); }
    const deleting = remove && e.clientY - start.y > 110;
    element.classList.toggle('discarding', !!deleting);
    if (moved && !deleting) volume(clamp(start.level + delta / 220, 0, 1));
  });
  element.addEventListener('pointerup', e => {
    clearTimeout(hold);
    if (start && remove && e.clientY - start.y > 110) { remove(); suppress = true; }
    else suppress = suppress || moved;
    start = null; element.classList.remove('discarding');
  });
  element.addEventListener('pointercancel', () => { clearTimeout(hold); start = null; suppress = true; element.classList.remove('discarding'); });
  element.addEventListener('click', () => { if (suppress) { suppress = false; return; } select(); });
  element.addEventListener('wheel', e => { e.preventDefault(); volume(clamp(value() + (e.deltaY < 0 ? .025 : -.025), 0, 1)); }, { passive: false });
  element.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); volume(clamp(value() + (e.key === 'ArrowUp' ? .025 : -.025), 0, 1)); }
    if (e.key === 'Delete' && remove) { e.preventDefault(); remove(); }
    if (e.key === 'F2' && replace) { e.preventDefault(); replace(); }
  });
}
