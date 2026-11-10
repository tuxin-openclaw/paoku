import * as THREE from 'three';

const M = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });

/** 程序化搭建的橘猫，面朝 -z（奔跑方向）。 */
export function createCat() {
  const orange = M(0xf5922f);
  const dark = M(0xc9641a);
  const white = M(0xfff4e6);
  const pink = M(0xff9aa8);
  const black = M(0x2a1a12);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // 躯干
  const torso = add(body, new THREE.CapsuleGeometry(0.3, 0.62, 6, 14), orange, 0, 0.62, 0);
  torso.rotation.x = Math.PI / 2;
  const belly = add(body, new THREE.SphereGeometry(0.26, 14, 10), white, 0, 0.47, -0.05);
  belly.scale.set(0.9, 0.6, 1.6);
  const stripeGeo = new THREE.TorusGeometry(0.305, 0.032, 6, 14, Math.PI);
  for (const z of [-0.24, -0.02, 0.2]) add(body, stripeGeo, dark, 0, 0.62, z);

  // 头
  const head = new THREE.Group();
  head.position.set(0, 0.98, -0.62);
  body.add(head);
  add(head, new THREE.SphereGeometry(0.34, 18, 14), orange).scale.set(1.05, 0.92, 0.95);
  const earGeo = new THREE.ConeGeometry(0.13, 0.26, 4);
  const earInGeo = new THREE.ConeGeometry(0.075, 0.16, 4);
  for (const s of [-1, 1]) {
    add(head, earGeo, orange, s * 0.2, 0.32, 0).rotation.set(0, Math.PI / 4, -s * 0.25);
    add(head, earInGeo, pink, s * 0.2, 0.3, -0.035).rotation.set(0, Math.PI / 4, -s * 0.25);
    add(head, new THREE.SphereGeometry(0.058, 10, 8), black, s * 0.14, 0.05, -0.285);
    add(head, new THREE.SphereGeometry(0.02, 6, 6), white, s * 0.125, 0.075, -0.335);
    for (const k of [-1, 1]) {
      const w = add(head, new THREE.BoxGeometry(0.24, 0.008, 0.008), white, s * 0.27, -0.1 + k * 0.03, -0.26);
      w.rotation.z = s * k * 0.18;
    }
  }
  add(head, new THREE.SphereGeometry(0.15, 12, 10), white, 0, -0.1, -0.25).scale.set(1.3, 0.8, 0.8);
  add(head, new THREE.SphereGeometry(0.04, 8, 6), pink, 0, -0.05, -0.375);
  const hs = new THREE.BoxGeometry(0.045, 0.02, 0.18);
  add(head, hs, dark, 0, 0.305, 0.02);
  add(head, hs, dark, -0.1, 0.285, 0.03);
  add(head, hs, dark, 0.1, 0.285, 0.03);

  // 腿
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.26, 4, 8);
  const pawGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const mkLeg = (x, z) => {
    const g = new THREE.Group();
    g.position.set(x, 0.5, z);
    add(g, legGeo, orange, 0, -0.2, 0);
    add(g, pawGeo, white, 0, -0.41, -0.03).scale.set(1, 0.7, 1.25);
    body.add(g);
    return g;
  };
  const legs = { fl: mkLeg(-0.17, -0.36), fr: mkLeg(0.17, -0.36), bl: mkLeg(-0.17, 0.34), br: mkLeg(0.17, 0.34) };

  // 尾巴：一串嵌套关节，方便做波浪摆动
  const tail = [];
  const segGeo = new THREE.CapsuleGeometry(0.07, 0.16, 4, 8);
  let parent = body;
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    if (i === 0) g.position.set(0, 0.8, 0.58);
    else g.position.y = 0.2;
    add(g, segGeo, i >= 4 ? white : i % 2 ? dark : orange, 0, 0.1, 0);
    parent.add(g);
    tail.push(g);
    parent = g;
  }

  // 脚下的假阴影
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  shadow.scale.set(1, 1.35, 1);
  root.add(shadow);

  return { root, body, head, legs, tail, shadow };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** s: { mode:'idle'|'run'|'dead', t, phase, y, vy, onGround, lean, squash } */
export function animateCat(cat, s) {
  const { body, head, legs, tail, shadow } = cat;
  const L = legs;
  let tailBase = 0.9, wagSpeed = 7, wagAmp = 0.2;

  if (s.mode === 'idle') {
    const b = Math.sin(s.t * 2.2);
    body.position.y = 0;
    body.rotation.set(0, 0, 0);
    body.scale.set(1, 1 + b * 0.015, 1);
    L.fl.rotation.x = L.fr.rotation.x = L.bl.rotation.x = L.br.rotation.x = 0;
    head.rotation.set(Math.sin(s.t * 1.3) * 0.06, Math.sin(s.t * 0.9) * 0.35, Math.sin(s.t * 0.7) * 0.12);
    tailBase = 0.5; wagSpeed = 2.5; wagAmp = 0.28;
  } else if (s.mode === 'run') {
    const p = s.phase;
    head.rotation.set(0, 0, 0);
    if (s.onGround) {
      L.fl.rotation.x = Math.sin(p) * 0.95;
      L.fr.rotation.x = Math.sin(p + 0.7) * 0.95;
      L.bl.rotation.x = Math.sin(p + Math.PI) * 0.95;
      L.br.rotation.x = Math.sin(p + Math.PI + 0.7) * 0.95;
      body.position.y = Math.abs(Math.sin(p)) * 0.08;
      body.rotation.x = Math.sin(p * 2) * 0.05;
      head.rotation.x = -Math.sin(p * 2) * 0.05;
    } else {
      // 腾空：前腿前伸、后腿后蹬
      const k = 0.25;
      L.fl.rotation.x += (-1.15 - L.fl.rotation.x) * k;
      L.fr.rotation.x += (-1.15 - L.fr.rotation.x) * k;
      L.bl.rotation.x += (1.15 - L.bl.rotation.x) * k;
      L.br.rotation.x += (1.15 - L.br.rotation.x) * k;
      body.position.y = 0;
      body.rotation.x = clamp(s.vy * 0.045, -0.45, 0.45);
      tailBase = 1.25;
    }
    body.rotation.z = clamp(s.lean, -0.4, 0.4);
    body.rotation.y = clamp(s.lean * 0.6, -0.3, 0.3);
    const q = s.squash || 0; // 落地/起跳的挤压拉伸
    body.scale.set(1 + q * 0.25, 1 - q * 0.3, 1 + q * 0.1);
  } else {
    L.fl.rotation.x = L.fr.rotation.x = -1.3;
    L.bl.rotation.x = L.br.rotation.x = 1.3;
    wagSpeed = 20; wagAmp = 0.1;
  }

  tail[0].rotation.x = tailBase;
  for (let i = 0; i < tail.length; i++) {
    tail[i].rotation.z = Math.sin(s.t * wagSpeed - i * 0.8) * wagAmp;
    if (i > 0) tail[i].rotation.x = -0.18 + Math.sin(s.t * wagSpeed * 0.5 - i) * 0.08;
  }

  const h = Math.max(0, s.y);
  const k = 1 / (1 + h * 0.6);
  shadow.scale.set(k, 1.35 * k, 1);
  shadow.material.opacity = 0.28 * k;
}
