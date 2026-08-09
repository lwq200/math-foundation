<script setup lang="ts">
/**
 * NormalDistSliderCanvas —— 正态分布 μ/σ 交互 画布（仅客户端）
 *
 * 教学点：f(x) = exp(−(x−μ)²/(2σ²)) / (σ√(2π))。
 *  - μ 滑杆：钟形左右平移
 *  - σ 滑杆：σ 小→又尖又高（峰值 1/(σ√2π) 大），σ 大→又矮又胖
 *  - 关键：无论怎么拖，曲线下面积恒为 1（PDF 的归一化）——
 *    纵轴不是概率，是"密度"；概率是"面积"。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

const boardEl = ref<HTMLDivElement | null>(null)

const muVal = ref(0)
const sigmaVal = ref(1)
const peakVal = ref(0.4)
const xmVal = ref(0)
const fmVal = ref(0)

let JXG: any = null
let board: any = null
let curve: any = null
let muSlider: any = null
let sigmaSlider: any = null
let xMarker: any = null
let darkObserver: MutationObserver | null = null

const pdf = (x: number, mu: number, sigma: number) =>
  Math.exp(-((x - mu) * (x - mu)) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI))

function rebuildCurve() {
  if (!board) return
  const mu = muSlider.Value()
  const sigma = sigmaSlider.Value()
  board.removeObject(curve)
  curve = board.create('functiongraph', [(x: number) => pdf(x, mu, sigma), -8, 8], {
    strokeColor: '#2f6f4f',
    strokeWidth: 3,
  })
  // μ 处的标记点
  if (xMarker) board.removeObject(xMarker)
  xMarker = board.create('point', [mu, pdf(mu, mu, sigma)], {
    name: 'μ', size: 3, color: '#b3382c', face: 'circle', fixed: true,
  })
  // 读数
  muVal.value = mu
  sigmaVal.value = sigma
  peakVal.value = pdf(mu, mu, sigma)
  xmVal.value = mu
  fmVal.value = pdf(mu, mu, sigma)
}

async function buildBoard() {
  if (!boardEl.value) return
  const jsxg = await import('jsxgraph')
  JXG = jsxg.default ?? jsxg.JXG

  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [-8, 1.5, 8, -0.2],
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

  muSlider = board.create('slider', [
    [-7, 1.3], [-1, 1.3], [-3, 0, 3],
  ], { name: 'μ', snapWidth: 0.1, strokeColor: '#2f6f4f', fillColor: '#42b883' })
  muSlider.on('drag', rebuildCurve)

  sigmaSlider = board.create('slider', [
    [-7, 1.0], [-1, 1.0], [0.3, 1, 2],
  ], { name: 'σ', snapWidth: 0.05, strokeColor: '#c9a227', fillColor: '#e0b84c' })
  sigmaSlider.on('drag', rebuildCurve)

  rebuildCurve()

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
  <div class="nds-canvas">
    <div class="nds-readout">
      <span>μ = {{ muVal.toFixed(2) }}</span>
      <span>σ = {{ sigmaVal.toFixed(2) }}</span>
      <span>峰值 f(μ) = {{ peakVal.toFixed(4) }}</span>
      <span class="nds-area">曲线下面积恒 = 1（PDF 归一化）</span>
    </div>

    <div ref="boardEl" class="nds-board" />

    <div class="nds-hint">
      <p><strong>怎么玩：</strong></p>
      <ol>
        <li>拖 <strong>μ</strong>：钟形整体左右平移（形状不变）。</li>
        <li>拖 <strong>σ</strong> 变小：钟形变高变瘦——峰值 1/(σ√2π) 增大；拖大则变矮变胖。但<b>面积始终是 1</b>：变高是因为"挤瘦了"，不是概率变多。</li>
        <li>这就是 PDF 纵轴的真相：<b>纵轴是密度（单位 x 上的概率质量），不是概率</b>。概率永远是曲线下的<b>面积</b>。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.nds-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.nds-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 1em;
  align-items: center;
  margin-bottom: 0.6em;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
}
.nds-area {
  margin-left: auto;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.nds-board {
  width: 100%;
  height: 380px;
  border-radius: 8px;
  overflow: hidden;
}
.nds-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.nds-hint ol {
  margin: 0.2em 0 0 1.3em;
  padding: 0;
}
.nds-hint li {
  margin: 0.15em 0;
}
@media (max-width: 640px) {
  .nds-board { height: 300px; }
}
</style>
