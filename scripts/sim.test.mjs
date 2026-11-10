// 无头逻辑测试：node scripts/sim.test.mjs
import assert from 'node:assert/strict';
import { Sim, CFG, OBSTACLES, LANES, generateRow, mulberry32 } from '../src/game/sim.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log('  ✓', name);
};

test('每一排障碍都留有活路', () => {
  const rng = mulberry32(42);
  for (let i = 0; i < 20000; i++) {
    const row = generateRow(rng, i / 20000);
    const lanes = new Set(row.obstacles.map((o) => o.lane));
    assert.equal(lanes.size, row.obstacles.length, '同一车道不能有两个障碍');
    const tall = row.obstacles.filter((o) => !OBSTACLES[o.type].jumpable).length;
    assert.ok(tall <= 2, '高障碍不能堵死三条道');
    for (const f of row.fish) {
      const ob = row.obstacles.find((o) => o.lane === f.lane);
      assert.ok(!ob || OBSTACLES[ob.type].jumpable, '小鱼不能放在过不去的车道');
    }
  }
});

test('站着不动会撞上障碍并结束', () => {
  const s = new Sim(7);
  let crashed = false;
  for (let i = 0; i < 60 * 60 && !crashed; i++) crashed = s.step(1 / 60).some((e) => e.type === 'crash');
  assert.ok(crashed && s.dead);
  const d = s.dist;
  s.step(1 / 60);
  assert.equal(s.dist, d, '死亡后世界停止');
});

test('速度随时间递增并封顶', () => {
  const s = new Sim(1);
  s.entities.length = 0;
  s.nextRowAt = Infinity;
  s.step(10);
  assert.ok(s.speed > CFG.startSpeed);
  for (let i = 0; i < 200; i++) s.step(1);
  assert.equal(s.speed, CFG.maxSpeed);
});

test('换道有边界，跳跃能落地', () => {
  const s = new Sim(1);
  s.nextRowAt = Infinity;
  s.moveLeft(); s.moveLeft(); s.moveLeft();
  assert.equal(s.lane, 0);
  s.moveRight(); s.moveRight(); s.moveRight();
  assert.equal(s.lane, 2);
  for (let i = 0; i < 60; i++) s.step(1 / 60);
  assert.ok(Math.abs(s.x - LANES[2]) < 0.01);
  s.jump();
  let peak = 0, landed = false;
  for (let i = 0; i < 120; i++) {
    if (s.step(1 / 60).some((e) => e.type === 'land')) landed = true;
    peak = Math.max(peak, s.y);
  }
  assert.ok(peak > 1.4 && landed && s.onGround && s.y === 0);
});

test('吃到小鱼加分', () => {
  const s = new Sim(1);
  s.nextRowAt = Infinity;
  s.entities.push({ id: 999, kind: 'fish', lane: 1, x: 0, y: 0.7, z: -2 });
  let got = false;
  for (let i = 0; i < 30; i++) if (s.step(1 / 60).some((e) => e.type === 'fish')) got = true;
  assert.ok(got);
  assert.equal(s.fish, 1);
  assert.equal(s.score, Math.floor(s.dist) + CFG.fishScore);
});

// 自动驾驶：只用和玩家一样的操作（左右换道、跳），验证整局难度曲线是可通关的
function bot(s) {
  let rowZ = -Infinity, rowId = -1;
  for (const e of s.entities) if (e.kind === 'ob' && e.z < 0.6 && e.z > rowZ) { rowZ = e.z; rowId = e.rowId; }
  if (rowId < 0) return;
  const dist = -rowZ;
  if (dist > s.speed * 0.95) return;
  const row = {};
  for (const e of s.entities) if (e.kind === 'ob' && e.rowId === rowId) row[e.lane] = e;
  const cost = (l) => (!row[l] ? 0 : OBSTACLES[row[l].type].jumpable ? 1 : 99) + Math.abs(l - s.lane) * 0.1;
  const target = [0, 1, 2].sort((a, b) => cost(a) - cost(b))[0];
  if (target < s.lane) s.moveLeft();
  else if (target > s.lane) s.moveRight();
  else if (row[s.lane] && s.onGround && dist < s.speed * 0.3 + 0.6) s.jump();
}

for (const fps of [60, 30, 144]) {
  test(`自动驾驶在 ${fps}fps 下连续存活 4 分钟（8 个随机种子）`, () => {
    for (let seed = 1; seed <= 8; seed++) {
      const s = new Sim(seed * 977);
      const steps = 240 * fps;
      for (let i = 0; i < steps; i++) {
        bot(s);
        s.step(1 / fps);
        assert.ok(!s.dead, `seed ${seed} 在 ${s.time.toFixed(1)}s 撞上 ${s.killer?.type}（速度 ${s.speed.toFixed(1)}）`);
      }
      assert.equal(s.speed, CFG.maxSpeed);
      assert.ok(s.entities.length < 200, '实体被正确回收');
    }
  });
}

console.log(`\n${passed} 项逻辑测试全部通过`);
