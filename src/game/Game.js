import * as THREE from 'three';
import { Sim, CFG, OBSTACLES } from './sim.js';
import { createCat, animateCat } from './cat.js';
import { buildSegment, buildObstacle, buildFish, Particles, SEG_LEN, SEG_COUNT, BG_COLOR } from './world.js';
import { sfx } from './audio.js';

const noop = () => {};

/**
 * 渲染 + 输入 + 状态机。玩法规则全部在 Sim 里，这里只负责把它画出来。
 * state: 'menu' | 'playing' | 'paused' | 'dying' | 'over'
 */
export class Game {
  constructor(canvas, cb = {}) {
    this.canvas = canvas;
    this.cb = { onPhase: noop, onHud: noop, onGameOver: noop, onPopup: noop, onToast: noop, ...cb };
    this.state = 'menu';
    this.sim = new Sim(1);
    this.meshes = new Map();
    this.t = 0;
    this.phase = 0;
    this.squash = 0;
    this.shake = 0;
    this.hudTimer = 0;
    this.deathT = 0;
    this.overAt = 0;
    this.fishStreak = 0;
    this.lastFishTime = -9;
    this.frames = 0;

    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(BG_COLOR);
    scene.fog = new THREE.Fog(BG_COLOR, 45, 125);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
    this.camPos = new THREE.Vector3(2.4, 1.6, -3.4);
    this.camLook = new THREE.Vector3(0, 0.8, 0);
    this.baseFov = 62;
    this.camZ = 6.2;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9a48a, 2.3));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.8);
    sun.position.set(-6, 10, 4);
    scene.add(sun);

    this.segments = [];
    for (let i = 0; i < SEG_COUNT; i++) {
      const s = buildSegment(i);
      s.position.z = SEG_LEN * 2 - i * SEG_LEN;
      scene.add(s);
      this.segments.push(s);
    }

    this.cat = createCat();
    scene.add(this.cat.root);
    this.particles = new Particles(scene);
    this.v3 = new THREE.Vector3();

    this.bind();
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- 输入 ----------
  bind() {
    this.onKey = (e) => {
      const c = e.code;
      const jumpKey = c === 'ArrowUp' || c === 'KeyW' || c === 'Space';
      if (jumpKey || c.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      if (this.state === 'playing') {
        if (c === 'ArrowLeft' || c === 'KeyA') this.left();
        else if (c === 'ArrowRight' || c === 'KeyD') this.right();
        else if (jumpKey) this.jump();
        else if (c === 'ArrowDown' || c === 'KeyS') this.sim.dive();
        else if (c === 'KeyP' || c === 'Escape') this.pause();
      } else if (this.state === 'paused') {
        if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') this.resume();
      } else if (this.state === 'menu' || this.state === 'over') {
        if (c === 'Space' || c === 'Enter') this.start();
      }
    };
    window.addEventListener('keydown', this.onKey);

    // 触屏/鼠标：滑动换道、上滑或轻点跳跃、下滑速降
    let p = null;
    this.onDown = (e) => {
      p = { x: e.clientX, y: e.clientY, t: performance.now(), done: false, id: e.pointerId };
      sfx.unlock();
    };
    this.onMove = (e) => {
      if (!p || p.done || e.pointerId !== p.id || this.state !== 'playing') return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
      p.done = true;
      if (Math.abs(dx) > Math.abs(dy)) dx < 0 ? this.left() : this.right();
      else dy < 0 ? this.jump() : this.sim.dive();
    };
    this.onUp = (e) => {
      if (p && !p.done && e.pointerId === p.id && this.state === 'playing' && performance.now() - p.t < 350) this.jump();
      p = null;
    };
    this.canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);

    this.onVis = () => document.hidden && this.pause();
    document.addEventListener('visibilitychange', this.onVis);
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(this.onResize);
      this.ro.observe(this.canvas.parentElement);
    }
  }

  left() { if (this.sim.moveLeft()) sfx.swipe(); }
  right() { if (this.sim.moveRight()) sfx.swipe(); }
  jump() { this.sim.jump(); }

  // ---------- 流程 ----------
  setState(s) {
    this.state = s;
    this.cb.onPhase(s);
  }

  start() {
    if (this.state === 'over' && performance.now() - this.overAt < 350) return; // 防止连按跳跃误触重开
    for (const m of this.meshes.values()) this.scene.remove(m);
    this.meshes.clear();
    this.sim.reset((Date.now() ^ (Math.random() * 1e9)) | 0);
    const r = this.cat.root;
    r.position.set(0, 0, 0);
    r.rotation.set(0, 0, 0);
    this.cat.body.scale.set(1, 1, 1);
    this.squash = 0;
    this.shake = 0;
    this.fishStreak = 0;
    sfx.start();
    this.pushHud();
    this.setState('playing');
  }

  pause() {
    if (this.state === 'playing') this.setState('paused');
  }
  resume() {
    if (this.state === 'paused') {
      this.last = performance.now();
      this.setState('playing');
    }
  }

  pushHud() {
    const s = this.sim;
    this.cb.onHud({ score: s.score, fish: s.fish, meters: Math.floor(s.dist), speed: s.difficulty });
  }

  // ---------- 主循环 ----------
  loop = (now) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (dt <= 0) return;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.frames++;
  };

  update(dt) {
    const sim = this.sim;
    const cat = this.cat;
    let scroll = 0;
    if (this.state !== 'paused') this.t += dt;

    if (this.state === 'playing') {
      // 低帧率时拆成小步，避免高速下穿模
      const steps = Math.max(1, Math.ceil(dt / 0.02));
      const h = dt / steps;
      const d0 = sim.dist;
      for (let i = 0; i < steps && this.state === 'playing'; i++) this.handle(sim.step(h));
      scroll = sim.dist - d0;
      this.phase += dt * (6 + sim.speed * 0.75);
      this.hudTimer -= dt;
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.08;
        this.pushHud();
      }
    } else if (this.state === 'menu') {
      scroll = dt * 2.5;
    } else if (this.state === 'dying') {
      this.deathT += dt;
      const k = this.deathT;
      cat.root.position.y = Math.max(0, 2.6 * k - 4.2 * k * k) * 1.6;
      cat.root.position.z = Math.min(2.2, k * 4);
      cat.root.rotation.x = -Math.min(k, 0.9) * 7;
      cat.root.rotation.z = Math.min(k, 0.9) * 2;
      if (k > 1.05) {
        this.overAt = performance.now();
        this.setState('over');
        this.cb.onGameOver({
          score: sim.score,
          fish: sim.fish,
          meters: Math.floor(sim.dist),
          killer: sim.killer ? OBSTACLES[sim.killer.type].name : '',
        });
      }
    }

    // 场景滚动
    if (scroll) {
      const total = SEG_LEN * SEG_COUNT;
      for (const s of this.segments) {
        s.position.z += scroll;
        if (s.position.z > SEG_LEN * 2.5) s.position.z -= total;
      }
    }

    // 实体
    for (const e of sim.entities) {
      const m = this.meshes.get(e.id);
      if (!m) continue;
      m.position.z = e.z;
      if (e.kind === 'fish') {
        m.rotation.y = this.t * 3.2 + e.id;
        m.position.y = e.y + Math.sin(this.t * 4 + e.id) * 0.08;
        const a = Math.max(0.01, Math.min(1, (e.z + 121) / 12)); // 远处由小变大地出现
        m.scale.setScalar(a);
      } else if (m.userData.led) {
        m.userData.led.visible = Math.sin(this.t * 10) > 0;
        m.rotation.y = this.t * 1.5;
      }
    }

    // 猫
    if (this.state === 'playing' || this.state === 'paused') {
      cat.root.position.set(sim.x, sim.y, 0);
      this.squash += (0 - this.squash) * Math.min(1, dt * 12);
      animateCat(cat, {
        mode: 'run', t: this.t, phase: this.phase, y: sim.y, vy: sim.vy, onGround: sim.onGround,
        lean: -(([-2, 0, 2][sim.lane]) - sim.x) * 0.35, squash: this.squash,
      });
      if (sim.onGround && this.state === 'playing' && Math.random() < dt * 14)
        this.particles.emit(sim.x, 0.08, 0.5, 1, 0xe8d8bf, 0.6, 0.8, 0.35);
    } else if (this.state === 'menu') {
      cat.root.position.set(0, 0, 0);
      cat.root.rotation.set(0, 0, 0);
      animateCat(cat, { mode: 'idle', t: this.t, y: 0 });
    } else {
      animateCat(cat, { mode: 'dead', t: this.t, y: cat.root.position.y });
    }

    this.particles.update(dt, scroll);
    this.updateCamera(dt);
  }

  handle(events) {
    const sim = this.sim;
    for (const ev of events) {
      switch (ev.type) {
        case 'spawn': {
          const e = ev.e;
          const m = e.kind === 'fish' ? buildFish() : buildObstacle(e.type);
          m.position.set(e.x, e.y, e.z);
          this.scene.add(m);
          this.meshes.set(e.id, m);
          break;
        }
        case 'remove':
          this.drop(ev.e.id);
          break;
        case 'fish': {
          const e = ev.e;
          this.drop(e.id);
          this.fishStreak = sim.time - this.lastFishTime < 0.6 ? this.fishStreak + 1 : 0;
          this.lastFishTime = sim.time;
          sfx.fish(this.fishStreak);
          this.particles.emit(e.x, e.y, e.z, 12, 0xfff07a, 2.6, 2.8, 0.5);
          this.particles.emit(e.x, e.y, e.z, 6, 0x7ad7ff, 2, 2.2, 0.45);
          const p = this.screenPos(e.x, e.y + 0.6, 0);
          this.cb.onPopup(p.x, p.y, `+${CFG.fishScore}`, 'fish');
          break;
        }
        case 'jump':
          sfx.jump();
          this.squash = -0.5;
          this.particles.emit(sim.x, 0.1, 0.2, 8, 0xe8d8bf, 1.6, 1.2, 0.4);
          break;
        case 'land':
          this.squash = 0.7;
          this.particles.emit(sim.x, 0.1, 0, 10, 0xe8d8bf, 2.2, 1, 0.4);
          break;
        case 'milestone':
          sfx.milestone();
          this.cb.onToast(`已逃离 ${ev.meters} 米！`);
          break;
        case 'crash': {
          sfx.crash();
          this.shake = 0.7;
          this.deathT = 0;
          this.particles.emit(sim.x, sim.y + 0.7, -0.4, 36, 0xffc04d, 5, 5, 0.9);
          this.particles.emit(sim.x, sim.y + 0.7, -0.4, 20, 0xffffff, 4, 4, 0.7);
          const p = this.screenPos(sim.x, sim.y + 1.4, 0);
          this.cb.onPopup(p.x, p.y, '喵呜！', 'crash');
          if (navigator.vibrate) try { navigator.vibrate(120); } catch {}
          this.pushHud();
          this.setState('dying');
          break;
        }
      }
    }
  }

  drop(id) {
    const m = this.meshes.get(id);
    if (m) {
      this.scene.remove(m);
      this.meshes.delete(id);
    }
  }

  screenPos(x, y, z) {
    const v = this.v3.set(x, y, z).project(this.camera);
    return { x: (v.x + 1) * 0.5 * this.w, y: (1 - v.y) * 0.5 * this.h };
  }

  updateCamera(dt) {
    const sim = this.sim;
    const cam = this.camera;
    let px, py, pz, lx, ly, lz, rate = 6;
    if (this.state === 'menu') {
      const a = 0.6 + Math.sin(this.t * 0.35) * 0.35;
      px = Math.sin(a) * 3.6; py = 1.5; pz = -Math.cos(a) * 3.6;
      lx = 0; ly = 0.75; lz = 0;
      rate = 2;
    } else {
      px = sim.x * 0.55; py = this.camY + sim.y * 0.25; pz = this.camZ;
      lx = sim.x * 0.35; ly = this.lookY + sim.y * 0.2; lz = -8;
    }
    const k = 1 - Math.exp(-dt * rate);
    this.camPos.x += (px - this.camPos.x) * k;
    this.camPos.y += (py - this.camPos.y) * k;
    this.camPos.z += (pz - this.camPos.z) * k;
    this.camLook.x += (lx - this.camLook.x) * k;
    this.camLook.y += (ly - this.camLook.y) * k;
    this.camLook.z += (lz - this.camLook.z) * k;
    cam.position.copy(this.camPos);
    if (this.shake > 0.001) {
      this.shake *= Math.exp(-dt * 6);
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
    }
    cam.lookAt(this.camLook);
    const fov = this.baseFov + (this.state === 'menu' ? 0 : sim.difficulty * 9);
    if (Math.abs(fov - cam.fov) > 0.05) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
      cam.updateProjectionMatrix();
    }
  }

  resize() {
    const el = this.canvas.parentElement;
    const w = (this.w = el.clientWidth || window.innerWidth);
    const h = (this.h = el.clientHeight || window.innerHeight);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    // 竖屏时加大视角并把镜头拉远，保证三条跑道都在画面里
    this.baseFov = aspect < 1 ? Math.min(92, Math.max(62, (2 * Math.atan(Math.tan((22 * Math.PI) / 180) / aspect) * 180) / Math.PI)) : 62;
    this.camZ = aspect < 1 ? 7.6 : 6.2;
    this.camY = aspect < 1 ? 4.5 : 3.3;
    this.lookY = aspect < 1 ? 1.0 : 1.3;
    this.camera.aspect = aspect;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('resize', this.onResize);
    this.ro?.disconnect();
    this.renderer.dispose();
  }
}
