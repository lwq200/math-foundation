<script setup lang="ts">
/**
 * GradientDescentCanvas —— 梯度下降路径 交互 画布（仅客户端）
 *
 * 教学点：f(x,y) = x² + 9y²（椭圆抛物面，等高线是椭圆簇）。
 * 读者拖 η（学习率）滑杆，用「走一步/走 10 步」逐步观察迭代轨迹：
 *  - η 合适：逐点沿负梯度下山，逼近谷底 (0,0)
 *  - η 偏大：y 方向（梯度 18y，更陡）先发散——体会"越大越快但会炸"
 *  - η 偏小：龟速逼近
 * 铁律：**先逐点看轨迹，再谈收敛**——步进按钮保证不吞推导、不闪现终点。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

const boardEl = ref<HTMLDivElement | null>(null)

// 当前点 / 轨迹 / 步数 / 状态
const cur = ref<[number, number]>([1.5, 1.5])
const path = ref<[number, number][]>([[1.5, 1.5]])
const steps = ref(0)
const state = ref<'iter' | 'done' | 'diverged'>('iter')
const etaVal = ref(0.06)
const fx = (x: number, y: number) => x * x + 9 * y * y

let JXG: any = null
let board: any = null
let startPt: any = null
let trace: any = null
let etaSlider: any = null
let darkObserver: MutationObserver | null = null

// 等高线椭圆：c = 1,2,4,8 → 半轴 √c 与 √c/3
const LEVELS = [1, 2, 4, 8]

function resetAll() {
  steps.value = 0
  state.value = 'iter'
  if (startPt) {
    cur.value = [startPt.X(), startPt.Y()]
  } else {
    cur.value = [1.5, 1.5]
  }
  path.value = [[...cur.value]]
  rebuildTrace()
}

function rebuildTrace() {
  if (!board) return
  if (trace) board.removeObject(trace)
  const pts = path.value.map(([x, y]) => [x, y])
  if (pts.length >= 2) {
    trace = board.create('polygonalchain', [pts], {
      strokeColor: '#c9a227',
      strokeWidth: 2.4,
      fillColor: 'none',
      withLabel: false,
    })
  }
}

function stepN(n: number) {
  if (!board) return
  if (state.value === 'done' || state.value === 'diverged') return
  const eta = etaSlider.Value()
  for (let k = 0; k < n; k++) {
    const [x, y] = cur.value
    // 负梯度：−∇f = (−2x, −18y)
    const nx = x - eta * 2 * x
    const ny = y - eta * 18 * y
    cur.value = [nx, ny]
    path.value.push([nx, ny])
    steps.value++
    if (Math.abs(nx) < 0.01 && Math.abs(ny) < 0.01) {
      state.value = 'done'
      break
    }
    if (Math.abs(nx) > 4 || Math.abs(ny) > 4) {
      state.value = 'diverged'
      break
    }
  }
  rebuildTrace()
}

async function buildBoard() {
  if (!boardEl.value) return
  const jsxg = await import('jsxgraph')
  JXG = jsxg.default ?? jsxg.JXG

  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [-3, 3.2, 3, -3.2],
    axis: true,
    grid: true,
    pan: { needTwoFingers: false },
    zoom: { factorX: 1.4, factorY: 1.4 },
    dark: typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
    color: {
      axis: 'var(--vp-c-text-3)',
      grid: 'var(--vp-c-divider)',
      background: 'transparent',
      foreground: 'var(--vp-c-text-1)',
      highlight: '#42b883',
      border: 'var(--vp-c-divider)',
    },
  })

  // 等高线椭圆簇（辅助灰绿）
  LEVELS.forEach((c) => {
    const rx = Math.sqrt(c)
    const ry = Math.sqrt(c) / 3
    board.create('curve', [
      (t: number) => rx * Math.cos(t),
      (t: number) => ry * Math.sin(t),
      0, 2 * Math.PI,
    ], {
      strokeColor: '#7a8780',
      strokeWidth: 1.2,
      strokeDasharray: [5, 4],
      withLabel: false,
    })
  })

  // 起点（可拖动）
  startPt = board.create('point', [1.5, 1.5], {
    name: '起点',
    size: 3,
    color: '#2f6f4f',
    face: 'circle',
    fixed: false,
  })
  startPt.on('drag', () => {
    // 拖动起点即重置轨迹
    cur.value = [startPt.X(), startPt.Y()]
    path.value = [[...cur.value]]
    steps.value = 0
    state.value = 'iter'
    rebuildTrace()
  })

  // η 滑杆：0.01 ~ 0.25（>0.25 时 y 方向必发散，留给读者自己试）
  etaSlider = board.create('slider', [
    [-2.7, 2.9], [2.1, 2.9], [0.01, 0.06, 0.25],
  ], { name: 'η', snapWidth: 0.01, strokeColor: '#c9a227', fillColor: '#e0b84c' })
  etaSlider.on('drag', () => {
    etaVal.value = etaSlider.Value()
  })

  resetAll()

  if (typeof MutationObserver !== 'undefined') {
    darkObserver = new MutationObserver(() => {
      if (!board) return
      const isDark = document.documentElement.classList.contains('dark')
      board.setAttribute({ dark: isDark })
    })
    darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  }
}

onMounted(async () => {
  await buildBoard()
})

onBeforeUnmount(() => {
  darkObserver?.disconnect()
  darkObserver = null
  if (board && typeof board.cleanUp === 'function') {
    board.cleanUp()
    board = null
  }
})
</script>

<template>
  <div class="gd-canvas">
    <div class="gd-readout">
      <span>η = {{ etaVal.toFixed(2) }}</span>
      <span>步数 = {{ steps }}</span>
      <span>当前点 ({{ cur[0].toFixed(3) }}, {{ cur[1].toFixed(3) }})</span>
      <span>f = {{ fx(cur[0], cur[1]).toFixed(4) }}</span>
      <span class="gd-state" :class="state">
        {{ state === 'iter' ? '迭代中…' : state === 'done' ? '✓ 到达谷底' : '✗ 发散！η 太大' }}
      </span>
    </div>

    <div class="gd-buttons">
      <button class="gd-btn" @click="stepN(1)">走 1 步</button>
      <button class="gd-btn" @click="stepN(10)">走 10 步</button>
      <button class="gd-btn" @click="resetAll">重置</button>
    </div>

    <div ref="boardEl" class="gd-board" />

    <div class="gd-hint">
      <p><strong>怎么玩（先 0.06，再试大/小）：</strong></p>
      <ol>
        <li>η = 0.06，点「走 1 步」连点几下：金色轨迹<b>逐点</b>沿负梯度下山（等高线是椭圆，轨迹近似垂直穿越）。</li>
        <li>把 <strong>η 调到 0.2</strong> 再重置走几步：y 方向（梯度 18y 更陡）先震荡发散——<strong>学习率过大 → 过冲 → 发散</strong>。</li>
        <li>把 <strong>η 调到 0.01</strong> 重置：能收敛但极慢（龟速），体会"太小则浪费步数"。</li>
        <li>拖动绿色「起点」可换起点。先看清每一步怎么走，再谈收敛——<strong>这就是梯度下降：每一步都朝最陡的下坡方向迈一小步</strong>。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.gd-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.gd-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8em 1em;
  align-items: center;
  margin-bottom: 0.5em;
  font-size: 0.88em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
}
.gd-state { margin-left: auto; font-weight: 600; }
.gd-state.iter { color: var(--vp-c-brand-1); }
.gd-state.done { color: #2f6f4f; }
.gd-state.diverged { color: #b3382c; }
.dark .gd-state.done { color: #5fd0a0; }
.dark .gd-state.diverged { color: #e06a5c; }
.gd-buttons {
  display: flex;
  gap: 0.6em;
  margin-bottom: 0.6em;
}
.gd-btn {
  border: 1px solid var(--vp-c-brand-2);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
  padding: 0.25em 1em;
  cursor: pointer;
  font-size: 0.9em;
  transition: background 0.2s ease;
}
.gd-btn:hover {
  background: var(--vp-c-brand-soft);
}
.gd-board {
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
}
.gd-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.gd-hint ol {
  margin: 0.2em 0 0 1.3em;
  padding: 0;
}
.gd-hint li {
  margin: 0.15em 0;
}
@media (max-width: 640px) {
  .gd-board { height: 320px; }
}
</style>
