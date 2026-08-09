<script setup lang="ts">
/**
 * CDFExplorerCanvas —— PDF↔CDF 关系 交互 画布（仅客户端）
 *
 * 教学点（标准正态 φ(x)，μ=0, σ=1）：
 *  - F(x) = ∫_{−∞}^{x} φ(t)dt = Φ(x)，拖 x 看阴影面积逐步累积
 *  - F'(x) = φ(x)：CDF 在 x 处的"斜率"就是 PDF 在 x 处的高度
 *  - 面积 vs 高度：概率是面积（F(x)），密度是高度（φ(x)）
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

const boardEl = ref<HTMLDivElement | null>(null)

const xVal = ref(0.5)
const fVal = ref(0.35)
const FVal = ref(0.69)

let JXG: any = null
let board: any = null
let curve: any = null
let shade: any = null
let xLine: any = null
let xSlider: any = null
let darkObserver: MutationObserver | null = null

const phi = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)

// Abramowitz-Stegun 7.1.26：erf 近似（|误差| < 1.5e-7）
function erf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z))
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z)
  return z >= 0 ? y : -y
}
const Phi = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2))

function rebuildShade() {
  if (!board) return
  const x = xSlider.Value()
  xVal.value = x
  fVal.value = phi(x)
  FVal.value = Phi(x)

  // 竖线 x
  if (xLine) xLine.setPosition(JXG.COORDS_BY_USER, [[x, 0.5], [x, 0]])

  // 阴影：从 −3.5 到 x 的 PDF 下面积（采样 44 点 + 收尾）
  board.removeObject(shade)
  const pts: [number, number][] = [[-3.5, 0]]
  const N = 44
  for (let i = 0; i <= N; i++) {
    const t = -3.5 + ((x + 3.5) * i) / N
    pts.push([t, phi(t)])
  }
  pts.push([x, 0])
  // 注意：parents 必须是坐标数组展开（不能再用 [pts] 包一层，
  // 否则 JSXGraph 会把整个数组当单个 point parent，报
  // "Can't create point with parent types 'object'"）。
  shade = board.create('polygon', pts, {
    fillColor: '#42b883',
    fillOpacity: 0.35,
    strokeColor: '#2f6f4f',
    strokeWidth: 0.5,
    fixed: true,
  })
}

async function buildBoard() {
  if (!boardEl.value) return
  const jsxg = await import('jsxgraph')
  JXG = jsxg.default ?? jsxg.JXG

  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [-4, 0.55, 4, -0.15],
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

  // PDF 曲线
  curve = board.create('functiongraph', [phi, -3.5, 3.5], {
    strokeColor: '#2f6f4f',
    strokeWidth: 3,
  })

  // x 处竖线
  xLine = board.create('line', [[0.5, 0.5], [0.5, 0]], {
    strokeColor: '#b3382c', strokeWidth: 1.5, strokeDasharray: [4, 3], fixed: true,
  })

  xSlider = board.create('slider', [
    [-3.5, 0.42], [0.5, 0.42], [-3, 0.5, 3],
  ], { name: 'x', snapWidth: 0.05, strokeColor: '#b3382c', fillColor: '#e06a5c' })
  xSlider.on('drag', rebuildShade)

  rebuildShade()

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
  <div class="cdf-canvas">
    <div class="cdf-readout">
      <span>x = {{ xVal.toFixed(2) }}</span>
      <span>PDF f(x) = φ(x) = {{ fVal.toFixed(4) }}</span>
      <span class="cdf-f">CDF F(x) = Φ(x) = {{ FVal.toFixed(4) }}</span>
    </div>

    <div ref="boardEl" class="cdf-board" />

    <div class="cdf-hint">
      <p><strong>怎么玩：</strong></p>
      <ol>
        <li>拖 <strong>x</strong> 滑杆：绿色阴影 = φ 从 −∞ 累积到 x 的面积，正好是 <b>F(x)=Φ(x)</b>——概率是"面积"。</li>
        <li>看两组数：<b>F(x)</b> 单调从 0 涨到 1（拖到 x=−3 附近≈0，x=+3 附近≈1）。</li>
        <li>关键观察：<b>F'(x) = f(x)</b>——CDF 在 x 处的斜率（变化率）就是 PDF 在 x 处的高度。CDF 是 PDF 的"累积"，PDF 是 CDF 的"导数"。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.cdf-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.cdf-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 1em;
  align-items: center;
  margin-bottom: 0.6em;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
}
.cdf-f {
  margin-left: auto;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.cdf-board {
  width: 100%;
  height: 380px;
  border-radius: 8px;
  overflow: hidden;
}
.cdf-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.cdf-hint ol {
  margin: 0.2em 0 0 1.3em;
  padding: 0;
}
.cdf-hint li {
  margin: 0.15em 0;
}
@media (max-width: 640px) {
  .cdf-board { height: 300px; }
}
</style>
