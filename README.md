# 橘猫逃离办公室 🐈

React + Vite + Three.js 的 3D 跑酷小游戏。

```bash
npm install
npm run dev      # 打开 http://localhost:5173 ；手机连同一 Wi-Fi 访问终端里打印的 Network 地址
npm test         # 无头逻辑测试（碰撞 / 计分 / 提速 / 自动驾驶通关）
npm run build    # 产出 dist/
```

## 操作

| | 电脑 | 手机 |
|---|---|---|
| 换道 | ← → / A D | 左右滑 |
| 跳跃 | 空格 / ↑ / W | 上滑或轻点 |
| 速降 | ↓ / S | 下滑 |
| 暂停 | P / Esc | 右上角按钮 |

矮的障碍（纸箱、打印机、扫地机器人）可以跳过去；高的（文件柜、饮水机、工位隔板）只能绕。

## 结构

- `src/game/sim.js` 玩法规则（纯逻辑，不依赖 Three.js，可单测）
- `src/game/Game.js` 渲染、输入、状态机
- `src/game/cat.js` 橘猫模型与动画
- `src/game/world.js` 办公室场景、障碍物、小鱼、粒子
- `src/game/audio.js` WebAudio 合成音效
- `src/App.jsx` 菜单 / HUD / 结算界面
