// Arcade flight: the dragon steers toward where the camera looks. W flap, S brake/hover, Shift boost,
// Space climb, mouse fire. Energy trade: diving gains speed, climbing costs it. Chase camera with speed FOV.
import * as THREE from 'three';
import { input } from './input.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export function createFlight(G) {
  const F = { pos: new THREE.Vector3(0, 60, 0), vel: new THREE.Vector3(0, 0, 18), q: new THREE.Quaternion(), speed: 18, boostE: 1, bank: 0, pitchV: 0,
    camYaw: Math.PI, camPitch: -0.12, state: { turn: 0, climb: 0, speed: 18, boost: 0, brake: 0, flapRate: 0, dive: 0, breath: false }, landed: false, shake: 0 };
  const cam = G.camera, fwd = new THREE.Vector3(), aim = new THREE.Vector3(), tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), qTarget = new THREE.Quaternion();
  let lastYaw = 0, camPos = new THREE.Vector3(0, 70, -20);
  F.place = (p, yaw) => { F.pos.copy(p); F.vel.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(14); F.speed = 14; F.camYaw = yaw + Math.PI; F.q.setFromAxisAngle(up, yaw); lastYaw = yaw; camPos.copy(p).add(new THREE.Vector3(-Math.sin(yaw) * 18, 6, -Math.cos(yaw) * 18)); };

  F.update = (dt) => {
    const st = F.state, ui = G.uiOpen || G.cine;
    if (!ui) { F.camYaw -= input.mx * 0.0021 * G.settings.sens; F.camPitch -= input.my * 0.0021 * G.settings.sens * (G.settings.invert ? -1 : 1); F.camPitch = clamp(F.camPitch, -1.25, 1.1); }
    // aim = direction the camera looks
    aim.set(-Math.sin(F.camYaw) * Math.cos(F.camPitch), Math.sin(F.camPitch), -Math.cos(F.camYaw) * Math.cos(F.camPitch)).negate().multiplyScalar(-1);
    aim.set(Math.sin(F.camYaw + Math.PI) * Math.cos(F.camPitch), Math.sin(F.camPitch), Math.cos(F.camYaw + Math.PI) * Math.cos(F.camPitch));
    const W = !ui && input.f > 0, Sb = !ui && input.f < 0, boost = !ui && input.sprint && F.boostE > 0.05, climbK = !ui && input.jump;
    // speed: thrust from flapping, drag, gravity along the flight path
    fwd.set(0, 0, 1).applyQuaternion(F.q);
    const target = Sb ? 3 : boost ? 58 : W ? 34 : 22;
    let acc = (target - F.speed) * (Sb ? 1.6 : boost ? 1.2 : 0.35);
    acc += -fwd.y * 14;                                     // dive faster, climb slower
    F.speed = clamp(F.speed + acc * dt, 2.5, 75);
    F.boostE = clamp(F.boostE + (boost ? -dt * 0.35 : dt * 0.12), 0, 1);
    // steering: rotate toward the aim (faster at low speed), bank into turns
    const dir = tmp.copy(aim); if (climbK) dir.y += 0.6; if (F.speed < 7) dir.y = Math.max(dir.y, -0.2);
    dir.normalize();
    m4.lookAt(new THREE.Vector3(), dir, up); qTarget.setFromRotationMatrix(m4); qTarget.multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI));
    const turnK = 2.2 + (1 - Math.min(1, F.speed / 40)) * 2;
    const before = new THREE.Euler().setFromQuaternion(F.q, 'YXZ').y;
    F.q.slerp(qTarget, 1 - Math.exp(-turnK * dt));
    const e = new THREE.Euler().setFromQuaternion(F.q, 'YXZ');
    let yawRate = e.y - lastYaw; if (yawRate > Math.PI) yawRate -= Math.PI * 2; if (yawRate < -Math.PI) yawRate += Math.PI * 2; yawRate /= Math.max(dt, 1e-4); lastYaw = e.y;
    F.bank += (clamp(-yawRate * 0.55, -1.1, 1.1) - F.bank) * (1 - Math.exp(-5 * dt));
    // visual orientation includes bank
    G.dragon.root.quaternion.copy(F.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), F.bank));
    // move
    fwd.set(0, 0, 1).applyQuaternion(F.q);
    F.vel.copy(fwd).multiplyScalar(F.speed);
    if (F.speed < 9) F.vel.y += (W || climbK ? 3 : -2.5) * (1 - F.speed / 9);    // hover: flap to hold height
    F.pos.addScaledVector(F.vel, dt);
    // ground + water
    const gh = G.world.heightAt(F.pos.x, F.pos.z), floor = Math.max(gh, G.world.sea) + 2.2;
    F.skim = F.pos.y < Math.max(gh, G.world.sea) + 5 && gh < G.world.sea;
    if (F.pos.y < floor) { F.pos.y = floor; if (fwd.y < 0) F.q.slerp(new THREE.Quaternion().setFromAxisAngle(up, e.y), 0.2); F.speed *= gh > G.world.sea ? 0.985 : 0.995; }
    if (F.pos.y > 420) F.pos.y = 420;
    const R = Math.hypot(F.pos.x, F.pos.z), lim = G.world.size * 0.48; if (R > lim) { F.pos.x *= lim / R; F.pos.z *= lim / R; }
    G.dragon.root.position.copy(F.pos);
    // animation state for the dragon
    st.turn = clamp(yawRate * 0.8, -1.5, 1.5); st.climb = clamp(fwd.y * 1.5, -1, 1); st.speed = F.speed; st.boost = boost ? 1 : 0; st.brake = Sb ? 1 : 0;
    st.flapRate = W || boost || climbK || F.speed < 12 || fwd.y > 0.25 ? (boost ? 1 : W ? 0.8 : 0.6) : 0; st.dive = fwd.y < -0.45 && !W ? clamp((-fwd.y - 0.45) * 2.5, 0, 1) : 0;
    st.breath = !ui && (input.lmb || input.keys.KeyF);
    // ---- chase camera ----
    const dist = 16 + F.speed * 0.12 + (boost ? 3 : 0);
    const off = new THREE.Vector3(Math.sin(F.camYaw) * Math.cos(F.camPitch), -Math.sin(F.camPitch) + 0.18, Math.cos(F.camYaw) * Math.cos(F.camPitch)).multiplyScalar(dist);
    const want = new THREE.Vector3().copy(F.pos).add(off);
    const cgh = G.world.heightAt(want.x, want.z); if (want.y < Math.max(cgh, G.world.sea) + 1.5) want.y = Math.max(cgh, G.world.sea) + 1.5;
    camPos.lerp(want, 1 - Math.exp(-(G.cine ? 2 : 9) * dt));
    if (!G.cine) { cam.position.copy(camPos); cam.lookAt(F.pos.x, F.pos.y + 2, F.pos.z); }
    F.shake = Math.max(F.shake - dt * 2, boost ? 0.25 : 0);
    if (F.shake > 0) { cam.position.x += (Math.random() - 0.5) * F.shake * 0.3; cam.position.y += (Math.random() - 0.5) * F.shake * 0.3; }
    cam.fov += ((62 + Math.min(22, (F.speed - 20) * 0.45) + (boost ? 6 : 0)) - cam.fov) * (1 - Math.exp(-4 * dt)); cam.updateProjectionMatrix();
    // roll the camera a touch with the bank
    if (!G.cine) cam.rotateZ(F.bank * 0.12);
  };
  G.flight = F; return F;
}
