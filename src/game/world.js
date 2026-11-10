import * as THREE from 'three';

export const SEG_LEN = 24;
export const SEG_COUNT = 8;
export const BG_COLOR = 0xffe9cf;

const matCache = new Map();
const M = (color, o) => {
  const key = color + (o ? JSON.stringify(o) : '');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...o }));
  return matCache.get(key);
};
const geoCache = new Map();
const box = (w, h, d) => {
  const k = `b${w},${h},${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
};
const cyl = (r1, r2, h, s = 16) => {
  const k = `c${r1},${r2},${h},${s}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(r1, r2, h, s));
  return geoCache.get(k);
};
const sph = (r) => {
  const k = `s${r}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.SphereGeometry(r, 12, 10));
  return geoCache.get(k);
};
const put = (parent, geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let tex = null;
function textures() {
  if (tex) return tex;
  const carpet = canvasTex(64, 64, (g) => {
    g.fillStyle = '#7d93b5';
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(20,30,60,0.09)';
      g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
    g.strokeStyle = 'rgba(40,55,90,0.35)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, 64, 64);
  });
  carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping;
  carpet.repeat.set(8, 12);

  const sky = canvasTex(256, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#5aa9ff');
    grad.addColorStop(0.65, '#bfe3ff');
    grad.addColorStop(1, '#fff1cf');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, r] of [[50, 30, 14], [70, 34, 18], [92, 32, 12], [180, 22, 12], [198, 26, 16]]) {
      g.beginPath();
      g.arc(x, y, r, 0, 7);
      g.fill();
    }
    for (let x = 0; x < w; x += 22) {
      const bh = 25 + ((x * 37) % 45);
      g.fillStyle = '#56688f';
      g.fillRect(x, h - bh, 18, bh);
      g.fillStyle = '#ffe28a';
      for (let y = h - bh + 5; y < h - 4; y += 9) for (let i = 0; i < 2; i++) if ((x + y + i) % 3) g.fillRect(x + 3 + i * 8, y, 4, 4);
    }
  });

  const exit = canvasTex(256, 80, (g, w, h) => {
    g.fillStyle = '#12a150';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#fff';
    g.font = 'bold 42px system-ui, "PingFang SC", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('EXIT 出口 →', w / 2, h / 2 + 2);
  });

  const screens = ['#3aa0ff', '#2fd38a', '#ffb84a', '#b58cff'].map((col, k) =>
    canvasTex(64, 40, (g) => {
      g.fillStyle = '#18203a';
      g.fillRect(0, 0, 64, 40);
      g.fillStyle = col;
      if (k % 2) for (let i = 0; i < 6; i++) g.fillRect(6 + i * 9, 34 - (8 + ((i * 13 + k * 7) % 22)), 6, 8 + ((i * 13 + k * 7) % 22));
      else for (let i = 0; i < 5; i++) g.fillRect(6, 6 + i * 6, 20 + ((i * 17 + k * 5) % 30), 3);
    })
  );
  tex = { carpet, sky, exit, screens };
  return tex;
}

/** 一段走廊：地毯、跑道、两侧墙、窗、工位、吊灯。原点在段中心，z 范围 ±SEG_LEN/2。 */
export function buildSegment(index) {
  const t = textures();
  const g = new THREE.Group();
  const L = SEG_LEN;
  const rnd = (i) => {
    const x = Math.sin(index * 127.1 + i * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const floor = put(g, new THREE.PlaneGeometry(16, L), new THREE.MeshLambertMaterial({ map: t.carpet }));
  floor.rotation.x = -Math.PI / 2;
  const runner = put(g, new THREE.PlaneGeometry(6.4, L), M(0xfff3df), 0, 0.006, 0);
  runner.rotation.x = -Math.PI / 2;
  for (const x of [-3.2, 3.2]) put(g, box(0.12, 0.02, L), M(0xff9f43), x, 0.012, 0);
  for (const x of [-1, 1]) for (let i = 0; i < 4; i++) put(g, box(0.07, 0.02, 2.4), M(0xe7d3b3), x, 0.012, -L / 2 + 3 + i * 6);

  const ceil = put(g, new THREE.PlaneGeometry(16, L), new THREE.MeshBasicMaterial({ color: 0xf6efe4 }), 0, 5.2, 0);
  ceil.rotation.x = Math.PI / 2;
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const z of [-6, 6]) {
    put(g, box(2.6, 0.06, 0.9), lightMat, 0, 5.16, z);
    put(g, box(16, 0.18, 0.25), new THREE.MeshBasicMaterial({ color: 0xe6dccb }), 0, 5.1, z + 6);
  }

  // 墙
  for (const s of [-1, 1]) {
    const wall = put(g, new THREE.PlaneGeometry(L, 5.2), M(0xfdf6ea), s * 8, 2.6, 0);
    wall.rotation.y = -s * Math.PI / 2;
    put(g, box(0.12, 0.35, L), M(0xb9a88f), s * 7.94, 0.17, 0);
  }
  // 左墙：落地窗，外面是自由的蓝天
  const skyMat = new THREE.MeshBasicMaterial({ map: t.sky });
  for (const z of [-6, 6]) {
    const win = put(g, new THREE.PlaneGeometry(8.5, 2.9), skyMat, -7.9, 2.9, z);
    win.rotation.y = Math.PI / 2;
    put(g, box(0.14, 3.1, 0.14), M(0xffffff), -7.86, 2.9, z);
    put(g, box(0.14, 0.14, 8.7), M(0xffffff), -7.86, 2.9, z);
    put(g, box(0.2, 0.14, 8.9), M(0xffffff), -7.86, 1.42, z);
  }
  // 右墙：门、公告板、挂钟
  put(g, box(0.1, 3.2, 1.7), M(0xa9744f), 7.92, 1.6, -7);
  put(g, sph(0.08), M(0xffd166), 7.84, 1.55, -6.4);
  put(g, box(0.08, 1.6, 3.2), M(0xc98f5a), 7.92, 2.8, 3);
  const notes = [0xfff07a, 0xff9aa8, 0x9be7ff, 0xb8f5a0, 0xffffff];
  for (let i = 0; i < 7; i++) put(g, box(0.02, 0.4, 0.4), M(notes[i % 5]), 7.86, 2.35 + rnd(i) * 0.9, 1.8 + rnd(i + 9) * 2.4);
  put(g, cyl(0.45, 0.45, 0.06, 20), M(0xffffff), 7.9, 3.9, -2.5).rotation.z = Math.PI / 2;
  put(g, box(0.02, 0.3, 0.04), M(0x333333), 7.85, 4.0, -2.5);

  // 两侧工位
  for (const s of [-1, 1]) {
    for (const [zi, z] of [[0, -6], [1, 6]]) {
      const k = index * 4 + (s > 0 ? 2 : 0) + zi;
      const cub = new THREE.Group();
      cub.position.set(s * 5.3, 0, z);
      g.add(cub);
      const wallCol = [0x9fc5e8, 0xb6d7a8, 0xf9cb9c, 0xd5a6bd][k % 4];
      put(cub, box(0.1, 1.5, 4.4), M(wallCol), -s * 1.25, 0.75, 0); // 靠过道的隔板
      put(cub, box(2.5, 1.5, 0.1), M(wallCol), 0, 0.75, -2.2);
      put(cub, box(2.2, 0.08, 1.3), M(0xf2e2c6), 0.05 * s, 0.95, -1.4);
      put(cub, box(0.08, 0.95, 1.2), M(0x9a8b78), s * 1.05, 0.47, -1.4);
      put(cub, box(0.9, 0.55, 0.06), M(0x2b2f3a), 0, 1.5, -1.75);
      put(cub, new THREE.PlaneGeometry(0.8, 0.46), new THREE.MeshBasicMaterial({ map: t.screens[k % 4] }), 0, 1.5, -1.715);
      put(cub, box(0.1, 0.25, 0.06), M(0x2b2f3a), 0, 1.12, -1.75);
      // 椅子
      const cc = [0x4a6fa5, 0xe76f51, 0x2a9d8f, 0x6d597a][(k + 1) % 4];
      put(cub, box(0.6, 0.1, 0.6), M(cc), 0, 0.55, -0.3);
      put(cub, box(0.6, 0.7, 0.1), M(cc), 0, 0.95, 0.02);
      put(cub, cyl(0.05, 0.05, 0.5, 8), M(0x444444), 0, 0.27, -0.3);
      if (rnd(k) > 0.4) put(cub, cyl(0.07, 0.06, 0.16, 10), M(0xffffff), 0.6 * s, 1.07, -1.2); // 咖啡杯
    }
    // 过道边的绿植
    if (rnd(s + 5) > 0.35) {
      const p = new THREE.Group();
      p.position.set(s * 3.75, 0, rnd(s + 2) * 6 - 3);
      g.add(p);
      put(p, cyl(0.28, 0.2, 0.45, 12), M(0xd98555), 0, 0.22, 0);
      put(p, sph(0.42), M(0x4caf6a), 0, 0.85, 0).scale.set(1, 1.25, 1);
      put(p, sph(0.28), M(0x66c283), 0.2, 1.25, 0.1);
      put(p, sph(0.25), M(0x3d9a5a), -0.2, 1.15, -0.1);
    }
  }

  if (index % 2 === 0) {
    put(g, box(1.9, 0.6, 0.08), new THREE.MeshBasicMaterial({ map: t.exit }), 0, 4.45, 0);
    for (const x of [-0.7, 0.7]) put(g, box(0.04, 0.5, 0.04), M(0x888888), x, 4.95, 0);
  }
  return g;
}

/** 障碍物模型，原点在地面中心。尺寸与 sim.js 里的 OBSTACLES 对应。 */
export function buildObstacle(type) {
  const g = new THREE.Group();
  switch (type) {
    case 'box': {
      put(g, box(1.4, 0.5, 0.9), M(0xc89b62), 0, 0.25, 0);
      put(g, box(1.42, 0.52, 0.14), M(0xe8d2a6), 0, 0.25, 0);
      const top = put(g, box(0.85, 0.35, 0.7), M(0xd7ab72), 0.15, 0.675, 0);
      top.rotation.y = 0.3;
      put(g, box(0.14, 0.36, 0.72), M(0xe8d2a6), 0.15, 0.675, 0).rotation.y = 0.3;
      break;
    }
    case 'vacuum': {
      put(g, cyl(0.58, 0.58, 0.2, 24), M(0x2e3440), 0, 0.14, 0);
      put(g, cyl(0.5, 0.5, 0.04, 24), M(0x4c566a), 0, 0.26, 0);
      put(g, cyl(0.14, 0.14, 0.06, 16), M(0x88c0d0), 0, 0.29, 0);
      const led = put(g, sph(0.06), new THREE.MeshBasicMaterial({ color: 0xff4d4d }), 0, 0.3, 0.38);
      g.userData.led = led;
      break;
    }
    case 'printer': {
      put(g, box(1.3, 0.7, 0.9), M(0xe9edf2), 0, 0.35, 0);
      put(g, box(1.34, 0.12, 0.94), M(0x5b6472), 0, 0.72, 0);
      put(g, box(1.0, 0.2, 0.7), M(0xd5dbe3), 0, 0.88, 0);
      put(g, box(0.8, 0.02, 0.5), M(0xffffff), 0, 0.99, 0.15).rotation.x = 0.15;
      put(g, box(0.3, 0.1, 0.02), new THREE.MeshBasicMaterial({ color: 0x4dd0ff }), 0.35, 0.5, 0.46);
      put(g, box(0.9, 0.04, 0.3), M(0xffffff), 0, 0.3, 0.55);
      break;
    }
    case 'cabinet': {
      put(g, box(1.4, 2.4, 0.8), M(0x7f93ad), 0, 1.2, 0);
      for (let i = 0; i < 4; i++) {
        put(g, box(1.24, 0.5, 0.04), M(0x93a8c4), 0, 0.33 + i * 0.58, 0.41);
        put(g, box(0.4, 0.06, 0.06), M(0xe6edf5), 0, 0.42 + i * 0.58, 0.45);
      }
      put(g, box(0.5, 0.3, 0.4), M(0xc89b62), -0.3, 2.55, 0);
      break;
    }
    case 'cooler': {
      put(g, box(0.8, 1.3, 0.8), M(0xf4f7fa), 0, 0.65, 0);
      put(g, box(0.82, 0.25, 0.82), M(0x5aa9e6), 0, 1.0, 0);
      put(g, cyl(0.34, 0.34, 0.75, 18), new THREE.MeshLambertMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.75 }), 0, 1.75, 0);
      put(g, cyl(0.12, 0.3, 0.14, 14), M(0x8fd3ff), 0, 1.36, 0);
      put(g, box(0.1, 0.1, 0.1), M(0xff5d5d), -0.15, 1.0, 0.44);
      put(g, box(0.1, 0.1, 0.1), M(0x3d7bff), 0.15, 1.0, 0.44);
      break;
    }
    default: {
      // desk：带高隔板的工位
      put(g, box(1.7, 2.0, 0.12), M(0xf4a261), 0, 1.0, -0.45);
      put(g, box(1.72, 0.1, 0.14), M(0xe76f51), 0, 2.0, -0.45);
      put(g, box(1.7, 0.08, 1.0), M(0xf2e2c6), 0, 0.95, 0.05);
      put(g, box(0.08, 0.95, 0.9), M(0x9a8b78), -0.78, 0.47, 0.05);
      put(g, box(0.08, 0.95, 0.9), M(0x9a8b78), 0.78, 0.47, 0.05);
      put(g, box(0.8, 0.5, 0.06), M(0x2b2f3a), 0, 1.45, -0.2);
      put(g, box(0.7, 0.4, 0.02), new THREE.MeshBasicMaterial({ color: 0x7ad7ff }), 0, 1.45, -0.16);
      put(g, box(0.5, 0.03, 0.2), M(0x444a57), 0, 1.01, 0.25);
    }
  }
  return g;
}

const fishBody = new THREE.SphereGeometry(0.3, 14, 10);
const fishTail = new THREE.ConeGeometry(0.2, 0.3, 4);
let fishMat, fishMat2;
export function buildFish() {
  fishMat ||= new THREE.MeshLambertMaterial({ color: 0x6fd3ff, emissive: 0x1f7fd0, emissiveIntensity: 0.55 });
  fishMat2 ||= new THREE.MeshLambertMaterial({ color: 0xffd166, emissive: 0xb37400, emissiveIntensity: 0.5 });
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  put(inner, fishBody, fishMat).scale.set(1, 0.62, 0.36);
  const tail = put(inner, fishTail, fishMat2, 0.38, 0, 0);
  tail.rotation.z = Math.PI / 2;
  tail.scale.set(1, 1, 0.35);
  put(inner, fishTail, fishMat2, -0.02, 0.2, 0).scale.set(0.5, 0.5, 0.25);
  for (const s of [-1, 1]) put(inner, sph(0.04), M(0x1b2a41), -0.17, 0.04, s * 0.095);
  g.userData.inner = inner;
  return g;
}

/** 粒子池：收集星光、落地尘土、撞击碎屑共用。 */
export class Particles {
  constructor(scene, n = 260) {
    this.n = n;
    this.pos = new Float32Array(n * 3).fill(-999);
    this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const dot = canvasTex(32, 32, (g) => {
      const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 32, 32);
    });
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.26, map: dot, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true })
    );
    this.points.frustumCulled = false;
    this.tmp = new THREE.Color();
    scene.add(this.points);
  }
  emit(x, y, z, count, color, speed = 3, up = 3, life = 0.6) {
    this.tmp.set(color);
    for (let k = 0; k < count; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.n;
      const a = Math.random() * Math.PI * 2;
      const r = speed * (0.4 + Math.random() * 0.6);
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * r;
      this.vel[i * 3 + 1] = up * (0.3 + Math.random());
      this.vel[i * 3 + 2] = Math.sin(a) * r;
      this.col[i * 3] = this.tmp.r;
      this.col[i * 3 + 1] = this.tmp.g;
      this.col[i * 3 + 2] = this.tmp.b;
      this.life[i] = life * (0.6 + Math.random() * 0.6);
    }
    this.points.geometry.attributes.color.needsUpdate = true;
  }
  update(dt, scroll) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999;
        continue;
      }
      this.vel[i * 3 + 1] -= 9 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(0.05, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt + scroll;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
