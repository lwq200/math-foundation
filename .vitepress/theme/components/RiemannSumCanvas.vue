<script setup lang="ts">
/**
 * RiemannSumCanvas —— 黎曼和 → 定积分 交互 画布（仅客户端）
 *
 * 教学点：∫₀² x² dx = 8/3。读者拖 n 滑杆（1→32），看到分割矩形
 * 越切越细、左/右/中点三种和同时逼近真值。铁律：矩形条必须可见
 * （不直接填充成光滑面积）——「切碎求和」的过程要看得见。
 *
 * 画布默认画「中点」矩形（半透明绿），读数同时显示 L(n)/R(n)/M(n) 与真值。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
// 静态引入 jsxgraph：使其进入页面 chunk 的静态依赖图（构建时自动 modulepreload），避免纯动态 import 被浏览器调度排后
import JXG from 'jsxgraph'

const boardEl = ref<HTMLDivElement | null>(null)

const A = 0
const B = 2
const EXACT = 8 / 3 // ∫₀² x² dx

// 读数
const nVal = ref(8)
const sumL = ref(0)
const sumR = ref(0)
const sumM = ref(0)
const errM = ref(0)

let board: any = null
let curve: any = null
let rects: any[] = []
let nSlider: any = null
let darkObserver: MutationObserver | null = null

const f = (x: number) => x * x

// 三种黎曼和
function leftSum(n: number): number {
  let s = 0
  for (let i = 0; i < n; i++) s += f(A + ((B - A) * i) / n)
  return (s * (B - A)) / n
}
function rightSum(n: number): number {
  let s = 0
  for (let i = 1; i <= n; i++) s += f(A + ((B - A) * i) / n)
  return (s * (B - A)) / n
}
function midSum(n: number): number {
  let s = 0
  for (let i = 0; i < n; i++) s += f(A + ((B - A) * (i + 0.5)) / n)
  return (s * (B - A)) / n
}

function rebuildRects(n: number) {
  if (!board) return
  // 清空旧矩形
  rects.forEach((r) => board.removeObject(r))
  rects = []
  const w = (B - A) / n
  for (let i = 0; i < n; i++) {
    const x0 = A + w * i
    const x1 = x0 + w
    const midX = x0 + w / 2
    const h = f(midX)
    const rect = board.create('polygon', [
      [x0, 0], [x0, h], [x1, h], [x1, 0],
    ], {
      fillColor: '#42b883',
      fillOpacity: 0.28,
      borders: { strokeColor: '#2f6f4f', strokeWidth: 1.2 },
      fixed: true,
    })
    rects.push(rect)
  }
}

function refresh() {
  const n = nSlider.Value()
  nVal.value = n
  const l = leftSum(n)
  const r = rightSum(n)
  const m = midSum(n)
  sumL.value = l
  sumR.value = r
  sumM.value = m
  errM.value = Math.abs(m - EXACT)
  rebuildRects(n)
}

function buildBoard() {
  if (!boardEl.value) return
  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [-0.4, 5.2, 2.6, -0.6],
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

  curve = board.create('functiongraph', [f, -0.4, 2.6], {
    strokeColor: '#2f6f4f',
    strokeWidth: 3,
  })

  // 真值参考线 y = 8/3 ≈ 2.667
  board.create('line', [[-0.4, EXACT], [2.6, EXACT]], {
    strokeColor: '#b3382c', strokeWidth: 1, strokeDasharray: [6, 4], fixed: true, withLabel: false,
  })

  nSlider = board.create('slider', [
    [-0.3, 4.6], [1.8, 4.6], [1, 8, 32],
  ], { name: 'n', snapWidth: 1, strokeColor: '#2f6f4f', fillColor: '#42b883' })
  nSlider.on('drag', refresh)

  refresh()

  if (typeof MutationObserver !== 'undefined') {
    darkObserver = new MutationObserver(() => {
      if (!board) return
      const isDark = document.documentElement.classList.contains('dark')
      board.setAttribute({ dark: isDark })
    })
    darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  }
}

onMounted(() => {
  buildBoard()
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
  <div class="riemann-canvas">
    <div class="riemann-readout">
      <span>n = {{ nVal }}</span>
      <span>左和 L(n) = {{ sumL.toFixed(4) }}</span>
      <span>右和 R(n) = {{ sumR.toFixed(4) }}</span>
      <span class="riemann-m">中点 M(n) = {{ sumM.toFixed(4) }}</span>
      <span>真值 = 8/3 ≈ 2.6667</span>
      <span class="riemann-err">|M(n) − 真值| = {{ errM.toFixed(4) }}</span>
    </div>

    <div ref="boardEl" class="riemann-board" />

    <div class="riemann-hint">
      <p><strong>怎么玩：</strong></p>
      <ol>
        <li>把 <strong>n</strong> 滑杆从 1 慢慢拖大：绿色矩形把 [0,2] 越切越细，左/右/中点三种和同时靠近红线（真值 8/3）。</li>
        <li>注意左和一直比真值小、右和一直比真值大——<strong>左/右夹住真值</strong>，中点最稳。这就是「切得越细越收敛」的直观：定积分 = 这些和当 n→∞ 的极限。</li>
        <li>拖到 n=32：|M(n) − 真值| 已经很小。别只盯着数值，<strong>看矩形条本身</strong>——面积是被「切碎再求和」攒出来的，不是一眼看出来的。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.riemann-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.riemann-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8em 1em;
  align-items: center;
  margin-bottom: 0.6em;
  font-size: 0.88em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
}
.riemann-m { font-weight: 600; color: var(--vp-c-brand-1); }
.riemann-err { margin-left: auto; color: var(--vp-c-text-2); }
.riemann-board {
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
}
.riemann-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.riemann-hint ol {
  margin: 0.2em 0 0 1.3em;
  padding: 0;
}
.riemann-hint li {
  margin: 0.15em 0;
}
@media (max-width: 640px) {
  .riemann-board { height: 320px; }
}
</style>
