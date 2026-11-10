import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from './game/Game.js';
import { sfx } from './game/audio.js';

const BEST_KEY = 'paoku-best';
const loadBest = () => {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
};
const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export default function App() {
  const canvasRef = useRef(null);
  const fxRef = useRef(null);
  const gameRef = useRef(null);
  const [phase, setPhase] = useState('menu');
  const [hud, setHud] = useState({ score: 0, fish: 0, meters: 0, speed: 0 });
  const [result, setResult] = useState(null);
  const [best, setBest] = useState(loadBest);
  const [muted, setMuted] = useState(sfx.isMuted());
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let game;
    let toastTimer;
    try {
      game = new Game(canvasRef.current, {
        onPhase: setPhase,
        onHud: setHud,
        onGameOver: (r) => {
          const prev = loadBest();
          const isNew = r.score > prev;
          if (isNew) {
            try { localStorage.setItem(BEST_KEY, String(r.score)); } catch {}
            setBest(r.score);
          }
          setResult({ ...r, isNew, best: Math.max(prev, r.score) });
        },
        onPopup: (x, y, text, cls) => {
          const layer = fxRef.current;
          if (!layer) return;
          const el = document.createElement('span');
          el.className = `popup ${cls}`;
          el.textContent = text;
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.addEventListener('animationend', () => el.remove());
          layer.appendChild(el);
        },
        onToast: (text) => {
          setToast({ text, id: Date.now() });
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => setToast(null), 1800);
        },
      });
    } catch (e) {
      console.error(e);
      setError('当前浏览器无法启动 WebGL，游戏无法运行。');
      return;
    }
    gameRef.current = game;
    window.__game = game; // 方便调试
    return () => {
      clearTimeout(toastTimer);
      game.dispose();
    };
  }, []);

  const start = useCallback(() => gameRef.current?.start(), []);
  const toggleMute = () => {
    const m = !muted;
    sfx.setMuted(m);
    setMuted(m);
  };

  const playing = phase === 'playing' || phase === 'paused' || phase === 'dying';

  return (
    <div className={`stage phase-${phase}`}>
      <canvas ref={canvasRef} className="canvas" />
      <div ref={fxRef} className="fx" />
      {phase === 'dying' && <div className="flash" />}

      {playing && (
        <div className="hud">
          <div className="hud-left">
            <div className="score" data-testid="score">{hud.score}</div>
            <div className="meters">{hud.meters} m</div>
          </div>
          <div className="hud-right">
            <div className="fish-count" key={hud.fish} data-testid="fish">🐟 {hud.fish}</div>
            <div className="btns">
              <button className="icon-btn" onClick={toggleMute} aria-label="静音">{muted ? '🔇' : '🔊'}</button>
              <button className="icon-btn" onClick={() => gameRef.current?.pause()} aria-label="暂停"><span className="pause-ico" /></button>
            </div>
          </div>
          <div className="speed">
            <span>速度</span>
            <div className="speed-bar"><i style={{ width: `${Math.round(8 + hud.speed * 92)}%` }} /></div>
          </div>
        </div>
      )}

      {toast && <div className="toast" key={toast.id}>{toast.text}</div>}

      {phase === 'menu' && !error && (
        <div className="overlay menu">
          <div className="title-block">
            <div className="tag">下班时间到 · 3D 跑酷</div>
            <h1><span>橘猫</span>逃离办公室</h1>
            <p>老板又要加班？冲出走廊，顺路把小鱼干都带走！</p>
          </div>
          <div className="menu-bottom">
            {best > 0 && <div className="best">最高分 {best}</div>}
            <button className="primary" onClick={start} data-testid="start">开始逃跑</button>
            <div className="help">
              {isTouch ? (
                <><b>左右滑</b> 换道　<b>上滑 / 轻点</b> 跳跃　<b>下滑</b> 速降</>
              ) : (
                <><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> 换道　<kbd>空格</kbd> / <kbd>↑</kbd> 跳跃　<kbd>↓</kbd> 速降　<kbd>P</kbd> 暂停</>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <div className="overlay dim">
          <div className="card">
            <h2>休息一下</h2>
            <button className="primary" onClick={() => gameRef.current?.resume()}>继续逃跑</button>
            <button className="ghost" onClick={start}>重新开始</button>
          </div>
        </div>
      )}

      {phase === 'over' && result && (
        <div className="overlay dim">
          <div className="card over">
            {result.isNew && <div className="badge">新纪录！</div>}
            <h2>被抓回去加班了…</h2>
            {result.killer && <p className="reason">一头撞上了<b>{result.killer}</b></p>}
            <div className="big" data-testid="final-score">{result.score}</div>
            <div className="stats">
              <div><span>距离</span><b>{result.meters} m</b></div>
              <div><span>小鱼</span><b>🐟 {result.fish}</b></div>
              <div><span>最高分</span><b>{result.best}</b></div>
            </div>
            <button className="primary" onClick={start} data-testid="restart">再逃一次</button>
            <div className="help small">{isTouch ? '点击按钮重新开始' : '按 空格 / 回车 重新开始'}</div>
          </div>
        </div>
      )}

      {error && <div className="overlay dim"><div className="card"><h2>无法启动</h2><p>{error}</p></div></div>}
    </div>
  );
}
