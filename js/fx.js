// Fire breath + beacon flames (additive particles), smoke, wind streaks, lightning; sky dome + sun/fog by chapter.
import * as THREE from 'three';

function spriteTex(soft) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(soft ? 0.3 : 0.15, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }

function particles(G, n, additive, tex) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { map: { value: tex } },
    vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vC; void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = size * 700. / -mv.z; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); if (gl_FragColor.a < 0.003) discard; }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; G.scene.add(pts);
  const P = []; for (let i = 0; i < n; i++) P.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 2, c0: [1, 1, 1, 1], c1: [1, 1, 1, 0], drag: 1, up: 0 });
  let head = 0;
  return {
    emit(o) { const p = P[head]; head = (head + 1) % n; Object.assign(p, { life: 0, drag: 1, up: 0 }, o); return p; },
    update(dt) {
      for (let i = 0; i < n; i++) { const p = P[i]; if (p.life >= p.max) { size[i] = 0; continue; } p.life += dt; const k = p.life / p.max, d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy = p.vy * d + p.up * dt; p.vz *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; size[i] = p.s0 + (p.s1 - p.s0) * k;
        for (let c = 0; c < 4; c++) col[i * 4 + c] = p.c0[c] + (p.c1[c] - p.c0[c]) * k; }
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.size.needsUpdate = true;
    }, list: P,
  };
}

export function createFx(G) {
  const S = G.scene, soft = spriteTex(true), hard = spriteTex(false);
  const fire = particles(G, 2400, true, soft), smoke = particles(G, 900, false, soft), sparks = particles(G, 600, true, hard);
  const X = {};
  const tmp = new THREE.Vector3();
  // breath: a cone of flame from the mouth, inheriting the dragon's speed
  X.breath = (dt) => {
    const D = G.dragon, F = G.flight, m = D.mouthWorld, f = D.headFwd;
    for (let k = 0; k < Math.ceil(dt * 300); k++) {
      const sp = 34 + Math.random() * 14, spread = 0.24;
      const vx = f.x + (Math.random() - 0.5) * spread, vy = f.y + (Math.random() - 0.5) * spread, vz = f.z + (Math.random() - 0.5) * spread;
      fire.emit({ x: m.x, y: m.y, z: m.z, vx: vx * sp + F.vel.x, vy: vy * sp + F.vel.y, vz: vz * sp + F.vel.z, max: 0.55 + Math.random() * 0.25, s0: 0.8, s1: 7 + Math.random() * 3, drag: 2.4, up: 4,
        c0: [1, 0.62, 0.18, 0.42], c1: [0.75, 0.1, 0.02, 0] });
      if (Math.random() < 0.15) sparks.emit({ x: m.x, y: m.y, z: m.z, vx: vx * sp * 1.2 + F.vel.x + (Math.random() - 0.5) * 8, vy: vy * sp + F.vel.y + Math.random() * 6, vz: vz * sp * 1.2 + F.vel.z + (Math.random() - 0.5) * 8, max: 0.9, s0: 0.25, s1: 0.1, drag: 1, up: -6, c0: [1, 0.8, 0.3, 1], c1: [1, 0.3, 0, 0] });
      if (Math.random() < 0.25) smoke.emit({ x: m.x + vx * 12, y: m.y + vy * 12, z: m.z + vz * 12, vx: vx * sp * 0.5 + F.vel.x * 0.5, vy: 3, vz: vz * sp * 0.5 + F.vel.z * 0.5, max: 2.2, s0: 3, s1: 9, drag: 1.5, up: 2, c0: [0.25, 0.22, 0.2, 0.35], c1: [0.4, 0.38, 0.36, 0] });
    }
  };
  // where does the breath reach? returns true if point p is inside the flame cone
  X.inFlame = (p, r = 4) => { const D = G.dragon, m = D.mouthWorld, f = D.headFwd; tmp.subVectors(p, m); const along = tmp.dot(f); if (along < 0 || along > 34) return false; const off = tmp.addScaledVector(f, -along).length(); return off < r + along * 0.18; };
  // beacon flame (lit braziers) + a camp-fire style point light pool
  X.flame = (p, scale = 1, dt) => {
    for (let k = 0; k < Math.ceil(dt * 90 * scale); k++) fire.emit({ x: p.x + (Math.random() - 0.5) * 2.4 * scale, y: p.y + 0.5, z: p.z + (Math.random() - 0.5) * 2.4 * scale, vx: (Math.random() - 0.5) * 1.5, vy: 6 + Math.random() * 5 * scale, vz: (Math.random() - 0.5) * 1.5, max: 0.9 + Math.random() * 0.5, s0: 2.6 * scale, s1: 0.6, drag: 0.6, up: 2, c0: [1, 0.85, 0.4, 0.85], c1: [1, 0.2, 0.02, 0] });
    if (Math.random() < dt * 14 * Math.min(1, scale)) smoke.emit({ x: p.x, y: p.y + 6 * scale, z: p.z, vx: (Math.random() - 0.5) * 2, vy: 5 * Math.min(1, scale + 0.3), vz: (Math.random() - 0.5) * 2, max: 4, s0: 4 * Math.min(1, scale), s1: 14 * Math.min(1, scale), drag: 0.4, up: 0.5, c0: [0.3, 0.28, 0.26, 0.3], c1: [0.5, 0.5, 0.5, 0] });
  };
  X.burst = (p, n = 60, col = [1, 0.7, 0.2]) => { for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, b = Math.random() * 3.14, s = 10 + Math.random() * 20; sparks.emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * Math.sin(b) * s, vy: Math.cos(b) * s + 6, vz: Math.sin(a) * Math.sin(b) * s, max: 1.4, s0: 0.5, s1: 0.1, drag: 1.2, up: -9, c0: [...col, 1], c1: [col[0], col[1] * 0.4, 0, 0] }); } };
  X.splash = (p, v) => { for (let k = 0; k < 6; k++) smoke.emit({ x: p.x + (Math.random() - 0.5) * 4, y: 0.5, z: p.z + (Math.random() - 0.5) * 4, vx: v.x * 0.3 + (Math.random() - 0.5) * 4, vy: 4 + Math.random() * 6, vz: v.z * 0.3 + (Math.random() - 0.5) * 4, max: 1.1, s0: 1.2, s1: 4, drag: 1.5, up: -6, c0: [0.95, 0.98, 1, 0.7], c1: [0.9, 0.95, 1, 0] }); };
  // wind streaks at speed
  X.streaks = (dt) => { const F = G.flight; if (F.speed < 34) return; const c = G.camera.position; for (let k = 0; k < Math.ceil(dt * (F.speed - 30) * 3); k++) { const a = Math.random() * 6.28, r = 6 + Math.random() * 10; tmp.set(Math.cos(a) * r, Math.sin(a) * r, -30).applyQuaternion(G.camera.quaternion).add(c); smoke.emit({ x: tmp.x, y: tmp.y, z: tmp.z, vx: -F.vel.x * 0.6, vy: -F.vel.y * 0.6, vz: -F.vel.z * 0.6, max: 0.35, s0: 0.15, s1: 0.15, drag: 0, c0: [1, 1, 1, 0.5], c1: [1, 1, 1, 0] }); } };
  // lightning bolt: a jagged line flashed for a moment + white flash
  const boltMat = new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0 });
  const bolt = new THREE.Line(new THREE.BufferGeometry(), boltMat); bolt.frustumCulled = false; S.add(bolt);
  let boltT = 0;
  X.lightning = (to, from) => { const pts = []; const a = from || to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 80, 260, (Math.random() - 0.5) * 80)); for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(a.clone().lerp(to, t).add(new THREE.Vector3((Math.random() - 0.5) * 18 * (1 - Math.abs(t - 0.5) * 1.5), 0, (Math.random() - 0.5) * 18 * (1 - Math.abs(t - 0.5) * 1.5)))); } bolt.geometry.setFromPoints(pts); boltT = 0.35; G.flash = 1; };
  X.update = (dt) => {
    fire.update(dt); smoke.update(dt); sparks.update(dt);
    boltT = Math.max(0, boltT - dt); boltMat.opacity = boltT > 0 ? (Math.random() < 0.7 ? 1 : 0.2) : 0;
  };
  G.fx = X; return X;
}

// ---------- sky + light ----------
export function createSky(G) {
  const S = G.scene;
  const u = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0.3, 0.2, -1).normalize() }, uSunC: { value: new THREE.Color() }, uStorm: { value: 0 } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: u,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 uTop,uHor,uSunC,uSun; uniform float uStorm; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y; vec3 col = mix(uHor, uTop, pow(max(h,0.), 0.5)); if (h < 0.) col = uHor * 0.8;
        float s = max(dot(d, normalize(uSun)), 0.); col += uSunC * (pow(s, 900.)*6. + pow(s, 12.)*0.35 + pow(s, 3.)*0.1) * (1.-uStorm);
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` }));
  dome.frustumCulled = false; dome.renderOrder = -10; S.add(dome);
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x7a6040, 1); S.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 400 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  S.add(sun); S.add(sun.target);
  S.fog = new THREE.Fog(0xcfe0ea, 300, 2600);
  const PRESETS = {
    dawn: { top: '#3a5f98', hor: '#f4b98a', sun: '#ffc88a', el: 0.12, az: 2.2, si: 2.4, hi: 0.8, fog: '#e8c6a8', near: 300, far: 2600 },
    day: { top: '#3f7fd0', hor: '#c8def0', sun: '#fff4e2', el: 0.75, az: 1.0, si: 3.2, hi: 1.0, fog: '#cfe0ea', near: 400, far: 2900 },
    sunset: { top: '#2c3f78', hor: '#ff9a62', sun: '#ff8a4a', el: 0.08, az: -0.6, si: 2.2, hi: 0.7, fog: '#e8a07a', near: 300, far: 2400 },
    winter: { top: '#7f9cbc', hor: '#e2e8ef', sun: '#fff3e4', el: 0.3, az: 1.4, si: 2.0, hi: 1.15, fog: '#dfe5ec', near: 220, far: 1700 },
    winterNight: { top: '#0c1426', hor: '#3a4a66', sun: '#a8b8ff', el: 0.5, az: 0.6, si: 0.5, hi: 0.55, fog: '#28344a', near: 150, far: 1300 },
    blizzard: { top: '#4a5666', hor: '#a3adb9', sun: '#d6dee8', el: 0.4, az: 1.0, si: 0.9, hi: 0.85, fog: '#aab4c0', near: 60, far: 650 },
    storm: { top: '#151820', hor: '#3a3c44', sun: '#8890a0', el: 0.6, az: 1.0, si: 0.6, hi: 0.45, fog: '#2a2c33', near: 80, far: 900 },
  };
  const cur = {}, C = h => new THREE.Color(h);
  for (const k in PRESETS.dawn) cur[k] = typeof PRESETS.dawn[k] === 'string' ? C(PRESETS.dawn[k]) : PRESETS.dawn[k];
  let target = PRESETS.dawn;
  const K = { set(name) { target = PRESETS[name]; K.name = name; }, name: 'dawn' };
  const dir = new THREE.Vector3();
  K.update = (dt) => {
    const k = 1 - Math.exp(-0.6 * dt);
    for (const key in target) { const tv = target[key]; if (typeof tv === 'string') cur[key].lerp(C(tv), k); else cur[key] += (tv - cur[key]) * k; }
    dir.set(Math.cos(cur.el) * Math.sin(cur.az), Math.sin(cur.el), Math.cos(cur.el) * Math.cos(cur.az)).normalize();
    u.uTop.value.copy(cur.top); u.uHor.value.copy(cur.hor); u.uSun.value.copy(dir); u.uSunC.value.copy(cur.sun); u.uStorm.value = K.name === 'storm' ? 1 : 0;
    const flash = G.flash || 0; G.flash = Math.max(0, flash - dt * 3);
    hemi.intensity = cur.hi + flash * 2; hemi.color.copy(cur.hor).lerp(C('#ffffff'), 0.5);
    sun.color.copy(cur.sun); sun.intensity = cur.si + flash * 4;
    S.fog.color.copy(cur.fog).lerp(C('#dfe8ff'), flash * 0.6); S.fog.near = cur.near; S.fog.far = cur.far;
    const p = G.flight ? G.flight.pos : new THREE.Vector3();
    sun.target.position.copy(p); sun.position.copy(p).addScaledVector(dir, 200);
    dome.position.copy(G.camera.position);
    if (G.world && G.world.seaU) { G.world.seaU.uSun.value.copy(dir); G.world.seaU.uSky.value.copy(cur.hor); }
    if (G.world && G.world.cloudMat) G.world.cloudMat.color.copy(C('#ffffff')).lerp(cur.hor, 0.35).multiplyScalar(K.name === 'storm' ? 0.4 : 1);
  };
  G.sky = K; return K;
}
