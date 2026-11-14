// Chapter 4 – "החורף": snow over the world, Beit Dani's giant Hanukkiyon (lashed poles, green/white),
// Gilad frozen in ice, 8 oil jugs locked in ice around the world, the shamash + 8 candles lit in order,
// and "הכפור" – an ice dragon that blows candles out – as the boss. Steps 11–16 of the mission script.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createDragon } from './dragon.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const $ = id => document.getElementById(id);

export function createWinter(G, M, saved = {}) {
  const S = G.scene, W = G.world, F = G.flight, X = G.fx;
  const HX = 0, HZ = -118, H = W.heightAt(HX, HZ);
  const WS = { jugs: saved.jugs || [], candles: saved.candles || [], gilad: !!saved.gilad, on: false };
  let built = false, hk = null, gilad = null, giladIce = null, jugs = [], candles = [], frost = null, snow = null, light = null;
  const mouth = () => G.dragon.mouthWorld || F.pos;
  const hits = (p, r, close) => F.state.breath && (X.inFlame(p, r) || mouth().distanceTo(p) < close);

  // ---------- materials ----------
  const woodM = new THREE.MeshStandardMaterial({ color: 0xa98250, roughness: 0.85 }), ropeM = new THREE.MeshStandardMaterial({ color: 0xcdb27e, roughness: 1 });
  const greenM = new THREE.MeshStandardMaterial({ color: 0x2f8a3c, roughness: 0.85, side: THREE.DoubleSide }), whiteM = new THREE.MeshStandardMaterial({ color: 0xf1efeb, roughness: 0.85, side: THREE.DoubleSide });
  const iceM = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55, emissive: 0x335577, emissiveIntensity: 0.25, depthWrite: false });

  function poles(list, mat = woodM) { const u = V3(0, 1, 0), v = new THREE.Vector3(), q = new THREE.Quaternion(); const gs = list.map(([a, b, r = 0.45]) => { const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), 7); v.subVectors(b, a).normalize(); q.setFromUnitVectors(u, v); g.applyQuaternion(q); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return g; }); const m = new THREE.Mesh(mergeGeometries(gs), mat); m.castShadow = m.receiveShadow = true; return m; }
  function lashes(pts) { const gs = pts.map(p => { const g = new THREE.TorusGeometry(0.75, 0.18, 4, 8); g.rotateX(Math.PI / 2); g.translate(p.x, p.y, p.z); return g; }); return new THREE.Mesh(mergeGeometries(gs), ropeM); }

  // ---------- the Hanukkiyon ----------
  function buildHanukkiyon() {
    const g = new THREE.Group(); g.position.set(HX, H, HZ); S.add(g);
    const P = [], L = [], beamY = 16, xs = [-45, -33, -21, -9, 9, 21, 33, 45];
    // trunk: tripod + central pole
    P.push([V3(0, 0, 0), V3(0, beamY, 0), 0.8]); for (const a of [0, 2.1, 4.2]) P.push([V3(Math.cos(a) * 9, 0, Math.sin(a) * 9), V3(0, beamY * 0.7, 0), 0.5]);
    // arms: each candle gets a V from the trunk base, like a menorah's branches
    for (const x of xs) { P.push([V3(x * 0.25, 4, 0), V3(x, beamY, 0), 0.45]); L.push(V3(x, beamY, 0)); }
    P.push([V3(-46, beamY, 0), V3(46, beamY, 0), 0.55]);
    // candle posts + shamash
    for (const x of xs) P.push([V3(x, beamY, 0), V3(x, beamY + 16, 0), 0.4]);
    P.push([V3(0, beamY, 0), V3(0, beamY + 27, 0), 0.5]); L.push(V3(0, beamY, 0), V3(0, beamY + 27, 0));
    // guy legs so it stands
    for (const sx of [-1, 1]) P.push([V3(sx * 46, beamY, 0), V3(sx * 38, 0, 10), 0.4], [V3(sx * 46, beamY, 0), V3(sx * 38, 0, -10), 0.4]);
    g.add(poles(P), lashes(L));
    // banner
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 160; const x = cv.getContext('2d');
    x.fillStyle = '#f1efeb'; x.fillRect(0, 0, 1024, 160); x.fillStyle = '#2f8a3c'; x.fillRect(0, 0, 1024, 16); x.fillRect(0, 144, 1024, 16);
    x.fillStyle = '#1d5e28'; x.font = 'bold 96px "Frank Ruhl Libre", serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillText('חנוכיון בית דני', 512, 84);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(40, 6.25), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide })); ban.position.set(0, beamY - 5, 1.2); g.add(ban);
    // pennants between the candle tops
    const pg = [];
    for (let i = 0; i < 18; i++) { const t0 = i / 18, t1 = (i + 1) / 18, xa = -45 + 90 * t0, xb = -45 + 90 * t1, sag = k => beamY + 13 - Math.sin(k * Math.PI * 4) * 0 - Math.abs(Math.sin(k * Math.PI * 8)) * 2.5; const a = V3(xa, sag(t0), 0.5), b = V3(xb, sag(t1), 0.5), c = V3((xa + xb) / 2, (a.y + b.y) / 2 - 2.6, 0.5); const geo = new THREE.BufferGeometry().setFromPoints([a, b, c]); geo.computeVertexNormals(); pg.push(new THREE.Mesh(geo, i % 2 ? whiteM : greenM)); }
    pg.forEach(m => g.add(m));
    // candles: white/green cloth sleeves, cups, an unlit wick
    const mk = (x, y, idx) => { const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 5, 10), idx % 2 ? greenM : whiteM); sleeve.position.set(x, y + 2.5, 0); g.add(sleeve); const cup = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.4, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.8 })); cup.position.set(x, y + 5.5, 0); g.add(cup);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.4, 4.4), iceM); cap.position.set(x, y + 6.2, 0); g.add(cap);
      return { idx, pos: V3(HX + x, H + y + 6.6, HZ), lit: false, heat: 0, cap, shamash: idx === -1 }; };
    candles = [mk(0, beamY + 27, -1), ...xs.map((x, i) => mk(x, beamY + 16, i))];      // [0] = shamash, then left → right
    light = new THREE.PointLight(0xffa040, 0, 140, 1.4); light.position.set(HX, H + beamY + 22, HZ + 8); S.add(light);
    hk = g;
  }

  // ---------- Gilad, frozen behind the Hanukkiyon (like the real installation's dragon) ----------
  function buildGilad() {
    gilad = createDragon(G, { npc: true, cloth: '#2f8a3c', plate: 0x1d5e28, eye: 0xb8ff6a, hem: 'rgba(241,239,235,.9)', flagBg: '#2f8a3c', flagStripe: '#f1efeb', flagText: 'בית דני' });
    gilad.root.position.set(HX + 30, H + 24, HZ - 14); gilad.root.rotation.y = -Math.PI / 2 - 0.3;
    giladIce = new THREE.Mesh(new THREE.IcosahedronGeometry(13, 1), iceM.clone()); giladIce.scale.set(1.5, 0.75, 1.1); giladIce.position.copy(gilad.root.position); S.add(giladIce); giladIce.userData.hp = 1;
  }
  const giladF = { turn: 0, climb: 0, speed: 0, boost: 0, brake: 0, flapRate: 0, dive: 0, breath: false };

  // ---------- oil jugs locked in ice ----------
  function jugSpots() {
    const out = W.landmarks.map(l => V3(l.pos.x, l.top + 14, l.pos.z));
    let best = null; for (let x = -420; x <= 220; x += 20) for (let z = -950; z <= -480; z += 20) { const h = W.heightAt(x, z); if (!best || h > best.y) best = V3(x, h, z); }
    out.push(best.add(V3(0, 12, 0)));                                               // the snowy peak
    out.push(V3(660, W.heightAt(660, 150) + 10, 150));                              // down in the canyons
    out.push(V3(-700, Math.max(W.heightAt(-700, -120), W.sea) + 14, -120));         // over the forest
    return out.slice(0, 8);
  }
  function buildJugs() {
    const prof = [[0, 0], [0.9, 0.05], [1.15, 0.6], [1.0, 1.2], [0.45, 1.55], [0.4, 1.95], [0.6, 2.05]].map(([r, y]) => new THREE.Vector2(r, y));
    const jm = new THREE.MeshStandardMaterial({ color: 0xc87a3c, roughness: 0.6, emissive: 0x6a3008, emissiveIntensity: 0.6 });
    jugSpots().forEach((p, i) => { const g = new THREE.Group(); g.position.copy(p); const j = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), jm); j.scale.setScalar(2.2); j.position.y = -2.2; g.add(j);
      const ice = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 9), iceM.clone()); ice.rotation.set(0.3, 0.6, 0.1); g.add(ice); S.add(g);
      const got = WS.jugs.includes(i); g.visible = !got; jugs.push({ i, g, ice, pos: p, hp: 1, free: false, got }); });
  }

  // ---------- snowfall around the camera ----------
  function buildSnow() {
    const n = 4000, pos = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 160;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d'); const gr = x.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    snow = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.9 })); snow.frustumCulled = false; S.add(snow); snow.userData.k = 1;
  }
  function snowUpdate(dt) {
    if (!snow) return; const a = snow.geometry.attributes.position, c = G.camera.position, wind = snow.userData.k > 1.5 ? 14 : 3;
    for (let i = 0; i < a.count; i++) { let x = a.array[i * 3], y = a.array[i * 3 + 1], z = a.array[i * 3 + 2];
      y -= dt * (4 + (i % 7)) * (snow.userData.k > 1.5 ? 2 : 1); x += dt * (wind + Math.sin(G.t + i) * 1.5); z += dt * Math.cos(G.t * 0.7 + i) * 1.5;
      if (y < c.y - 80) y += 160; if (y > c.y + 80) y -= 160; if (x < c.x - 80) x += 160; if (x > c.x + 80) x -= 160; if (z < c.z - 80) z += 160; if (z > c.z + 80) z -= 160;
      a.array[i * 3] = x; a.array[i * 3 + 1] = y; a.array[i * 3 + 2] = z; }
    a.needsUpdate = true; snow.material.size = snow.userData.k > 1.5 ? 1.3 : 0.9;
  }

  // ---------- HUD: candles instead of fires ----------
  function candleUI() { const lit = candles.filter(c => c.lit).length; $('fires').innerHTML = candles.map((c, i) => `<i class="cnd ${c.lit ? 'on' : ''} ${i === 0 ? 'sh' : ''}"></i>`).join('') + `<b>${lit}/9 נרות</b>`; }

  // ---------- setup (runs on any winter step, also after loading a save) ----------
  function ensure() {
    if (built) return; built = true; WS.on = true;
    W.setWinter(1); G.sky.set('winter');
    buildHanukkiyon(); buildGilad(); buildJugs(); buildSnow();
    if (WS.gilad) { S.remove(giladIce); giladIce = null; }
    for (const c of candles) if (WS.candles.includes(c.idx)) { c.lit = true; c.cap.visible = false; }
    candleUI();
  }

  function candlesUpdate(dt) {
    let lit = 0;
    for (const c of candles) { if (!c.lit) continue; lit++; X.flame(c.pos, 0.38, dt); }
    if (light) light.intensity = lit * 9 + (lit ? Math.sin(G.t * 11) * 3 : 0);
  }
  const nextCandle = () => candles.find(c => !c.lit);
  function lightingUpdate(dt) {
    const c = nextCandle(); if (!c) return true;
    // the right candle blinks; breath on the wrong one only sparks
    if (Math.random() < dt * 6) X.burst(c.pos, 2, [1, 0.9, 0.5]);
    for (const o of candles) if (!o.lit && o !== c && hits(o.pos, 2.5, 7) && Math.random() < dt * 4) { G.prompt(c.shamash ? 'קודם השמש – הנר העליון באמצע' : 'לא זה – מדליקים משמאל לימין'); }
    if (hits(c.pos, 2.5, 8)) { c.heat += dt; if (c.cap.visible) c.cap.scale.setScalar(Math.max(0.05, 1 - c.heat)); G.prompt((c.shamash ? 'מדליקים את השמש… ' : 'מדליקים נר… ') + Math.min(100, Math.round(c.heat / 0.8 * 100)) + '%');
      if (c.heat > 0.8) { c.lit = true; c.cap.visible = false; X.burst(c.pos, 50, [1, 0.8, 0.3]); G.sfx('ring'); WS.candles = candles.filter(o => o.lit).map(o => o.idx); candleUI(); G.save && G.save();
        const n = candles.filter(o => o.lit).length; if (n === 1) M.say('dani', 'השמש דולק! עכשיו משמאל לימין – הנר החדש ביותר קודם.'); else if (n === 5) M.say('noy', 'חצי חנוכיה! תמשיך!'); } }
    else c.heat = Math.max(0, c.heat - dt * 0.4);
    return false;
  }

  // ---------- הכפור – the ice dragon ----------
  function buildFrost() {
    const d = createDragon(G, { npc: true, cloth: '#cfeeff', plate: 0x6aa9d0, eye: 0x9ff3ff, hem: 'rgba(120,180,220,.9)', flagBg: '#cfeeff', flagStripe: '#6aa9d0', flagText: 'הכפור' });
    d.root.scale.setScalar(1.35);
    frost = { d, hp: 1, a: 0, shardT: 3, blowT: 7, shards: [], f: { turn: 0.4, climb: 0, speed: 24, boost: 0, brake: 0, flapRate: 0.8, dive: 0, breath: false }, dead: false };
    const bar = document.createElement('div'); bar.id = 'bossBar'; bar.innerHTML = '<small>הכפור</small><i><b></b></i>'; $('hud').appendChild(bar);
  }
  const shardM = new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: 0x88ccff, emissiveIntensity: 0.8, roughness: 0.2 });
  function frostUpdate(dt) {
    const f = frost; if (!f || f.dead) return;
    f.a += dt * 0.24; const R = 85 + Math.sin(f.a * 0.7) * 20;
    const p = V3(HX + Math.cos(f.a) * R, H + 48 + Math.sin(f.a * 1.9) * 14, HZ + Math.sin(f.a) * R), ahead = V3(HX + Math.cos(f.a + 0.05) * R, p.y, HZ + Math.sin(f.a + 0.05) * R);
    f.d.root.position.copy(p); f.d.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(ahead, p, V3(0, 1, 0)));
    f.f.breath = f.blowT < 0.9; f.d.update(dt, f.f);
    // frost breath at the Hanukkiyon: puts out the newest lit candle
    f.blowT -= dt; if (f.blowT <= 0) { f.blowT = 9 + Math.random() * 4; const lit = candles.filter(c => c.lit && !c.shamash); const c = lit[lit.length - 1];
      if (c) { c.lit = false; c.heat = 0; c.cap.visible = true; c.cap.scale.setScalar(1); X.burst(c.pos, 50, [0.7, 0.9, 1]); G.sfx('poof'); WS.candles = candles.filter(o => o.lit).map(o => o.idx); candleUI(); M.say('noy', 'הוא כיבה נר! תפגע בו – ואחר כך תדליק אותו מחדש!', 3); } }
    if (f.d.mouthWorld && f.blowT < 0.9) G.fx.burst(f.d.mouthWorld, 2, [0.75, 0.9, 1]);
    // ice shards at the player
    f.shardT -= dt; if (f.shardT <= 0 && p.distanceTo(F.pos) < 220) { f.shardT = 2.2 + Math.random() * 1.5; const m = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), shardM); m.position.copy(f.d.mouthWorld || p); const lead = F.pos.clone().addScaledVector(F.vel, 0.6); const v = lead.sub(m.position).normalize().multiplyScalar(55); S.add(m); f.shards.push({ m, v, t: 4 }); G.sfx('ring'); }
    for (let i = f.shards.length - 1; i >= 0; i--) { const s = f.shards[i]; s.t -= dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += dt * 8; s.m.rotation.y += dt * 6;
      const hit = s.m.position.distanceTo(F.pos) < 4.5, melt = F.state.breath && X.inFlame(s.m.position, 3);
      if (hit) { F.speed *= 0.35; F.shake = 1; G.flash = 0.6; G.sfx('poof'); X.burst(s.m.position, 30, [0.8, 0.95, 1]); }
      if (melt) X.burst(s.m.position, 10, [1, 0.7, 0.3]);
      if (hit || melt || s.t <= 0) { S.remove(s.m); f.shards.splice(i, 1); } }
    // our fire melts him
    if (hits(p, 8 * 1.35, 16)) { f.hp -= dt * 0.075; if (Math.random() < 0.5) X.burst(p, 4, [0.8, 0.95, 1]); }
    const b = document.querySelector('#bossBar b'); if (b) b.style.width = Math.max(0, f.hp * 100) + '%';
    if (f.hp <= 0) { f.dead = true; X.burst(p, 260, [0.85, 0.95, 1]); G.flash = 1.2; G.sfx('thunder'); S.remove(f.d.root); f.shards.forEach(s => S.remove(s.m)); f.shards = []; const bb = $('bossBar'); bb && bb.remove(); }
  }

  // ---------- update shared by all winter steps ----------
  WS.tick = (dt) => {
    if (!built) return; snowUpdate(dt); candlesUpdate(dt);
    if (gilad) { if (WS.gilad && WS.giladFly) { gilad.root.position.lerp(WS.giladFly, 1 - Math.exp(-0.8 * dt)); giladF.flapRate = 0.7; } gilad.update(dt, giladF); }
    for (const j of jugs) if (!j.got) { j.g.rotation.y += dt * 0.6; if (j.free) j.g.position.y = j.pos.y + Math.sin(G.t * 2 + j.i) * 0.8; }
  };
  WS.state = () => ({ jugs: WS.jugs, candles: WS.candles, gilad: WS.gilad });

  // ---------- the steps (11–16) ----------
  let fl = {};
  const steps = [
    // 11: intro – the world under snow, the frozen Hanukkiyon
    { start() { ensure(); fl = {}; G.cine = true; M.objective(''); G.sky.set('winter'); },
      update(dt) { const t = M.stepT, cam = G.camera;
        cam.position.set(HX + Math.sin(t * 0.12 + 0.4) * 90, H + 40 - t * 1.2, HZ + 70 + Math.cos(t * 0.12) * 30); cam.lookAt(HX, H + 26, HZ);
        G.dragon.root.position.set(0, 36.5, 0); F.pos.copy(G.dragon.root.position);
        if (t > 0.8 && !fl.a) { fl.a = 1; M.card('פרק 4', 'החורף'); }
        if (t > 4 && !fl.b) { fl.b = 1; M.say('noy', 'עברו חודשים. ירד שלג על כל הארץ – דבר שלא קרה אף פעם.'); M.say('yoav', 'וכל השבט מחכה להדלקה הגדולה בחנוכיון של בית דני... אבל הכל קפא.'); }
        if (t > 12 && !fl.c) { fl.c = 1; M.say('storm', 'הסערה מתה. אבל אני – הכפור – אני אחיה לנצח.', 4.5); }
        if (t > 17) { G.cine = false; F.place(V3(0, 40, 30), Math.PI); M.go(12); } } },
    // 12: free Gilad from the ice
    { start() { ensure(); M.say('noy', 'דרקון! התעוררת שוב! תראה – גלעד קפוא בתוך גוש קרח מאחורי החנוכיון!'); M.say('noy', 'תמיס את הקרח באש שלך. בזהירות – לא על החנוכיון.'); M.objective('הפשר את גלעד מהקרח', () => giladIce ? giladIce.position : null); },
      update(dt) { if (!giladIce) { M.go(13); return; }
        if (hits(giladIce.position, 12, 18)) { giladIce.userData.hp -= dt * 0.22; giladIce.scale.setScalar(Math.max(0.2, giladIce.userData.hp)); giladIce.scale.x *= 1.5; giladIce.scale.y *= 0.75; giladIce.scale.z *= 1.1; if (Math.random() < 0.4) X.burst(giladIce.position, 4, [0.8, 0.95, 1]); G.prompt('הקרח נמס… ' + Math.round((1 - giladIce.userData.hp) * 100) + '%'); }
        if (giladIce.userData.hp <= 0) { X.burst(giladIce.position, 140, [0.85, 0.95, 1]); G.sfx('ignite'); S.remove(giladIce); giladIce = null; WS.gilad = true; G.save && G.save();
          M.say('dani', 'ברררר! תודה, אדום! הכפור הקפיא את כל השמן של החנוכיון – שמונה כדים, ופיזר אותם בכל הארץ.'); M.say('dani', 'בלי שמן אין נס. תמצא אותם – כל כד קפוא בתוך קרח. תמיס ותיקח.'); M.go(13); } } },
    // 13: eight oil jugs
    { start() { ensure(); const left = () => jugs.filter(j => !j.got); M.objective('אסוף את 8 כדי השמן (' + jugs.filter(j => j.got).length + '/8)', () => { const l = left(); if (!l.length) return null; return l.reduce((a, b) => a.pos.distanceTo(F.pos) < b.pos.distanceTo(F.pos) ? a : b).pos; }); },
      update(dt) {
        for (const j of jugs) { if (j.got) continue;
          if (!j.free) { if (hits(j.pos, 5, 13)) { j.hp -= dt * 0.9; j.ice.scale.setScalar(Math.max(0.15, j.hp)); G.prompt('מפשירים את הכד… ' + Math.round((1 - j.hp) * 100) + '%'); if (Math.random() < 0.3) X.burst(j.pos, 3, [0.8, 0.95, 1]); if (j.hp <= 0) { j.free = true; j.ice.visible = false; X.burst(j.pos, 60, [0.85, 0.95, 1]); G.sfx('poof'); } } }
          else if (F.pos.distanceTo(j.pos) < 10) { j.got = true; j.g.visible = false; WS.jugs.push(j.i); X.burst(j.pos, 50, [1, 0.8, 0.3]); G.sfx('pickup'); const n = WS.jugs.length; $('objText').textContent = 'אסוף את 8 כדי השמן (' + n + '/8)'; G.save && G.save();
            if (n === 1) M.say('dani', 'יש! עוד שבעה.'); if (n === 4) M.say('noy', 'חצי מהשמן אצלך!'); if (n === 7) M.say('dani', 'נשאר אחד אחרון!'); } }
        if (jugs.every(j => j.got)) { M.say('dani', 'כל השמן אצלנו! תחזור לחנוכיון.'); M.go(14); } } },
    // 14: light the shamash, then 8 candles left → right
    { start() { ensure(); G.sky.set('winterNight'); M.say('noy', 'ירד הלילה. הלילה השמיני של חנוכה – מדליקים את כל הנרות!'); M.say('dani', 'קודם השמש – הנר הגבוה באמצע. אחר כך משמאל לימין: הנר החדש ביותר נדלק ראשון.');
        M.objective('הדלק את השמש ואת 8 הנרות לפי הסדר', () => { const c = nextCandle(); return c ? c.pos : null; }); },
      update(dt) { if (lightingUpdate(dt)) M.go(15); } },
    // 15: הכפור attacks – beat him, keep the candles burning
    { start() { ensure(); G.sky.set('blizzard'); if (snow) snow.userData.k = 2; if (!frost) buildFrost(); fl = {};
        M.say('storm', 'אור? בחורף שלי? אני אכבה הכל!', 3.5); M.say('noy', 'זה הכפור! תשרוף אותו באש, ותתחמק מרסיסי הקרח!'); M.say('dani', 'אני שומר על החנוכיון – אתה תרדוף אחריו!');
        M.objective('נצח את הכפור', () => frost && !frost.dead ? frost.d.root.position : nextCandle() ? nextCandle().pos : null);
        WS.giladFly = V3(HX - 20, H + 50, HZ + 25); },
      update(dt) { frostUpdate(dt);
        if (frost && frost.dead && !fl.won) { fl.won = 1; G.sky.set('winterNight'); if (snow) snow.userData.k = 1; M.say('storm', 'לא... האור... חם מדי...', 3); M.say('noy', 'הכפור נמס!');
          if (nextCandle()) { M.say('dani', 'עכשיו תדליק מחדש את הנרות שהוא כיבה.'); M.objective('הדלק מחדש את הנרות שכבו', () => { const c = nextCandle(); return c ? c.pos : null; }); } }
        if (fl.won && lightingUpdate(dt)) M.go(16); } },
    // 16: ending – a great miracle happened here
    { start() { ensure(); G.cine = true; M.objective(''); G.sky.set('winterNight'); fl = {}; WS.giladFly = V3(HX + 30, H + 24, HZ - 14);
        M.say('kids', 'החנוכיון דולק!!! תשעה נרות!'); M.say('dani', 'נס גדול היה פה. תודה, אדום. בית דני לא ישכח.'); M.say('noy', 'וכל השבט ראה את זה. דרקון אחד אדום ודרקון אחד ירוק – בונים ביחד.'); M.say('kids', 'מה שבונים ביחד – חי. גם בחורף.', 5); },
      update(dt) { const t = M.stepT, cam = G.camera; cam.position.set(HX + Math.sin(t * 0.1) * 75, H + 34, HZ + Math.cos(t * 0.1) * 75); cam.lookAt(HX, H + 26, HZ);
        G.dragon.root.position.lerp(V3(HX - 30, H + 24, HZ - 14), 1 - Math.exp(-1.2 * dt)); G.dragon.root.lookAt(V3(HX, H + 24, HZ + 30)); F.pos.copy(G.dragon.root.position); F.speed = 2.6; F.state.flapRate = 0.3; F.state.speed = 2;
        if (Math.random() < dt * 2.5) { const cols = [[1, 0.8, 0.2], [0.3, 0.9, 0.4], [1, 1, 1], [0.4, 0.7, 1]]; X.burst(V3(HX + (Math.random() - 0.5) * 120, H + 60 + Math.random() * 40, HZ + (Math.random() - 0.5) * 60), 80, cols[Math.floor(Math.random() * 4)]); if (Math.random() < 0.5) G.sfx('poof'); }
        if (t > 22 && !fl.end) { fl.end = 1; G.winterDone = true; G.onEnd && G.onEnd(); } } },
  ];
  G.winter = WS;
  return steps;
}
