// Touch controls for phones and tablets. Nothing here changes the computer version: the UI is only built
// after a real touch (or with ?touch in the URL). Controls write into the same `input` the keyboard uses:
// joystick up/down = W/S and sideways feeds mx, right-side drag = mx/my, buttons hold F / Shift / Space,
// the E button raises input._e. Hooks from main.js: G, pause(), lowQuality(), audio().
import { input } from './input.js';

const q = new URLSearchParams(location.search);
const mm = s => matchMedia(s).matches;
// A phone/tablet at load time (iPadOS reports a Mac user agent but has touch points).
export const touchLikely = q.has('touch') || (mm('(pointer:coarse)') && !mm('(pointer:fine)')) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
if (touchLikely) document.documentElement.classList.add('touchdev');

let hooks = null, pending = false, on = false;
export function initTouch(h) { hooks = h; if (pending || q.has('touch')) enable(); }
function first(e) { if (e.type === 'touchstart' || e.pointerType === 'touch') { if (hooks) enable(); else pending = true; } }
addEventListener('touchstart', first, { capture: true, passive: true });
addEventListener('pointerdown', first, { capture: true, passive: true });

const el = (tag, id, cls, html) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const stop = e => { if (e.cancelable) e.preventDefault(); };

function enable() {
  if (on) return; on = true;
  const G = hooks.G; G.touch = true; input.touch = true;
  document.documentElement.classList.add('touchdev', 'touch');
  const note = document.getElementById('mobileNote'); note && note.classList.add('hidden');
  hooks.lowQuality();
  addEventListener('touchend', () => hooks.audio(), { once: true });
  document.addEventListener('gesturestart', stop, { passive: false });          // iOS pinch zoom
  document.getElementById('gl').addEventListener('touchmove', stop, { passive: false });

  // ---------- DOM ----------
  const layer = el('div', 'tLayer', 'hidden');                                     // joystick + drag surface, under the HUD
  const ui = el('div', 'tUI', 'hidden');
  const stick = el('div', 'tStick', '', '<i></i>'), knob = stick.firstChild;
  const bPause = el('button', 'tPause', 'tb', '<i></i><i></i>'); bPause.setAttribute('aria-label', 'עצירה');
  const bFire = el('button', 'tFire', 'tb', 'אש'), bBoost = el('button', 'tBoost', 'tb', 'זינוק'), bUp = el('button', 'tUp', 'tb', 'למעלה');
  const bE = el('button', 'tE', 'tb hidden', '<b>E</b><span></span>'), eText = bE.lastChild;
  ui.append(stick, bPause, bUp, bBoost, bFire, bE);
  document.body.append(layer, ui);
  for (const n of [layer, ui]) { n.addEventListener('touchstart', stop, { passive: false }); n.addEventListener('touchmove', stop, { passive: false }); n.addEventListener('contextmenu', stop); }

  // ---------- hold buttons ----------
  const held = new Map();                                                           // pointerId -> release fn
  function hold(btn, press, release) {
    btn.addEventListener('pointerdown', e => { stop(e); btn.classList.add('on'); press(); held.set(e.pointerId, () => { btn.classList.remove('on'); release(); }); try { btn.setPointerCapture(e.pointerId); } catch { } });
    const up = e => { const r = held.get(e.pointerId); if (r) { held.delete(e.pointerId); r(); } };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('lostpointercapture', up);
  }
  const key = c => [() => { input.keys[c] = true; }, () => { input.keys[c] = false; }];
  hold(bFire, ...key('KeyF')); hold(bBoost, ...key('ShiftLeft')); hold(bUp, ...key('Space'));
  hold(bE, () => { input._e = true; }, () => { });
  bPause.addEventListener('pointerdown', e => { stop(e); if (active) hooks.pause(); });
  // a short tap on the radio box skips a line (the keyboard's Enter); a drag that starts there still steers
  const radio = document.getElementById('radio');
  const onRadio = (x, y) => { if (radio.classList.contains('hidden')) return false; const r = radio.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
  const skipRadio = () => { input.keys.Enter = true; setTimeout(() => { input.keys.Enter = false; }, 200); };

  // ---------- joystick (left) + drag to look/steer (rest of the screen) ----------
  const R = 52;                                                                     // knob travel in px
  let stickId = null, sx = 0, sy = 0, jx = 0, jy = 0;
  const drags = new Map();                                                          // pointerId -> last x/y
  const restStick = () => { stick.style.left = ''; stick.style.top = ''; stick.classList.remove('live'); knob.style.transform = ''; jx = jy = 0; };
  layer.addEventListener('pointerdown', e => {
    stop(e); try { layer.setPointerCapture(e.pointerId); } catch { }
    const W = innerWidth, H = innerHeight;
    if (stickId === null && e.clientX < W * 0.45 && e.clientY > H * 0.38) {
      stickId = e.pointerId;
      const half = stick.offsetWidth / 2;
      sx = Math.min(Math.max(e.clientX, half + 6), W - half - 6); sy = Math.min(Math.max(e.clientY, half + 6), H - half - 6);
      stick.style.left = (sx - half) + 'px'; stick.style.top = (sy - half) + 'px'; stick.classList.add('live');
      moveStick(e);
    } else drags.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), radio: onRadio(e.clientX, e.clientY) });
  });
  function moveStick(e) {
    let dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    jx = dx / R; jy = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
  }
  layer.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) { moveStick(e); return; }
    const p = drags.get(e.pointerId); if (!p) return;
    const k = Math.min(3.6, Math.max(1.4, 1300 / Math.min(innerWidth, innerHeight)));   // touch px -> mouse units
    input.mx += (e.clientX - p.x) * k; input.my += (e.clientY - p.y) * k; p.x = e.clientX; p.y = e.clientY;
  });
  const lift = e => {
    if (e.pointerId === stickId) { stickId = null; restStick(); syncStickKeys(); }
    const p = drags.get(e.pointerId);
    if (p && p.radio && e.type === 'pointerup' && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 12 && performance.now() - p.t0 < 400) skipRadio();
    drags.delete(e.pointerId);
  };
  layer.addEventListener('pointerup', lift); layer.addEventListener('pointercancel', lift); layer.addEventListener('lostpointercapture', lift);
  function syncStickKeys() { input.keys.KeyW = jy < -0.35; input.keys.KeyS = jy > 0.45; }

  // ---------- per frame (called at the start of input.begin) ----------
  let active = false, last = performance.now(), eShown = false, eLabel = '';
  const prompt = document.getElementById('prompt');
  function releaseAll() { for (const r of held.values()) r(); held.clear(); drags.clear(); stickId = null; restStick(); input.keys.KeyW = input.keys.KeyS = false; }
  input.onBegin = () => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    const a = !!(G.playing && !G.uiOpen && !G.cine && !G.ended);
    if (a !== active) { active = a; layer.classList.toggle('hidden', !a); ui.classList.toggle('hidden', !a); if (!a) releaseAll(); }
    if (!a) return;
    if (stickId !== null) {
      syncStickKeys();
      const s = Math.abs(jx) < 0.15 ? 0 : (jx - Math.sign(jx) * 0.15) / 0.85;     // sideways steers like a slow mouse pan
      input.mx += s * 620 * dt;
    }
    // contextual E button mirrors an "E – …" prompt
    const t = prompt.classList.contains('hidden') ? '' : prompt.textContent, isE = /^E\s*[–-]/.test(t);
    if (isE !== eShown) { eShown = isE; bE.classList.toggle('hidden', !isE); prompt.classList.toggle('tE', isE); }
    if (isE) { const l = t.replace(/^E\s*[–-]\s*/, ''); if (l !== eLabel) { eLabel = l; eText.textContent = l; } }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && active) hooks.pause(); });
}
