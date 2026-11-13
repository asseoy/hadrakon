// The world: an island continent (camp meadow, desert canyons, snowy mountains, forest hills) in a sea,
// clouds to fly through, and giant pole-and-rope facilities from the tribe's history with fire bowls on top.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- noise ----
function makeNoise(seed) {
  const p = new Uint8Array(512); let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const a = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } for (let i = 0; i < 512; i++) p[i] = a[i & 255];
  const g = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]], F2 = 0.366025, G2 = 0.211325;
  const n2 = (x, y) => { const sk = (x + y) * F2, i = Math.floor(x + sk), j = Math.floor(y + sk), t = (i + j) * G2, x0 = x - i + t, y0 = y - j + t, i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const pts = [[x0, y0, 0, 0], [x0 - i1 + G2, y0 - j1 + G2, i1, j1], [x0 - 1 + 2 * G2, y0 - 1 + 2 * G2, 1, 1]]; let n = 0;
    for (const [px, py, oi, oj] of pts) { let tt = 0.5 - px * px - py * py; if (tt > 0) { const gg = g[p[(i + oi & 255) + p[j + oj & 255]] & 7]; tt *= tt; n += tt * tt * (gg[0] * px + gg[1] * py); } } return 70 * n; };
  const fbm = (x, y, o = 5) => { let a2 = 0, f = 1, w = 0.5, t = 0; for (let k = 0; k < o; k++) { a2 += n2(x * f, y * f) * w; t += w; f *= 2.03; w *= 0.5; } return a2 / t; };
  const ridge = (x, y, o = 4) => { let a2 = 0, f = 1, w = 0.5, t = 0; for (let k = 0; k < o; k++) { a2 += (1 - Math.abs(n2(x * f, y * f))) * w; t += w; f *= 2.1; w *= 0.5; } return a2 / t; };
  return { n2, fbm, ridge };
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export function createWorld(G) {
  const S = G.scene, N = makeNoise(1975), SIZE = 3000, SEA = 0;
  const W = { size: SIZE, sea: SEA, landmarks: [], beacons: [] };
  // region weights from angle around the camp: desert south-east, mountains north, forest west
  function regions(x, z) {
    const a = Math.atan2(z, x), r = Math.hypot(x, z);
    const desert = sm(0.0, 0.8, Math.cos(a - 0.6)) * sm(150, 380, r);
    const mount = sm(0.2, 0.9, Math.cos(a + 1.7)) * sm(250, 520, r);
    const forest = sm(0.1, 0.8, Math.cos(a - 3.0)) * sm(120, 300, r);
    return { desert, mount, forest, r };
  }
  W.heightAt = (x, z) => {
    const { desert, mount, forest, r } = regions(x, z);
    const coast = 1100 + N.fbm(x / 700, z / 700, 3) * 260;
    const land = sm(coast + 160, coast - 120, r);
    let h = 18 + N.fbm(x / 400, z / 400, 5) * 22;
    // camp meadow: flatten a plateau
    h = h * sm(60, 160, r) + 20 * (1 - sm(60, 160, r));
    // desert mesas and canyons
    if (desert > 0) { const cr = N.ridge(x / 260, z / 260, 4); const mesa = sm(0.55, 0.62, N.n2(x / 330 + 7, z / 330 - 3) * 0.5 + 0.5); h += desert * (cr * cr * 95 * (0.4 + mesa) - 15 + Math.round(mesa * 2) * 10); }
    if (mount > 0) { const rr = N.ridge(x / 300 + 40, z / 300 - 20, 5); h += mount * (Math.pow(rr, 2.2) * 290); }
    if (forest > 0) h += forest * N.fbm(x / 160, z / 160, 4) * 26;
    h = h * land + (SEA - 28 + N.fbm(x / 300, z / 300, 3) * 12) * (1 - land);
    // small islands in the sea
    const isl = N.n2(x / 220 + 100, z / 220 - 50); if (land < 0.5 && isl > 0.62) h = Math.max(h, (isl - 0.62) * 160 - 8);
    return h;
  };
  W.regions = regions;

  // ---- terrain mesh with vertex colours ----
  {
    const SEG = 360, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    const C = { grass: new THREE.Color('#78944a'), meadow: new THREE.Color('#8faa52'), forest: new THREE.Color('#4f6e34'), sand: new THREE.Color('#e1c48c'), red: new THREE.Color('#b45a34'), rock: new THREE.Color('#857766'), snow: new THREE.Color('#f2f4f6'), beach: new THREE.Color('#ead7a8'), seabed: new THREE.Color('#6e8a8a') };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = W.heightAt(x, z); pos.setY(i, h);
      const { desert, mount, forest, r } = regions(x, z);
      const e = 4, sl = Math.hypot(W.heightAt(x + e, z) - W.heightAt(x - e, z), W.heightAt(x, z + e) - W.heightAt(x, z - e)) / (2 * e);
      c.copy(r < 160 ? C.meadow : C.grass).lerp(C.forest, forest * 0.8);
      if (desert > 0) { c.lerp(C.sand, desert); if (desert > 0.3) c.lerp(C.red, clamp((sl - 0.35) * 2, 0, 1) * desert + (Math.floor(h / 9) % 2 ? 0.15 : 0) * desert); }
      c.lerp(C.rock, clamp((sl - 0.55) * 1.6, 0, 1));
      if (mount > 0.2 && h > 170 + N.n2(x / 50, z / 50) * 25) c.lerp(C.snow, clamp((h - 170) / 40, 0, 1));
      if (h < SEA + 3) c.lerp(C.beach, clamp((SEA + 3 - h) / 3, 0, 1)); if (h < SEA - 2) c.copy(C.seabed);
      c.offsetHSL(0, 0, N.n2(x / 18, z / 18) * 0.035);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const tex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 9000; i++) { const v = 100 + Math.random() * 70; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(220, 220); return t; })();
    const terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: tex }));
    terrain.receiveShadow = true; S.add(terrain);
  }

  // ---- sea ----
  const seaU = { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0.4, 0.5, 0.3) }, uSky: { value: new THREE.Color('#bfd8ea') } };
  Object.assign(seaU, THREE.UniformsUtils.clone(THREE.UniformsLib.fog));
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 2, SIZE * 2, 200, 200).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: seaU, fog: true, transparent: true,
    vertexShader: `uniform float uTime; varying vec3 vW; varying vec3 vN;
      #include <fog_pars_vertex>
      void main(){ vec3 p = position; float w1 = sin(p.x*0.02 + uTime*0.8)*0.6, w2 = cos(p.z*0.025 + uTime*0.6)*0.5; p.y += w1 + w2;
        vN = normalize(vec3(-cos(p.x*0.02+uTime*0.8)*0.012, 1.0, sin(p.z*0.025+uTime*0.6)*0.0125)); vec4 w = modelMatrix*vec4(p,1.); vW = w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uSun; uniform vec3 uSky; uniform float uTime; varying vec3 vW; varying vec3 vN;
      #include <fog_pars_fragment>
      void main(){ vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN + vec3(sin(vW.x*0.3+uTime*2.)*0.03, 0., cos(vW.z*0.35+uTime*1.7)*0.03));
        float fr = 0.04 + 0.96*pow(1.0 - max(dot(N,V),0.), 5.); vec3 deep = vec3(0.04,0.22,0.36), shal = vec3(0.1,0.5,0.6);
        vec3 col = mix(mix(deep, shal, 0.3), uSky, fr); col += vec3(1.,0.9,0.7) * pow(max(dot(reflect(-V,N), normalize(uSun)),0.), 200.) * 2.5;
        gl_FragColor = vec4(col, 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` }));
  sea.position.y = SEA; S.add(sea);
  W.seaU = seaU;

  // ---- trees (instanced) ----
  {
    const trunk = new THREE.CylinderGeometry(0.4, 0.6, 5, 6); trunk.translate(0, 2.5, 0);
    const crown = new THREE.IcosahedronGeometry(3.2, 0); crown.translate(0, 7, 0);
    const tm = new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 1 }), cm = new THREE.MeshStandardMaterial({ color: 0x4a6e2e, roughness: 1, flatShading: true });
    const pts = []; let tries = 0;
    while (pts.length < 4500 && tries++ < 80000) { const x = (Math.random() - 0.5) * SIZE * 0.85, z = (Math.random() - 0.5) * SIZE * 0.85, h = W.heightAt(x, z), rg = regions(x, z);
      if (h < SEA + 3 || rg.desert > 0.35 || h > 160 || rg.r < 90) continue; if (Math.random() > 0.25 + rg.forest * 0.75) continue; pts.push([x, h, z]); }
    const ti = new THREE.InstancedMesh(trunk, tm, pts.length), ci = new THREE.InstancedMesh(crown, cm, pts.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), col = new THREE.Color();
    pts.forEach(([x, h, z], i) => { const k = 0.7 + Math.random() * 0.8; q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)); m.compose(new THREE.Vector3(x, h - 0.5, z), q, s.set(k, k * (0.9 + Math.random() * 0.4), k)); ti.setMatrixAt(i, m); ci.setMatrixAt(i, m); ci.setColorAt(i, col.setHSL(0.24 + Math.random() * 0.06, 0.4, 0.28 + Math.random() * 0.12)); });
    ti.castShadow = ci.castShadow = true; ti.receiveShadow = ci.receiveShadow = true; S.add(ti, ci);
  }

  // ---- pole-and-rope building kit (merged geometry) ----
  const woodM = new THREE.MeshStandardMaterial({ color: 0xa98250, roughness: 0.85 }), ropeM = new THREE.MeshStandardMaterial({ color: 0xcdb27e, roughness: 1 }), redM = new THREE.MeshStandardMaterial({ color: 0xb3171f, roughness: 0.85, side: THREE.DoubleSide }), whiteM = new THREE.MeshStandardMaterial({ color: 0xf1efeb, roughness: 0.85, side: THREE.DoubleSide });
  function kit() {
    const poles = [], ropes = [], v = new THREE.Vector3(), u = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
    const K = {
      pole(a, b, r = 0.35) { const len = a.distanceTo(b), g = new THREE.CylinderGeometry(r, r, len, 6); v.subVectors(b, a).normalize(); q.setFromUnitVectors(u, v); g.applyQuaternion(q); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); poles.push(g); },
      lash(p, r = 0.6) { const g = new THREE.TorusGeometry(r, 0.16, 4, 8); g.rotateX(Math.PI / 2); g.translate(p.x, p.y, p.z); ropes.push(g); },
      build(parent) { const grp = new THREE.Group(); if (poles.length) { const m = new THREE.Mesh(mergeGeometries(poles), woodM); m.castShadow = m.receiveShadow = true; grp.add(m); } if (ropes.length) grp.add(new THREE.Mesh(mergeGeometries(ropes), ropeM)); (parent || S).add(grp); return grp; },
    };
    return K;
  }
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  // a square lattice tower section between heights
  function latticeTower(K, cx, cz, base, top, half0, half1, levels) {
    const C = (h, hw) => [[hw, hw], [-hw, hw], [-hw, -hw], [hw, -hw]].map(([x, z]) => V3(cx + x, h, cz + z));
    for (let l = 0; l < levels; l++) {
      const f0 = l / levels, f1 = (l + 1) / levels, h0 = base + (top - base) * f0, h1 = base + (top - base) * f1, a = C(h0, half0 + (half1 - half0) * f0), b = C(h1, half0 + (half1 - half0) * f1);
      for (let i = 0; i < 4; i++) { K.pole(a[i], b[i], 0.45); K.pole(b[i], b[(i + 1) % 4], 0.3); K.pole(a[i], b[(i + 1) % 4], 0.22); K.lash(b[i], 0.7); }
    }
  }
  function brazier(x, y, z, idx, name) {
    const g = new THREE.Group(); g.position.set(x, y, z); S.add(g);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2, 2, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9, side: THREE.DoubleSide })); bowl.position.y = 1; g.add(bowl);
    const logs = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.5, 7), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1, flatShading: true })); logs.position.y = 1.6; g.add(logs);
    const b = { pos: new THREE.Vector3(x, y + 2, z), lit: false, heat: 0, idx, name, group: g, light: null };
    W.beacons.push(b); return b;
  }

  // ---- the camp ----
  {
    const K = kit();
    // the dragon's cradle: two A-frames of poles with a ridge pole
    for (const z of [-8, 8]) { K.pole(V3(-7, 20, z), V3(0, 34, z), 0.5); K.pole(V3(7, 20, z), V3(0, 34, z), 0.5); K.lash(V3(0, 34, z), 0.8); }
    K.pole(V3(0, 34, -10), V3(0, 34, 10), 0.45);
    // flag poles around the parade ground
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 34, z = Math.sin(a) * 34; K.pole(V3(x, 20, z), V3(x, 34, z), 0.25); }
    K.build();
    // tents
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3, rr = 52 + (i % 2) * 10, x = Math.cos(a) * rr, z = Math.sin(a) * rr; const t = new THREE.Mesh(new THREE.ConeGeometry(4, 4.5, 4, 1, true), new THREE.MeshStandardMaterial({ color: i % 3 ? 0x5f6e3b : 0xb8582a, roughness: 0.9, side: THREE.DoubleSide })); t.position.set(x, W.heightAt(x, z) + 2.2, z); t.rotation.y = a; t.castShadow = true; S.add(t); }
    // flags
    W.flags = [];
    const flagTex = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const x = cv.getContext('2d'); x.fillStyle = '#f1efeb'; x.fillRect(0, 0, 256, 160); x.fillStyle = '#a8121b'; x.fillRect(0, 0, 256, 18); x.fillRect(0, 142, 256, 18); if (G.logo) { const s = 110, hh = s * G.logo.height / G.logo.width; x.drawImage(G.logo, 128 - s / 2, 80 - hh / 2, s, hh); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 34, z = Math.sin(a) * 34; const fg = new THREE.PlaneGeometry(4, 2.5, 10, 4); fg.translate(2, 0, 0); const f = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9 })); f.position.set(x, 32.8, z); f.rotation.y = -a; S.add(f); W.flags.push({ mesh: f, base: Float32Array.from(fg.attributes.position.array), ph: i }); }
    W.campFire = brazier(0, 20, 26, 0, 'מדורת המחנה'); W.campFire.group.scale.setScalar(1.6);
    W.camp = V3(0, 22, 0);
  }

  // ---- landmarks from the tribe's history ----
  function place(name, year, x, z, build) { const h = W.heightAt(x, z); const top = build(x, h, z); W.landmarks.push({ name, year, pos: V3(x, h, z), top }); return top; }
  // the rocket (1986): a round lattice + nose cone + fins, in the desert
  place('הטיל', 1986, 520, 420, (x, h, z) => { const K = kit(), R = 7, top = h + 70;
    for (let l = 0; l < 7; l++) { const y0 = h + l * 9, y1 = y0 + 9; for (let i = 0; i < 8; i++) { const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2; const p0 = V3(x + Math.cos(a0) * R, y0, z + Math.sin(a0) * R), p1 = V3(x + Math.cos(a0) * R, y1, z + Math.sin(a0) * R), p2 = V3(x + Math.cos(a1) * R, y1, z + Math.sin(a1) * R); K.pole(p0, p1, 0.4); K.pole(p1, p2, 0.3); K.pole(p0, p2, 0.2); K.lash(p1, 0.6); } }
    K.build();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(R + 0.5, 18, 8, 1, true), redM); cone.position.set(x, h + 63 + 9, z); cone.castShadow = true; S.add(cone);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2, fin = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([V3(0, 0, 0), V3(10, -6, 0), V3(0, 16, 0)]), whiteM); fin.geometry.setIndex([0, 1, 2]); fin.geometry.computeVertexNormals(); fin.position.set(x + Math.cos(a) * R, h + 6, z + Math.sin(a) * R); fin.rotation.y = -a; S.add(fin); }
    brazier(x, h + 81, z, 1, 'הטיל'); return h + 81; });
  // Big Ben (1991): square lattice tower with a clock face, on the forest hills
  place('ביג בן', 1991, -560, 260, (x, h, z) => { const K = kit(); latticeTower(K, x, z, h, h + 64, 9, 7, 8); latticeTower(K, x, z, h + 64, h + 82, 7, 1.5, 3); K.build();
    const clk = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'); g.fillStyle = '#f2ead8'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.strokeStyle = '#2a1a0a'; g.lineWidth = 10; g.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillStyle = '#2a1a0a'; g.fillRect(128 + Math.cos(a) * 100 - 5, 128 + Math.sin(a) * 100 - 5, 10, 10); } g.lineWidth = 8; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 50); g.moveTo(128, 128); g.lineTo(185, 128); g.stroke(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, c = new THREE.Mesh(new THREE.CircleGeometry(6, 24), new THREE.MeshStandardMaterial({ map: clk, roughness: 0.8 })); c.position.set(x + Math.sin(a) * 7.5, h + 56, z + Math.cos(a) * 7.5); c.rotation.y = a; S.add(c); }
    brazier(x, h + 84, z, 2, 'ביג בן'); return h + 84; });
  // the pagoda (1992): stacked tiers with red cloth roofs, at the foot of the mountains
  place('הפגודה', 1992, -180, -640, (x, h, z) => { const K = kit(); let y = h; for (let t = 0; t < 5; t++) { const hw = 14 - t * 2.3; latticeTower(K, x, z, y, y + 11, hw, hw, 1); const roof = new THREE.Mesh(new THREE.ConeGeometry(hw * 1.6, 5, 4, 1, true), redM); roof.position.set(x, y + 12.5, z); roof.rotation.y = Math.PI / 4; roof.castShadow = true; S.add(roof); y += 13; } K.build(); brazier(x, y + 1, z, 3, 'הפגודה'); return y + 1; });
  // the ship Santa Maria (1997): on the sea
  place('סנטה מריה', 1997, 120, 1230, (x, h, z) => { const K = kit(), y = Math.max(h, SEA) + 1;
    for (let i = 0; i <= 10; i++) { const zz = z - 20 + i * 4, w = 7 * Math.sin(Math.PI * (i / 10)) + 1; K.pole(V3(x - w, y, zz), V3(x - w * 1.2, y + 8, zz), 0.4); K.pole(V3(x + w, y, zz), V3(x + w * 1.2, y + 8, zz), 0.4); K.pole(V3(x - w, y, zz), V3(x + w, y, zz), 0.35); }
    K.pole(V3(x, y, z - 22), V3(x, y, z + 22), 0.5); for (const mz of [-8, 6]) K.pole(V3(x, y, z + mz), V3(x, y + 34, z + mz), 0.55); K.build();
    for (const [mz, hgt] of [[-8, 18], [6, 22]]) { const sail = new THREE.Mesh(new THREE.PlaneGeometry(16, hgt, 6, 6), whiteM); sail.position.set(x, y + 12 + hgt / 2, z + mz + 0.6); S.add(sail); const cross = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), redM); cross.position.set(x, y + 12 + hgt / 2, z + mz + 0.65); S.add(cross); }
    brazier(x, y + 36, z + 6, 4, 'סנטה מריה'); return y + 36; });
  // the lion gate (2009): two lattice towers + an arch with a lion head
  place('שער האריה', 2009, 760, -380, (x, h, z) => { const K = kit(); latticeTower(K, x - 22, z, h, h + 46, 6, 5, 5); latticeTower(K, x + 22, z, h, h + 46, 6, 5, 5); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI, b = (i + 1) / 6 * Math.PI; if (i < 6) K.pole(V3(x - Math.cos(a) * 22, h + 46 + Math.sin(a) * 14, z), V3(x - Math.cos(b) * 22, h + 46 + Math.sin(b) * 14, z), 0.6); } K.build();
    const lion = new THREE.Mesh(new THREE.IcosahedronGeometry(8, 1), new THREE.MeshStandardMaterial({ color: 0xd8a040, roughness: 0.6, flatShading: true })); lion.position.set(x, h + 60, z); lion.scale.set(1, 1.1, 0.8); lion.castShadow = true; S.add(lion);
    const mane = new THREE.Mesh(new THREE.TorusGeometry(9, 3, 6, 14), new THREE.MeshStandardMaterial({ color: 0x8a5a20, roughness: 1, flatShading: true })); mane.position.set(x, h + 60, z - 1); S.add(mane);
    brazier(x, h + 70, z, 5, 'שער האריה'); return h + 70; });

  // ---- clouds you can fly through ----
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.55, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.85, fog: true });
    W.cloudMat = mat;
    for (let c = 0; c < 46; c++) { const cx = (Math.random() - 0.5) * SIZE * 0.9, cz = (Math.random() - 0.5) * SIZE * 0.9, cy = 190 + Math.random() * 90; for (let k = 0; k < 9; k++) { const s = new THREE.Sprite(mat); s.position.set(cx + (Math.random() - 0.5) * 70, cy + (Math.random() - 0.5) * 16, cz + (Math.random() - 0.5) * 50); const sc = 30 + Math.random() * 40; s.scale.set(sc * 1.6, sc, 1); S.add(s); } }
  }
  W.update = (dt, t) => {
    seaU.uTime.value = t;
    for (const f of W.flags) { const pa = f.mesh.geometry.attributes.position, b = f.base; for (let i = 0; i < pa.count; i++) { const x = b[i * 3]; pa.array[i * 3 + 2] = Math.sin(x * 1.3 - t * 5 + f.ph) * 0.25 * (x / 4); } pa.needsUpdate = true; }
  };
  G.world = W; return W;
}
