// Story + missions: 3 chapters, 8 fires. Radio dialogue, objectives with an on-screen marker, rings,
// beacons lit by breath, lost campers to carry home, a race vs Beit Dani's green dragon, the storm finale.
import * as THREE from 'three';
import { createDragon } from './dragon.js';
import { input } from './input.js';

const $ = id => document.getElementById(id);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export function createMissions(G, saved) {
  const S = G.scene, W = G.world, F = G.flight, X = G.fx;
  const M = { fires: saved.fires || 0, step: saved.step || 0, chapter: 1 };
  // ---------- radio ----------
  const queue = []; let talking = null, talkT = 0;
  const who = { noy: ['נוי', 'רכזת המחנה', '#f3e03b'], yoav: ['יואב', 'חניך', '#8fd0ff'], dani: ['גלעד', 'הדרקון של בית דני', '#7fdc7f'], storm: ['הסערה', '', '#b0b0c0'], kids: ['החניכים', '', '#ffb07a'] };
  M.say = (k, text, dur) => { queue.push({ k, text, dur: dur || Math.max(3.2, text.length * 0.075) }); };
  function radio(dt) {
    if (!talking && queue.length) { talking = queue.shift(); talkT = talking.dur; const w = who[talking.k]; $('radio').classList.remove('hidden'); $('rName').textContent = w[0]; $('rName').style.color = w[2]; $('rRole').textContent = w[1]; $('rText').textContent = talking.text; G.sfx && G.sfx('radio'); }
    if (talking) { talkT -= dt; if (talkT <= 0 || (input.keys.Enter && talkT < talking.dur - 0.4)) { talking = null; if (!queue.length) $('radio').classList.add('hidden'); } }
  }
  M.quiet = () => !talking && !queue.length;
  // ---------- objective + marker ----------
  let obj = null;
  M.objective = (text, target) => { obj = { text, target }; $('objText').textContent = text; $('obj').classList.toggle('hidden', !text); };
  function marker() {
    const mk = $('marker'); if (!obj || !obj.target) { mk.classList.add('hidden'); return; }
    const t = typeof obj.target === 'function' ? obj.target() : obj.target; if (!t) { mk.classList.add('hidden'); return; }
    const p = t.clone().project(G.camera), d = t.distanceTo(F.pos); mk.classList.remove('hidden');
    let x = p.x, y = p.y; const behind = p.z > 1; if (behind) { x = -x; y = -y; }
    const off = Math.abs(x) > 0.92 || Math.abs(y) > 0.88 || behind; if (off) { const m = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.88); x /= m; y /= m; }
    mk.style.left = ((x + 1) / 2 * innerWidth) + 'px'; mk.style.top = ((1 - y) / 2 * innerHeight) + 'px'; mk.classList.toggle('edge', off);
    $('mkDist').textContent = Math.round(d) + ' מ׳';
  }
  // ---------- chapter cards + fires counter ----------
  M.card = (over, title) => { $('cardOver').textContent = over; $('cardTitle').textContent = title; const c = $('card'); c.classList.remove('hidden'); c.style.opacity = 1; setTimeout(() => c.style.opacity = 0, 3400); setTimeout(() => c.classList.add('hidden'), 4200); };
  const firesUI = () => { $('fires').innerHTML = [...Array(8)].map((_, i) => `<i class="${i < M.fires ? 'on' : ''}"></i>`).join('') + `<b>${M.fires}/8 מדורות</b>`; };
  firesUI();
  M.addFire = (b) => { M.fires++; firesUI(); X.burst(b.pos, 90); G.sfx && G.sfx('ignite'); G.save && G.save(); };

  // ---------- rings ----------
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xcdb27e, emissive: 0xffc040, emissiveIntensity: 0.6, roughness: 0.8 });
  const rings = [];
  function ring(p, yaw, r = 9) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.9, 8, 28), ringMat.clone()); m.position.copy(p); m.rotation.y = yaw; S.add(m); const o = { m, p: p.clone(), n: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), r, passed: false, prev: null }; rings.push(o); return o; }
  function clearRings() { for (const r of rings) S.remove(r.m); rings.length = 0; }
  function ringsUpdate() {
    let next = rings.find(r => !r.passed);
    rings.forEach(r => { r.m.material.emissiveIntensity = r === next ? 1.6 + Math.sin(G.t * 6) * 0.6 : r.passed ? 0 : 0.3; r.m.visible = !r.passed; });
    if (!next) return true;
    const rel = F.pos.clone().sub(next.p), side = rel.dot(next.n);
    if (next.prev !== null && Math.sign(side) !== Math.sign(next.prev) && rel.length() < next.r + 3) { next.passed = true; X.burst(next.p, 40, [1, 0.85, 0.3]); G.sfx && G.sfx('ring'); }
    next.prev = side;
    return false;
  }
  M.nextRing = () => { const r = rings.find(r => !r.passed); return r ? r.p : null; };

  // ---------- beacons ----------
  for (const b of W.beacons) if (saved.lit && saved.lit.includes(b.idx)) { b.lit = true; }
  function beaconsUpdate(dt) {
    for (const b of W.beacons) {
      if (b.lit) { X.flame(b.pos, b.idx === 0 ? 1.7 : 1.3, dt); if (!b.light) { b.light = new THREE.PointLight(0xff8a30, 0, 60, 1.6); b.light.position.copy(b.pos).y += 4; S.add(b.light); } b.light.intensity = 30 + Math.sin(G.t * 13 + b.idx) * 6; continue; }
      if (F.state.breath && (X.inFlame(b.pos, 7) || (G.dragon.mouthWorld && G.dragon.mouthWorld.distanceTo(b.pos) < 10))) { b.heat += dt; G.prompt("המשואה נדלקת… " + Math.min(100, Math.round(b.heat / 0.9 * 100)) + "%"); if (Math.random() < 0.3) X.burst(b.pos, 3); if (b.heat > 0.9) { b.lit = true; M.onLit && M.onLit(b); } }
      else b.heat = Math.max(0, b.heat - dt * 0.5);
    }
  }
  const lit = idx => W.beacons.find(b => b.idx === idx).lit;
  const beacon = idx => W.beacons.find(b => b.idx === idx);

  // ---------- lost campers ----------
  const campers = [];
  function makeKid(color = 0x3d6496) {
    const g = new THREE.Group(), skin = new THREE.MeshStandardMaterial({ color: 0xd29f7a }), shirt = new THREE.MeshStandardMaterial({ color }), pants = new THREE.MeshStandardMaterial({ color: 0x4d4a3a });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 8), shirt); body.position.y = 1.0; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin); head.position.y = 1.65; g.add(head);
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 5, 10), new THREE.MeshStandardMaterial({ color: 0xa8121b })); sc.rotation.x = Math.PI / 2; sc.position.y = 1.38; g.add(sc);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 3, 6), pants); leg.position.set(s * 0.13, 0.4, 0); g.add(leg); const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 3, 6), shirt); arm.position.set(s * 0.38, 1.25, 0); arm.rotation.z = s * 2.6; g.add(arm); g.userData['arm' + s] = arm; }
    g.scale.setScalar(1.6); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); S.add(g); return g;
  }
  function spawnCampers() {
    for (const [x, z, name] of [[-300, 120, 'רוני'], [260, 260, 'מיקה'], [-120, -330, 'עידו']]) { const h = W.heightAt(x, z); const k = makeKid(); k.position.set(x, h, z); campers.push({ k, name, home: false, onBack: false, pos: new THREE.Vector3(x, h, z) }); }
  }
  function campersUpdate(dt) {
    let carried = 0;
    campers.forEach((c, i) => {
      if (c.home) return;
      if (c.onBack) { carried++; const D = G.dragon; c.k.position.copy(D.root.position).add(new THREE.Vector3(0, 1.4, -0.6 - i * 0.9).applyQuaternion(D.root.quaternion)); c.k.quaternion.copy(D.root.quaternion); c.k.userData.arm1.rotation.z = 2.4 + Math.sin(G.t * 8) * 0.3; return; }
      // wave + smoke signal
      c.k.userData.arm1.rotation.z = 2.6 + Math.sin(G.t * 6 + i) * 0.5; c.k.userData['arm-1'].rotation.z = -2.6 - Math.sin(G.t * 6 + i) * 0.5;
      if (Math.random() < dt * 8) X.flame(c.pos.clone().add(V3(3, 0, 0)), 0.25, 0);
      if (Math.random() < dt * 3) G.fx.burst && 0;
      const d = F.pos.distanceTo(c.pos);
      if (d < 14 && F.speed < 30) { G.prompt('E – להרים את ' + c.name); if (input.ePressed) { c.onBack = true; M.say('kids', c.name + ': וואו! אתה אמיתי! תודה, דרקון!'); G.sfx && G.sfx('pickup'); } }
    });
    if (carried && F.pos.distanceTo(W.camp) < 45) { G.prompt('E – להוריד את החניכים במחנה'); if (input.ePressed) { campers.forEach(c => { if (c.onBack) { c.onBack = false; c.home = true; const a = Math.random() * 6.28; c.k.position.set(Math.cos(a) * 12, W.heightAt(0, 0) + 0.2, 18 + Math.sin(a) * 6); c.k.quaternion.identity(); } }); X.burst(W.camp, 40, [0.6, 0.8, 1]); G.sfx && G.sfx('cheer'); } }
    return campers.length && campers.every(c => c.home);
  }

  // ---------- Beit Dani's green dragon ----------
  let green = null, greenS = 0, raceRings = [], raceStart = 0;
  function makeGreen() {
    green = createDragon(G, { npc: true, cloth: '#2f8a3c', plate: 0x1d5e28, eye: 0xb8ff6a, hem: 'rgba(241,239,235,.9)', flagBg: '#2f8a3c', flagStripe: '#f1efeb', flagText: 'בית דני' });
    green.root.position.set(30, 60, 30);
  }
  const greenF = { turn: 0, climb: 0, speed: 30, boost: 0, brake: 0, flapRate: 0.8, dive: 0, breath: false };
  function greenFly(dt, path, speed) {
    // follow a list of points with Catmull-Rom
    const curve = path.curve, L = path.len;
    greenS = Math.min(1, greenS + speed * dt / L);
    const p = curve.getPointAt(greenS), ahead = curve.getPointAt(Math.min(1, greenS + 0.01));
    const prevQ = green.root.quaternion.clone();
    green.root.position.copy(p); const m = new THREE.Matrix4().lookAt(ahead, p, V3(0, 1, 0)); green.root.quaternion.setFromRotationMatrix(m);
    const dq = prevQ.angleTo(green.root.quaternion);
    greenF.turn = THREE.MathUtils.clamp(dq * 8, -1.2, 1.2) * (Math.random() < 0.5 ? 1 : 1); greenF.speed = speed; greenF.climb = (ahead.y - p.y) * 2;
    green.update(dt, greenF);
    return greenS >= 1;
  }

  // ---------- the storm ----------
  let storm = null;
  function makeStorm() {
    const g = new THREE.Group(); g.position.copy(W.camp).add(V3(0, 150, 0)); S.add(g);
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); const gr = x.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(30,30,40,1)'); gr.addColorStop(1, 'rgba(30,30,40,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.9 });
    const clouds = []; for (let i = 0; i < 120; i++) { const s = new THREE.Sprite(mat); const a = Math.random() * 6.28, r = 40 + Math.random() * 160; s.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 50, Math.sin(a) * r); const k = 40 + Math.random() * 60; s.scale.set(k, k * 0.7, 1); g.add(s); clouds.push({ s, a, r, y: s.position.y, sp: 0.1 + Math.random() * 0.2 }); }
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(12, 2), new THREE.MeshStandardMaterial({ color: 0x0c0c12, emissive: 0x2a1a5a, emissiveIntensity: 1.2, roughness: 0.3 })); g.add(eye);
    const crows = []; const crowMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 0.5, emissive: 0x200828, emissiveIntensity: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < 14; i++) { const c = new THREE.Group(); const body = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.5, 5), crowMat); body.rotation.x = Math.PI / 2; c.add(body); const wl = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.6), crowMat), wr = wl.clone(); wl.position.x = 2; wr.position.x = -2; c.add(wl, wr); c.userData = { wl, wr, a: i / 14 * 6.28, r: 60 + (i % 4) * 25, y: (i % 5) * 12 - 20, hp: 1, sp: 0.07 + Math.random() * 0.05 }; c.scale.setScalar(1.8); g.add(c); crows.push(c); }
    storm = { g, clouds, eye, crows, eyeHP: 1, strikeT: 3 };
  }
  function stormUpdate(dt) {
    const s = storm; if (!s) return;
    s.g.rotation.y += dt * 0.01;
    for (const c of s.clouds) { c.a += dt * c.sp; c.s.position.set(Math.cos(c.a) * c.r, c.y + Math.sin(G.t + c.a) * 4, Math.sin(c.a) * c.r); }
    s.eye.rotation.y += dt * 0.6; s.eye.scale.setScalar(0.6 + s.eyeHP * 0.4 + Math.sin(G.t * 3) * 0.04);
    const wp = new THREE.Vector3();
    for (const c of s.crows) { const u = c.userData; if (u.hp <= 0) { c.visible = false; continue; }
      u.a += dt * u.sp; const tx = Math.cos(u.a) * u.r, tz = Math.sin(u.a) * u.r; c.position.set(tx, u.y + Math.sin(G.t * 2 + u.a) * 6, tz); c.rotation.y = -u.a; const fl = Math.sin(G.t * 12 + u.a * 3) * 0.7; u.wl.rotation.z = fl; u.wr.rotation.z = -fl;
      c.getWorldPosition(wp); if (F.state.breath && (X.inFlame(wp, 8) || wp.distanceTo(G.dragon.mouthWorld) < 10)) { u.hp -= dt * 2.2; if (u.hp <= 0) { X.burst(wp, 60, [0.7, 0.4, 1]); G.sfx && G.sfx('poof'); } }
      // crows dive at the dragon when close
      if (wp.distanceTo(F.pos) < 10) { F.speed *= 0.97; G.flight.shake = 0.6; }
    }
    s.strikeT -= dt; if (s.strikeT <= 0) { s.strikeT = 2 + Math.random() * 3; const near = F.pos.clone().add(V3((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60)); near.y = W.heightAt(near.x, near.z); X.lightning(near, s.g.position.clone().add(V3((Math.random() - 0.5) * 100, -10, (Math.random() - 0.5) * 100))); G.sfx && G.sfx('thunder'); }
    const eyeW = s.eye.getWorldPosition(new THREE.Vector3());
    const crowsLeft = s.crows.filter(c => c.userData.hp > 0).length;
    if (!crowsLeft && F.state.breath && (X.inFlame(eyeW, 14) || eyeW.distanceTo(G.dragon.mouthWorld) < 20)) { s.eyeHP -= dt * 0.2; if (Math.random() < 0.4) X.burst(eyeW, 6, [0.8, 0.5, 1]); }
    return { crowsLeft, eye: s.eyeHP, eyeW };
  }

  // ---------- the script ----------
  let stepT = 0, flags = {};
  const go = n => { M.step = n; stepT = 0; flags = {}; startedStep = -1; G.save && G.save(); };
  let startedStep = -1;
  M.onLit = (b) => { M.addFire(b); };
  const STEPS = [
    // 0: intro (cinematic)
    { start() { G.cine = true; G.sky.set('dawn'); M.objective(''); }, update(dt) {
        const t = stepT, cam = G.camera, c = W.camp;
        cam.position.set(c.x + Math.sin(t * 0.15) * 60, c.y + 28 - t * 0.8, c.z + Math.cos(t * 0.15) * 60); cam.lookAt(0, 32, 0);
        if (t > 1 && !flags.a) { flags.a = 1; M.card('שבט הנשיא מציג', 'הדרקון של הנשיא'); }
        if (t > 3.5 && !flags.b) { flags.b = 1; X.lightning(V3(0, 34, 0)); G.sfx && G.sfx('thunder'); }
        if (t > 4.5 && !flags.c) { flags.c = 1; M.say('yoav', 'נוי! נוי! המתקן... הדרקון שבנינו – הוא זז!'); M.say('noy', 'מה? זה לא יכול להיות... תסתכלו לו בעיניים!'); }
        if (t > 10.5) { G.cine = false; go(1); }
      } },
    // 1: flight school
    { start() { M.card('פרק 1', 'ההתעוררות'); clearRings(); const pts = [[0, 48, 60], [60, 55, 100], [130, 62, 80], [170, 70, 0], [130, 75, -90], [40, 70, -130], [-60, 60, -90], [-90, 50, 0]]; pts.forEach((p, i) => { const n = pts[(i + 1) % pts.length]; ring(V3(...p), Math.atan2(n[0] - p[0], n[2] - p[2])); });
        M.say('noy', 'לא יאומן. אתה חי! אני נוי, רכזת המחנה. בוא נראה אם אתה יודע לעוף.'); M.say('noy', 'עקוב עם העכבר לאן שאתה רוצה לטוס. W – לנפנף בכנפיים, Shift – לזנק קדימה.'); M.objective('עוף דרך הטבעות הזוהרות', () => M.nextRing()); },
      update() { if (ringsUpdate()) { clearRings(); M.say('noy', 'מדהים! אתה טס כמו נשר. עכשיו – משהו חשוב.'); go(2); } } },
    // 2: light the camp fire
    { start() { M.say('noy', 'הלילה הגיעה הסערה השחורה וכיבתה את כל שמונה המדורות של המחנה. בלי האש – המחנה נגמר.'); M.say('noy', 'אתה דרקון. אתה יודע לירוק אש! טוס למדורה, הסתכל עליה ולחץ על העכבר.'); M.objective('הדלק את מדורת המחנה (לחיצה על העכבר = אש)', () => beacon(0).pos); },
      update() { if (lit(0)) { M.say('kids', 'יששש! האש חזרה!'); M.say('noy', 'מדורה ראשונה דולקת! אבל רגע... שלושה חניכים יצאו בלילה לחפש עצים ולא חזרו.'); go(3); } } },
    // 3: lost campers
    { start() { spawnCampers(); M.say('noy', 'חפש עמודי עשן – הם מסמנים איפה הם. טוס נמוך ולאט, ולחץ E כדי להרים אותם על הגב.'); M.objective('הצל את 3 החניכים והחזר אותם למחנה', () => { const c = campers.find(c => !c.home && !c.onBack); return c ? c.pos.clone().add(V3(0, 4, 0)) : W.camp; }); },
      update(dt) { if (campersUpdate(dt)) { M.say('noy', 'כולם בבית! אתה גיבור. אבל הסערה לקחה את האש של המחנה למקומות רחוקים...'); M.say('noy', 'ראיתי עשן על הטיל הישן במדבר – המתקן מ־1986. שם מחכה המדורה השנייה.'); go(4); } } },
    // 4: chapter 2 – rocket
    { start() { M.card('פרק 2', 'אש בכל הארץ'); G.sky.set('day'); M.objective('הדלק את המשואה בראש הטיל', () => beacon(1).pos); },
      update() { if (lit(1)) { go(5); } } },
    // 5: race vs Beit Dani
    { start() { if (!green) makeGreen(); greenS = 0; green.root.position.copy(F.pos).add(V3(30, 5, 20)); M.say('dani', 'היי, אדום! גם אצלנו בבית דני כבו המדורות. אני גלעד – הדרקון של בית דני.'); M.say('dani', 'בוא נראה מי מהיר יותר! מרוץ דרך הקניונים עד שער האריה. מי שמגיע ראשון – מדליק!'); M.say('noy', 'אל תיתן לו לנצח! עבור בכל הטבעות!');
        clearRings(); const pts = [[560, 70, 340], [620, 55, 220], [700, 45, 120], [760, 50, 0], [820, 55, -120], [800, 60, -240], [770, 75, -340]]; pts.forEach((p, i) => { const h = W.heightAt(p[0], p[2]); p[1] = Math.max(p[1], h + 18); const n = pts[Math.min(pts.length - 1, i + 1)], pr = pts[Math.max(0, i - 1)]; ring(V3(...p), Math.atan2((n[0] - pr[0]), (n[2] - pr[2])), 11); });
        const path = [F.pos.clone(), ...pts.map(p => V3(p[0], p[1], p[2])), beacon(5).pos.clone().add(V3(0, 6, 0))]; const curve = new THREE.CatmullRomCurve3(path); raceRings = { curve, len: curve.getLength() }; greenS = 0; raceStart = G.t;
        M.objective('מרוץ! עבור בכל הטבעות לפני גלעד', () => M.nextRing() || beacon(5).pos); },
      update(dt) {
        const done = ringsUpdate(); const myProg = rings.filter(r => r.passed).length / rings.length;
        const rubber = myProg > greenS ? 1.1 : 0.85; const gDone = greenFly(dt, raceRings, (26 + Math.min(14, (G.t - raceStart) * 0.6)) * rubber);
        if (done && !flags.win && !gDone) { flags.win = 1; clearRings(); M.say('dani', 'וואו... ניצחת אותי ביושר. קבל – המדורה שלך.'); M.say('dani', 'מהיום – בית דני והנשיא נלחמים ביחד בסערה!'); M.objective('הדלק את המשואה על שער האריה', () => beacon(5).pos); }
        if (gDone && !flags.win && !flags.lost) { flags.lost = 1; M.say('dani', 'הגעתי ראשון! חחח. רוצה עוד סיבוב?'); M.say('noy', 'נסה שוב – תשתמש ב־Shift בישורות!'); setTimeout(() => go(5), 3500); }
        if (flags.win && lit(5)) go(6);
      } },
    // 6: Big Ben
    { start() { M.say('noy', M.fires + ' מדורות דולקות! עכשיו ביג בן – המגדל של 1991, בגבעות היער במערב.'); M.objective('הדלק את המשואה על ביג בן', () => beacon(2).pos); },
      update(dt) { if (green) greenFly(dt * 0.0, raceRings, 0); if (lit(2)) go(7); } },
    // 7: chapter 3 – pagoda + ship
    { start() { M.card('פרק 3', 'הסערה'); G.sky.set('sunset'); M.say('storm', 'דרקון של עצים וחבלים... אתה לא תציל אותם.', 4.5); M.say('noy', 'הסערה מתקרבת! נשארו הפגודה ליד ההרים וסנטה מריה בים. מהר!'); M.objective('הדלק את הפגודה ואת סנטה מריה', () => !lit(3) ? beacon(3).pos : beacon(4).pos); },
      update() { if (lit(3) && lit(4)) go(8); } },
    // 8: the storm
    { start() { G.sky.set('storm'); makeStorm(); M.say('noy', 'היא כאן! מעל המחנה! תשרוף את עורבי הצל – ואז תירק אש לתוך העין שלה!'); if (green) M.say('dani', 'אני איתך, אדום!'); M.objective('שרוף את עורבי הצל', () => { const c = storm.crows.find(c => c.userData.hp > 0); return c ? c.getWorldPosition(new THREE.Vector3()) : storm.eye.getWorldPosition(new THREE.Vector3()); }); },
      update(dt) { const r = stormUpdate(dt); if (green) { green.root.position.copy(storm.g.position).add(V3(Math.cos(G.t * 0.4) * 90, -20, Math.sin(G.t * 0.4) * 90)); green.root.lookAt(storm.g.position); greenF.turn = 0.6; green.update(dt, greenF); }
        if (r.crowsLeft > 0 && r.crowsLeft !== flags.left) { flags.left = r.crowsLeft; $('objText').textContent = 'שרוף את עורבי הצל (' + r.crowsLeft + ' נשארו)'; }
        if (r.crowsLeft === 0 && !flags.eye) { flags.eye = 1; M.say('noy', 'כל העורבים נשרפו! עכשיו העין – תן לה את כל האש שלך!'); M.objective('ירוק אש לתוך עין הסערה', () => r.eyeW); }
        if (r.eye <= 0 && !flags.done) { flags.done = 1; X.burst(r.eyeW, 200, [1, 0.9, 0.5]); G.flash = 1.5; S.remove(storm.g); storm = null; M.addFire({ pos: r.eyeW }); G.sky.set('sunset'); M.say('storm', 'לא... האש... שלכם...', 3); go(9); } } },
    // 9: return to the cradle – the 8th fire
    { start() { M.say('kids', 'הסערה נעלמה! הדרקון ניצח!'); M.say('noy', 'נשארה מדורה אחת – המדורה השמינית. היא בתוך הלב שלך, דרקון. חזור הביתה, לעריסה שבנינו לך.'); M.objective('חזור לעריסה במחנה', () => V3(0, 36, 0)); },
      update() { if (F.pos.distanceTo(V3(0, 36, 0)) < 22) { M.addFire({ pos: V3(0, 36, 0) }); go(10); } } },
    // 10: ending
    { start() { G.cine = true; M.objective(''); M.say('noy', 'שמונה מדורות דולקות. המחנה ניצל.'); M.say('yoav', 'הוא... הוא חוזר להיות מתקן. העיניים נכבות.'); M.say('noy', 'אף אחד לא יאמין לנו. אבל אנחנו נדע.'); M.say('kids', 'מה שבונים ביחד – חי.', 5); },
      update(dt) { const cam = G.camera; cam.position.lerp(V3(40, 50, 60), 1 - Math.exp(-0.5 * dt)); cam.lookAt(0, 34, 0); G.dragon.root.position.lerp(V3(0, 36, 0), 1 - Math.exp(-1.5 * dt)); F.pos.copy(G.dragon.root.position); F.speed = 2.6;
        if (stepT > 17 && !flags.end) { flags.end = 1; G.onEnd && G.onEnd(); } } },
  ];
  M.update = (dt) => {
    if (!G.free) { const s = STEPS[M.step]; if (startedStep !== M.step) { startedStep = M.step; stepT = 0; s.start && s.start(); } stepT += dt; M.stepT = stepT; s.update && s.update(dt); }
    beaconsUpdate(dt); radio(dt); marker();
  };
  if (G.free) { M.objective(''); M.say('noy', 'טיסה חופשית. העולם כולו שלך – נסה להדליק את כל המשואות!'); }
  M.go = n => go(n);
  M._camperTarget = () => { const c = campers.find(c => !c.home && !c.onBack); return c ? c.pos.clone().add(V3(0, 3, 0)) : W.camp.clone(); };
  M._stormTarget = () => { if (!storm) return null; const c = storm.crows.find(c => c.userData.hp > 0); return (c || storm.eye).getWorldPosition(new THREE.Vector3()); };
  M.state = () => ({ fires: M.fires, step: M.step, lit: W.beacons.filter(b => b.lit).map(b => b.idx) });
  G.missions = M; return M;
}
