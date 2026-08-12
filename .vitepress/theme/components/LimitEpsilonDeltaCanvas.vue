<script setup lang="ts">
/**
 * LimitEpsilonDeltaCanvas —— ε-δ 极限交互 画布（仅客户端）
 *
 * 教学点：lim_{x→2} x² = 4。读者拖 ε 滑杆（横带 y∈(L−ε, L+ε)）与
 * δ 滑杆（竖带 x∈(a−δ, a+δ)），实时看到「曲线是否穿出横带」——
 * 这正是「任意 ε 都要存在够用的 δ」的几何化：δ 不够小 → 曲线穿出；
 * δ 够小 → 全部落在带内。先拖 δ 从大到小，体会"反解 δ"的必要性。
 *
 * SSR 安全：jsxgraph 仅 onMounted 动态 import；ref 容器避免 id 冲突。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
// 静态引入 jsxgraph：使其进入页面 chunk 的静态依赖图（构建时自动 modulepreload），避免纯动态 import 被浏览器调度排后
import JXG from 'jsxgraph'

const boardEl = ref<HTMLDivElement | null>(null)

const A = 2 // 考察点 a
const L = 4 // 极限值 L = a²

// 读数
const epsVal = ref(0.8)
const deltaVal = ref(1.2)
const statusText = ref<'out' | 'in'>('out')
const minDelta = ref(0.05)

let board: any = null
let curve: any = null
let topBand: any = null
let botBand: any = null
let leftBand: any = null
let rightBand: any = null
let epsSlider: any = null
let deltaSlider: any = null
let darkObserver: MutationObserver | null = null

// 采样检查曲线在 [a−δ, a+δ] 上是否全部落在 [L−ε, L+ε] 内
function checkInside(eps: number, delta: number): boolean {
  const N = 60
  for (let i = 0; i <= N; i++) {
    const x = A - delta + (2 * delta * i) / N
    const y = x * x
    if (y < L - eps || y > L + eps) return false
  }
  return true
}

// 满足条件的"够用 δ"参考值：对 f(x)=x² 在 a=2，δ = min(1, ε/5) 是一个充分条件
function enoughDelta(eps: number): number {
  return Math.min(1, eps / 5)
}

function updateBand(eps: number, delta: number) {
  if (!board) return
  const x0 = A - 3.4, x1 = A + 3.4 // 水平带在 x 方向延伸范围
  const y0 = L - 2.5, y1 = L + 2.5 // 垂直带在 y 方向延伸范围
  topBand.setPosition(JXG.COORDS_BY_USER, [[x0, L + eps], [x1, L + eps]])
  botBand.setPosition(JXG.COORDS_BY_USER, [[x0, L - eps], [x1, L - eps]])
  leftBand.setPosition(JXG.COORDS_BY_USER, [[A - delta, y0], [A - delta, y1]])
  rightBand.setPosition(JXG.COORDS_BY_USER, [[A + delta, y0], [A + delta, y1]])
}

function refresh() {
  const eps = epsSlider.Value()
  const delta = deltaSlider.Value()
  epsVal.value = eps
  deltaVal.value = delta
  updateBand(eps, delta)
  statusText.value = checkInside(eps, delta) ? 'in' : 'out'
  minDelta.value = enoughDelta(eps)
}

function buildBoard() {
  if (!boardEl.value) return
  // bbox：x∈[−1.4, 5.4]，y∈[−1.5, 6.5]，让 ε 带(≈2~6)与 δ 带(≈0.5~3.5)都可见
  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [-1.4, 6.5, 5.4, -1.5],
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

  // 曲线 f(x) = x²
  curve = board.create('functiongraph', [(x: number) => x * x, -1.4, 5.4], {
    strokeColor: '#42b883',
    strokeWidth: 3,
  })

  // ε 带（水平带 y = L±ε）：淡琥珀填充 + 琥珀虚线边
  topBand = board.create('line', [[-2, L + 0.8], [6, L + 0.8]], {
    strokeColor: '#c9a227', strokeWidth: 1.5, strokeDasharray: [6, 4], fixed: true,
  })
  botBand = board.create('line', [[-2, L - 0.8], [6, L - 0.8]], {
    strokeColor: '#c9a227', strokeWidth: 1.5, strokeDasharray: [6, 4], fixed: true,
  })
  // δ 带（垂直带 x = a±δ）：品牌绿虚线边
  leftBand = board.create('line', [[A - 1.2, -2], [A - 1.2, 7]], {
    strokeColor: '#2f6f4f', strokeWidth: 1.5, strokeDasharray: [6, 4], fixed: true,
  })
  rightBand = board.create('line', [[A + 1.2, -2], [A + 1.2, 7]], {
    strokeColor: '#2f6f4f', strokeWidth: 1.5, strokeDasharray: [6, 4], fixed: true,
  })

  // 考察点 a 与极限点 (a, L)
  board.create('point', [A, L], { name: 'a', size: 3, color: '#b3382c', face: 'circle', fixed: true })

  // ε 滑杆（0.2 ~ 2，步进 0.05）
  epsSlider = board.create('slider', [
    [-1.2, 6.0], [2.6, 6.0], [0.2, 0.8, 2],
  ], { name: 'ε', snapWidth: 0.05, strokeColor: '#c9a227', fillColor: '#e0b84c' })
  epsSlider.on('drag', refresh)

  // δ 滑杆（0.05 ~ 1.5，步进 0.05）
  deltaSlider = board.create('slider', [
    [-1.2, 5.3], [2.6, 5.3], [0.05, 1.2, 1.5],
  ], { name: 'δ', snapWidth: 0.05, strokeColor: '#2f6f4f', fillColor: '#42b883' })
  deltaSlider.on('drag', refresh)

  refresh()

  // 深色模式实时跟随
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
  <div class="eps-canvas">
    <div class="eps-readout">
      <span>ε = {{ epsVal.toFixed(2) }}</span>
      <span>δ = {{ deltaVal.toFixed(2) }}</span>
      <span class="eps-status" :class="statusText === 'in' ? 'ok' : 'bad'">
        {{ statusText === 'in' ? '✓ 曲线全部落在 ε 带内' : '✗ 曲线穿出 ε 带！δ 还不够小' }}
      </span>
    </div>

    <div ref="boardEl" class="eps-board" />

    <div class="eps-hint">
      <p><strong>怎么玩（先拖 δ，再拖 ε）：</strong></p>
      <ol>
        <li>把 <strong>δ</strong> 从大到小拖：一开始曲线（绿）会穿出琥珀横带，提示「δ 还不够小」。</li>
        <li>拖到 <strong>曲线不再穿出</strong>，竖带（绿虚线）内的每一个点，f(x) 都落在 (L−ε, L+ε) 里——这就是「这个 δ 够用」。</li>
        <li>再拖 <strong>ε</strong> 变小（横带变窄）：你又得把 δ 拖得更小。体会「ε 越苛刻，δ 越要小」——极限定义要求的正是：<strong>任意 ε，都存在（依赖 ε 的）够用的 δ</strong>。</li>
        <li>参考：对 f(x)=x² 在 a=2，一个充分条件是 <strong>δ = min(1, ε/5)</strong>（当前 ε 对应 δ ≤ {{ minDelta.toFixed(2) }} 必够用）。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.eps-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.eps-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 1em;
  align-items: center;
  margin-bottom: 0.6em;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
}
.eps-status {
  margin-left: auto;
  font-weight: 600;
}
.eps-status.ok { color: #2f6f4f; }
.eps-status.bad { color: #b3382c; }
.dark .eps-status.ok { color: #5fd0a0; }
.dark .eps-status.bad { color: #e06a5c; }
.eps-board {
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
}
.eps-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.eps-hint ol {
  margin: 0.2em 0 0 1.3em;
  padding: 0;
}
.eps-hint li {
  margin: 0.15em 0;
}
@media (max-width: 640px) {
  .eps-board { height: 320px; }
}
</style>
