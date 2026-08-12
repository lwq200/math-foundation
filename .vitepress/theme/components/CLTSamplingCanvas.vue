<script setup lang="ts">
/**
 * CLTSamplingCanvas —— 中心极限定理 交互 画布（仅客户端）
 *
 * 教学点：从 U(0,1) 抽 n 个数的均值，重复采样画直方图。
 *  - 总体是"平平的"均匀分布（PDF 是一条水平线）
 *  - 但样本均值 X̄ 的分布随 n 增大越来越像正态钟形 N(0.5, √(1/(12n)))
 *  - 滑块 n 控制"每次抽几个数求和再平均"，体现求和/均值必成正态
 * 铁律：先看 n 小时的歪斜形状，再增大 n 看它"长脸"——过程可见。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
// 静态引入 jsxgraph：使其进入页面 chunk 的静态依赖图（构建时自动 modulepreload），避免纯动态 import 被浏览器调度排后
import JXG from 'jsxgraph'

const boardEl = ref<HTMLDivElement | null>(null)

const NBINS = 30
const BINW = 1 / NBINS
const nVal = ref(5)
const totalSamples = ref(200)
const theoSigma = ref(0.1291)

let board: any = null
let counts: number[] = new Array(NBINS).fill(0)
let bars: any[] = []
let normCurve: any = null
let nSlider: any = null
let darkObserver: MutationObserver | null = null

const normPdf = (x: number, mu: number, sigma: number) =>
  Math.exp(-((x - mu) * (x - mu)) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI))

function drawBars() {
  if (!board) return
  bars.forEach((b) => board.removeObject(b))
  bars = []
  const maxC = Math.max(...counts, 1)
  for (let i = 0; i < NBINS; i++) {
    const x0 = i * BINW
    const x1 = x0 + BINW
    const h = (counts[i] / totalSamples.value / BINW) // 概率密度
    bars.push(board.create('polygon', [
      [x0, 0], [x0, h], [x1, h], [x1, 0],
    ], {
      fillColor: '#42b883', fillOpacity: 0.55,
      strokeColor: '#2f6f4f', strokeWidth: 0.5, fixed: true,
    }))
  }
}

function drawNorm() {
  if (!board) return
  board.removeObject(normCurve)
  const n = nSlider.Value()
  const sigma = Math.sqrt(1 / (12 * n))
  normCurve = board.create('functiongraph', [(x: number) => normPdf(x, 0.5, sigma), 0, 1], {
    strokeColor: '#b3382c', strokeWidth: 2.5, withLabel: false,
  })
}

function sampleOnce(n: number): number {
  let s = 0
  for (let i = 0; i < n; i++) s += Math.random()
  return s / n
}

function doSample(m: number) {
  const n = nSlider.Value()
  for (let k = 0; k < m; k++) {
    const x = sampleOnce(n)
    const bin = Math.min(NBINS - 1, Math.floor(x / BINW))
    counts[bin]++
  }
  totalSamples.value += m
  const sigma = Math.sqrt(1 / (12 * n))
  theoSigma.value = sigma
  nVal.value = n
  drawBars()
  drawNorm()
}

function resetAll() {
  counts = new Array(NBINS).fill(0)
  totalSamples.value = 0
  const n = nSlider.Value()
  const sigma = Math.sqrt(1 / (12 * n))
  theoSigma.value = sigma
  nVal.value = n
  drawBars()
  drawNorm()
}

function buildBoard() {
  if (!boardEl.value) return
  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [0, 8.2, 1, -0.2],
    axis: true,
    grid: false,
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

  // 总体分布 U(0,1)：水平线 y=1（密度）
  board.create('line', [[0, 1], [1, 1]], {
    strokeColor: 'var(--vp-c-text-3)', strokeWidth: 1.5, strokeDasharray: [6, 4], withLabel: false,
  })
  board.create('text', [0.02, 1.15, '总体 U(0,1)（水平线=均匀）'], {
    fontSize: 11, color: 'var(--vp-c-text-2)', anchorX: 'left',
  })

  nSlider = board.create('slider', [
    [0.02, 8.0], [0.7, 8.0], [1, 5, 40],
  ], { name: 'n', snapWidth: 1, strokeColor: '#2f6f4f', fillColor: '#42b883' })
  nSlider.on('drag', () => {
    resetAll()
    doSample(200)
  })

  doSample(200)

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
  <div class="clt-canvas">
    <div class="clt-readout">
      <span>n = {{ nVal }}（每次抽 n 个数取均值）</span>
      <span>已采样均值数 = {{ totalSamples }}</span>
      <span>理论 σ = √(1/12n) = {{ theoSigma.toFixed(4) }}</span>
    </div>

    <div class="clt-buttons">
      <button class="clt-btn" @click="doSample(200)">再采 200 次</button>
      <button class="clt-btn" @click="resetAll()">重置</button>
    </div>

    <div ref="boardEl" class="clt-board" />

    <div class="clt-hint">
      <p><strong>怎么玩：</strong></p>
      <ol>
        <li>把 <strong>n</strong> 从 1 慢慢拖大：绿色直方图（样本均值的分布）从"一坨"慢慢<b>长成钟形</b>，红色曲线是理论正态 N(0.5, √(1/12n))——两者越贴越近。</li>
        <li>注意总体 U(0,1) 是<b>水平线</b>（均匀、一点不钟），但样本均值却长出钟形脸——这就是中心极限定理：<b>大量独立同分布随机量的求和/均值必成正态</b>。</li>
        <li>点「再采 200 次」让直方图更光滑；理论 σ 随 n 增大而变小（钟形变高变窄）。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.clt-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.clt-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 1em;
  align-items: center;
  margin-bottom: 0.5em;
  font-size: 0.88em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
}
.clt-buttons {
  display: flex;
  gap: 0.6em;
  margin-bottom: 0.6em;
}
.clt-btn {
  border: 1px solid var(--vp-c-brand-2);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
  padding: 0.2em 0.9em;
  cursor: pointer;
  font-size: 0.88em;
  transition: background 0.2s ease;
}
.clt-btn:hover { background: var(--vp-c-brand-soft); }
.clt-board {
  width: 100%;
  height: 380px;
  border-radius: 8px;
  overflow: hidden;
}
.clt-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.clt-hint ol {
  margin: 0.2em 0 0 1.3em;
  padding: 0;
}
.clt-hint li { margin: 0.15em 0; }
@media (max-width: 640px) {
  .clt-board { height: 300px; }
}
</style>
