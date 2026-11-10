// 纯逻辑层：不依赖 Three.js，可在 Node 里直接跑测试。
// 坐标约定：玩家固定在 z=0，朝 -z 方向奔跑；世界上的物体 z 不断增大向玩家靠近。

export const LANES = [-2, 0, 2];

export const CFG = {
  startSpeed: 11,
  maxSpeed: 28,
  accel: 0.2, // 每秒提速
  jumpV: 9.6,
  gravity: 28,
  diveV: -16,
  laneLerp: 14,
  spawnAhead: 115,
  despawnZ: 9,
  firstRow: 42,
  fishScore: 10,
  jumpBuffer: 0.14,
};

export const OBSTACLES = {
  box: { w: 1.5, h: 0.85, d: 1.0, jumpable: true, name: '快递纸箱' },
  vacuum: { w: 1.2, h: 0.3, d: 1.2, jumpable: true, name: '扫地机器人' },
  printer: { w: 1.4, h: 1.0, d: 1.0, jumpable: true, name: '打印机' },
  cabinet: { w: 1.5, h: 2.4, d: 0.9, jumpable: false, name: '文件柜' },
  cooler: { w: 1.0, h: 2.2, d: 1.0, jumpable: false, name: '饮水机' },
  desk: { w: 1.7, h: 2.0, d: 1.1, jumpable: false, name: '工位隔板' },
};
const LOW = ['box', 'vacuum', 'printer'];
const TALL = ['cabinet', 'cooler', 'desk'];

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/** 生成一排障碍 + 小鱼。保证永远有路可走：高障碍最多 2 个，其余可跳过或为空。 */
export function generateRow(rng, d) {
  let n = 1;
  if (rng() < 0.35 + 0.4 * d) n++;
  if (rng() < 0.08 + 0.3 * d) n++;
  const lanes = [0, 1, 2].sort(() => rng() - 0.5).slice(0, n);
  let tall = 0;
  const obstacles = lanes.map((lane) => {
    const isTall = tall < 2 && rng() < 0.45;
    if (isTall) tall++;
    return { lane, type: pick(rng, isTall ? TALL : LOW) };
  });
  const fish = [];
  if (rng() < 0.78) {
    const byLane = {};
    obstacles.forEach((o) => (byLane[o.lane] = o));
    const ok = [0, 1, 2].filter((l) => !byLane[l] || OBSTACLES[byLane[l].type].jumpable);
    const lane = pick(rng, ok);
    const arc = !!byLane[lane];
    const ys = arc ? [0.7, 1.35, 1.9, 1.35, 0.7] : [0.7, 0.7, 0.7, 0.7, 0.7];
    const span = arc ? 2.4 : 1.8;
    ys.forEach((y, i) => fish.push({ lane, dz: (i - 2) * span, y }));
  }
  return { obstacles, fish };
}

export function hitsObstacle(px, py, e) {
  return (
    Math.abs(px - e.x) < e.w / 2 + 0.3 &&
    Math.abs(e.z) < e.d / 2 + 0.4 &&
    py < e.h - 0.15
  );
}

export function hitsFish(px, py, e) {
  return Math.abs(px - e.x) < 0.85 && Math.abs(e.z) < 0.9 && Math.abs(e.y - (py + 0.5)) < 1.0;
}

export class Sim {
  constructor(seed = 1) {
    this.events = [];
    this.entities = [];
    this.reset(seed);
  }

  reset(seed = 1) {
    this.rng = mulberry32(seed);
    this.entities.length = 0;
    this.events.length = 0;
    this.nextId = 1;
    this.rowId = 0;
    this.time = 0;
    this.speed = CFG.startSpeed;
    this.dist = 0;
    this.fish = 0;
    this.lane = 1;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.onGround = true;
    this.buffer = 0;
    this.dead = false;
    this.killer = null;
    this.milestone = 0;
    this.nextRowAt = CFG.firstRow;
  }

  get score() {
    return Math.floor(this.dist) + this.fish * CFG.fishScore;
  }
  get difficulty() {
    return (this.speed - CFG.startSpeed) / (CFG.maxSpeed - CFG.startSpeed);
  }

  moveLeft() {
    if (this.dead || this.lane === 0) return false;
    this.lane--;
    return true;
  }
  moveRight() {
    if (this.dead || this.lane === 2) return false;
    this.lane++;
    return true;
  }
  jump() {
    if (this.dead) return;
    this.buffer = CFG.jumpBuffer; // 落地前一瞬间按跳也算数
  }
  dive() {
    if (!this.dead && !this.onGround) this.vy = Math.min(this.vy, CFG.diveV);
  }

  spawnRow(z) {
    const row = generateRow(this.rng, this.difficulty);
    const rowId = ++this.rowId;
    for (const o of row.obstacles) {
      const def = OBSTACLES[o.type];
      const e = { id: this.nextId++, kind: 'ob', type: o.type, lane: o.lane, rowId, x: LANES[o.lane], y: 0, z, w: def.w, h: def.h, d: def.d };
      this.entities.push(e);
      this.events.push({ type: 'spawn', e });
    }
    for (const f of row.fish) {
      const e = { id: this.nextId++, kind: 'fish', lane: f.lane, rowId, x: LANES[f.lane], y: f.y, z: z + f.dz };
      this.entities.push(e);
      this.events.push({ type: 'spawn', e });
    }
  }

  step(dt) {
    const ev = this.events;
    ev.length = 0;
    if (this.dead) return ev;
    this.time += dt;
    this.speed = Math.min(CFG.maxSpeed, this.speed + CFG.accel * dt);
    const move = this.speed * dt;
    this.dist += move;

    const m = Math.floor(this.dist / 500);
    if (m > this.milestone) {
      this.milestone = m;
      ev.push({ type: 'milestone', meters: m * 500 });
    }

    // 玩家
    this.x += (LANES[this.lane] - this.x) * Math.min(1, dt * CFG.laneLerp);
    if (this.buffer > 0) this.buffer -= dt;
    if (!this.onGround) {
      this.vy -= CFG.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.onGround = true;
        ev.push({ type: 'land' });
      }
    }
    if (this.onGround && this.buffer > 0) {
      this.buffer = 0;
      this.onGround = false;
      this.vy = CFG.jumpV;
      ev.push({ type: 'jump' });
    }

    // 世界滚动 + 回收
    const list = this.entities;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.z += move;
      if (e.z > CFG.despawnZ) {
        list.splice(i, 1);
        ev.push({ type: 'remove', e });
      }
    }

    // 生成
    while (this.dist + CFG.spawnAhead >= this.nextRowAt) {
      this.spawnRow(-(this.nextRowAt - this.dist));
      this.nextRowAt += Math.max(13, this.speed * 1.05) + this.rng() * 6;
    }

    // 碰撞
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.z < -3 || e.z > 3) continue;
      if (e.kind === 'fish') {
        if (hitsFish(this.x, this.y, e)) {
          list.splice(i, 1);
          this.fish++;
          ev.push({ type: 'fish', e });
        }
      } else if (hitsObstacle(this.x, this.y, e)) {
        this.dead = true;
        this.killer = e;
        ev.push({ type: 'crash', e });
        break;
      }
    }
    return ev;
  }
}
