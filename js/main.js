// הדרקון של הנשיא – boot, menus, save, main loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { createWorld } from './world.js';
import { createSky, createFx } from './fx.js';
import { createDragon } from './dragon.js';
import { createFlight } from './flight.js';
import { createMissions } from './missions.js';

const $ = id => document.getElementById(id);
const SAVE = 'hadrakon:save', SET = 'hadrakon:settings';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };

const G = { t: 0, cine: false, uiOpen: true, playing: false, free: false };
G.settings = Object.assign({ sens: 1, vol: 0.8, invert: false, qual: 'high' }, load(SET, {}));
const params = new URLSearchParams(location.search), go = params.get('go');
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const setLoad = p => { $('loadBar').style.width = Math.round(p * 100) + '%'; };
if (matchMedia('(pointer:coarse)').matches && !matchMedia('(pointer:fine)').matches) $('mobileNote').classList.remove('hidden');

// ---------- renderer ----------
const hi = G.settings.qual === 'high';
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: !hi, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, hi ? 1.5 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = hi; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
G.renderer = renderer;
G.scene = new THREE.Scene();
G.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 6000);
let composer = null;
if (hi) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(G.scene, G.camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.5, 0.88));
  composer.addPass(new OutputPass());
}
addEventListener('resize', () => { G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer && composer.setSize(innerWidth, innerHeight); });

// ---------- build ----------
async function boot() {
  setLoad(0.05); await nextFrame();
  G.logo = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/logo.webp'; });
  setLoad(0.15); await nextFrame();
  createSky(G); createWorld(G); setLoad(0.7); await nextFrame();
  createFx(G); createDragon(G); createFlight(G); setLoad(0.9); await nextFrame();
  // perched on the cradle
  G.flight.place(new THREE.Vector3(0, 36.5, 0), 0); G.dragon.root.position.copy(G.flight.pos); G.dragon.root.quaternion.copy(G.flight.q);
  G.sky.set('dawn');
  renderer.compile(G.scene, G.camera);
  setLoad(1); await nextFrame();
  $('loading').classList.add('hidden');
  const sv = load(SAVE, null);
  if (sv && sv.step > 0) { $('btnContinue').disabled = false; $('contFires').textContent = sv.fires || 0; }
  if (go) start(go); else showMenu();
  requestAnimationFrame(loop);
}

// ---------- menus ----------
let screenStack = [];
function show(id) { ['menu', 'help', 'settings', 'pause', 'end'].forEach(s => $(s).classList.toggle('hidden', s !== id)); }
function showMenu() { G.uiOpen = true; show('menu'); $('hud').classList.add('hidden'); }
function open(id, from) { screenStack.push(from); show(id); }
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => show(screenStack.pop() || 'menu'));
$('btnHelp').onclick = () => open('help', 'menu');
$('btnSettings').onclick = () => { fillSettings(); open('settings', 'menu'); };
$('btnPHelp').onclick = () => open('help', 'pause');
$('btnPSettings').onclick = () => { fillSettings(); open('settings', 'pause'); };
function fillSettings() { $('sSens').value = G.settings.sens; $('sVol').value = G.settings.vol; $('sInv').checked = G.settings.invert; $('sQual').value = G.settings.qual; }
$('sSens').oninput = e => { G.settings.sens = +e.target.value; store(SET, G.settings); };
$('sVol').oninput = e => { G.settings.vol = +e.target.value; audio.setVol(G.settings.vol); store(SET, G.settings); };
$('sInv').onchange = e => { G.settings.invert = e.target.checked; store(SET, G.settings); };
$('sQual').onchange = e => { const q = e.target.value; if (q !== G.settings.qual) { G.settings.qual = q; store(SET, G.settings); if (G.playing) { G.save(); location.href = '?go=cont'; } else location.reload(); } };
// starting a mode reloads the page when a game already ran (the world keeps state), otherwise starts in place
let started = false;
$('btnPlay').onclick = () => { const sv = load(SAVE, null); if (sv && sv.step > 0 && !confirmNew()) return; started ? (location.href = '?go=new') : start('new'); };
$('btnContinue').onclick = () => started ? (location.href = '?go=cont') : start('cont');
$('btnFree').onclick = () => started ? (location.href = '?go=free') : start('free');
let newArmed = false;
function confirmNew() { if (newArmed) return true; newArmed = true; $('btnPlay').textContent = 'בטוח? ההתקדמות תימחק'; setTimeout(() => { newArmed = false; $('btnPlay').textContent = 'משחק חדש'; }, 3000); return false; }
$('btnResume').onclick = () => resume();
$('btnQuit').onclick = () => { G.save && G.save(); location.href = location.pathname; };
$('btnEndFree').onclick = () => { G.free = true; resume(); };
$('btnEndMenu').onclick = () => { location.href = location.pathname; };
addEventListener('keydown', e => { if (e.code === 'Escape' && G.playing && !G.uiOpen) pause(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G.playing && !G.uiOpen && !G.ended) pause(); });
$('gl').addEventListener('click', () => { if (G.playing && !G.uiOpen && !document.pointerLockElement) lock(); });
function lock() { try { const p = $('gl').requestPointerLock(); p && p.catch && p.catch(() => { }); } catch { } }
function pause() { G.uiOpen = true; show('pause'); G.save && G.save(); }
function resume() { show(null); G.uiOpen = false; $('hud').classList.remove('hidden'); audio.init(); lock(); }

let playStart = 0;
function start(mode) {
  started = true; audio.init(); audio.setVol(G.settings.vol);
  let saved = {};
  if (mode === 'new') { saved = {}; store(SAVE, null); }
  else if (mode === 'cont') { saved = load(SAVE, {}) || {}; }
  else if (mode === 'free') { saved = load(SAVE, {}) || {}; G.free = true; }
  if (saved.step >= 10) G.free = true;
  G.playTime = saved.time || 0; playStart = performance.now();
  if (mode !== 'new' && saved.step > 0) G.flight.place(new THREE.Vector3(0, 60, 40), 0);
  createMissions(G, { ...saved, step: G.free ? Math.max(saved.step || 0, 1) : saved.step || 0 });
  G.save = () => { if (!G.missions || G.free) return; store(SAVE, { ...G.missions.state(), time: G.playTime + (performance.now() - playStart) / 1000 }); };
  G.onEnd = () => { G.ended = true; G.save(); audio.sfx('win'); if (document.pointerLockElement) document.exitPointerLock(); const m = Math.round((G.playTime + (performance.now() - playStart) / 1000) / 60); $('endStats').textContent = `הדרקון של שבט הנשיא הציל את המחנה. זמן משחק: ${m} דקות.`; G.uiOpen = true; show('end'); $('hud').classList.add('hidden'); };
  G.playing = true; resume();
}
G.sfx = n => audio.sfx(n);
let promptText = '';
G.prompt = t => { promptText = t; };

// ---------- loop ----------
const clock = new THREE.Clock();
let lastFlap = 0;
const camHome = new THREE.Vector3();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  G.t += dt;
  input.begin(); promptText = '';
  const F = G.flight, D = G.dragon;
  if (!G.playing) {
    // menu: slow orbit around the perched dragon
    const a = G.t * 0.08; G.camera.position.set(Math.sin(a) * 42, 44 + Math.sin(G.t * 0.2) * 3, Math.cos(a) * 42); G.camera.lookAt(0, 36, 0);
    F.state.flapRate = 0; F.state.speed = 0; D.update(dt, F.state);
  } else {
    if (!G.cine && !G.uiOpen) F.update(dt);
    if (!G.uiOpen || G.cine) {
      if (G.missions) G.missions.update(dt);
      if (G.cine && G.missions && G.missions.step === 0) { F.state.flapRate = G.missions.stepT > 4 ? 0.6 : 0; F.state.speed = 0; F.state.breath = G.missions.stepT > 6 && G.missions.stepT < 7.6; }
      D.update(dt, F.state);
      if (F.state.breath) G.fx.breath(dt);
      G.fx.streaks(dt);
      if (F.skim && F.speed > 18 && Math.random() < dt * 30) G.fx.splash(F.pos, F.vel);
      // wing beat sound on each downstroke
      const ph = Math.floor((D.flap - 0.4) / (Math.PI * 2)); if (ph !== lastFlap) { lastFlap = ph; if (F.state.flapRate > 0.2) audio.flap(0.6 + F.state.boost * 0.4); }
    }
  }
  G.fx.update(G.uiOpen && G.playing && !G.cine ? 0 : dt);
  G.world.update(dt, G.t); G.sky.update(dt);
  audio.update(G.playing && !G.uiOpen ? F.speed : 0, F.state.breath && G.playing && !G.uiOpen, D.flap, G.sky.name === 'storm');
  // HUD
  if (G.playing) {
    $('speedNum').textContent = Math.round(F.speed * 3.6);
    $('boostBar').style.width = Math.round(F.boostE * 100) + '%';
    const pr = $('prompt'); pr.classList.toggle('hidden', !promptText); if (promptText) pr.textContent = promptText;
    $('cross').classList.toggle('hidden', !!G.cine);
  }
  $('flashOv').style.opacity = Math.min(0.8, (G.flash || 0) * 0.5);
  if (composer) composer.render(); else renderer.render(G.scene, G.camera);
  input.end();
}
boot().catch(e => { console.error(e); $('loading').querySelector('.over').textContent = 'שגיאה בטעינה: ' + e.message; });
window.__G = G; window.__input = input;
