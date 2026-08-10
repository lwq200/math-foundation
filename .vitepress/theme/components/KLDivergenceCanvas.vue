<script setup lang="ts">
/**
 * KLDivergenceCanvas —— KL 散度不对称 交互 画布（仅客户端）
 *
 * 教学点：拖 P、Q 两个三桶分布的高度（相对权重），自动归一化成概率，
 * 实时显示 KL(P‖Q) 与 KL(Q‖P)。
 *  - KL(P‖Q) = Σ pᵢ·log₂(pᵢ/qᵢ)（用 log₂ 以"比特"计）
 *  - 关键：KL(P‖Q) ≠ KL(Q‖P)——方向敏感，因为加权分布不同
 *  - 陷阱提示：P=[0.7,0.3]、Q=[0.3,0.7] 这类"完全互换"会巧合相等，
 *    要用形状不同的分布才能看出不对称。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

const boardEl = ref<HTMLDivElement | null>(null)

const klPQ = ref(0)
const klQP = ref(0)
const pProb = ref('0.33, 0.33, 0.33')
const qProb = ref('0.33, 0.33, 0.33')

// 桶位置：P 在左半（x≈0.6/1.4/2.2），Q 在右半（x≈3.4/4.2/5.0）
const PX = [0.6, 1.4, 2.2]
const QX = [3.4, 4.2, 5.0]
const BARW = 0.34
const YMIN = 0.05
const YMAX = 1.1

let JXG: any = null
let board: any = null
let pPts: any[] = []
let qPts: any[] = []
let bars: any[] = []
let darkObserver: MutationObserver | null = null

function normalize(w: number[]): number[] {
  const s = w.reduce((a, b) => a + b, 0)
  return s > 0 ? w.map((x) => x / s) : w.map(() => 0)
}

function kl(p: number[], q: number[]): number {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 0 && q[i] > 0) s += p[i] * Math.log2(p[i] / q[i])
    else if (p[i] > 0 && q[i] <= 0) return Infinity
  }
  return s
}

function rebuild() {
  if (!board) return
  const pw = pPts.map((pt) => Math.max(pt.Y(), 0.02))
  const qw = qPts.map((pt) => Math.max(pt.Y(), 0.02))
  const p = normalize(pw)
  const q = normalize(qw)

  klPQ.value = kl(p, q)
  klQP.value = kl(q, p)
  pProb.value = p.map((x) => x.toFixed(2)).join(', ')
  qProb.value = q.map((x) => x.toFixed(2)).join(', ')

  // 重建条形
  bars.forEach((bar) => board.removeObject(bar))
  bars = []
  const draw = (xs: number[], w: number[], color: string) => {
    for (let i = 0; i < xs.length; i++) {
      const x0 = xs[i] - BARW / 2
      const x1 = xs[i] + BARW / 2
      const h = Math.max(w[i] * YMAX, 0.02)
      bars.push(board.create('polygon', [
        [x0, 0], [x0, h], [x1, h], [x1, 0],
      ], {
        fillColor: color, fillOpacity: 0.5,
        strokeColor: color, strokeWidth: 1, fixed: true,
      }))
    }
  }
  draw(PX, p, '#2f6f4f')
  draw(QX, q, '#c9a227')
}

async function buildBoard() {
  if (!boardEl.value) return
  const jsxg = await import('jsxgraph')
  JXG = jsxg.default ?? jsxg.JXG

  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [0.1, 1.35, 5.7, -0.25],
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

  // 基线
  board.create('line', [[0.1, 0], [5.7, 0]], {
    strokeColor: 'var(--vp-c-text-3)', strokeWidth: 1, withLabel: false,
  })
  // 分隔线：P | Q
  board.create('line', [[2.8, -0.2], [2.8, 1.3]], {
    strokeColor: 'var(--vp-c-divider)', strokeWidth: 1.5, strokeDasharray: [4, 3], withLabel: false,
  })
  // 标签
  board.create('text', [0.8, 1.22, 'P（绿色）'], { fontSize: 13, color: '#2f6f4f' })
  board.create('text', [3.4, 1.22, 'Q（金色）'], { fontSize: 13, color: '#c9a227' })

  // 可拖点（控制桶高）
  const mk = (xs: number[], col: string) =>
    xs.map((x, i) => {
      const pt = board.create('point', [x, 0.35 + i * 0.08], {
        name: '', size: 3, color: col, face: 'circle', fixed: false, withLabel: false,
      })
      pt.on('drag', rebuild)
      return pt
    })
  pPts = mk(PX, '#2f6f4f')
  qPts = mk(QX, '#c9a227')

  rebuild()

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
  <div class="kl-canvas">
    <div class="kl-readout">
      <span class="kl-big">KL(P‖Q) = {{ klPQ === Infinity ? '∞' : klPQ.toFixed(3) }} 比特</span>
      <span class="kl-big">KL(Q‖P) = {{ klQP === Infinity ? '∞' : klQP.toFixed(3) }} 比特</span>
      <span class="kl-trap">⚠ 两者通常不相等——方向敏感</span>
    </div>
    <div class="kl-prob">
      <span>P 概率 = {{ pProb }}</span>
      <span>Q 概率 = {{ qProb }}</span>
    </div>

    <div ref="boardEl" class="kl-board" />

    <div class="kl-hint">
      <p><strong>怎么玩：</strong></p>
      <ol>
        <li>拖绿色的 3 个点调整 P，金色 3 个点调整 Q（高度自动归一化成概率）。</li>
        <li>把 P 拖得"集中"（一高两低）、Q 拖得"平均"：两个 KL 值<b>不一样大</b>——KL(P‖Q) 用 P 加权（P 大处差多少），KL(Q‖P) 用 Q 加权。</li>
        <li>陷阱：把 P、Q 高度<b>完全互换</b>（P=[3,1] Q=[1,3] 这种）会巧合相等。换成形状不同的分布（如一个尖一个平）才能看出不对称。</li>
        <li>含义：KL(P‖Q) = 用 Q 冒充 P 时，多花的比特数。<b>"冒充哪个、用谁做基准"决定了数字。</b></li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.kl-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.kl-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 1em;
  align-items: center;
  margin-bottom: 0.4em;
  font-size: 0.95em;
  font-variant-numeric: tabular-nums;
}
.kl-big { font-weight: 600; color: var(--vp-c-brand-1); }
.kl-trap {
  margin-left: auto;
  font-size: 0.85em;
  color: #b3382c;
}
.dark .kl-trap { color: #e06a5c; }
.kl-prob {
  display: flex;
  flex-wrap: wrap;
  gap: 1em;
  font-size: 0.85em;
  color: var(--vp-c-text-2);
  margin-bottom: 0.5em;
  font-variant-numeric: tabular-nums;
}
.kl-board {
  width: 100%;
  height: 360px;
  border-radius: 8px;
  overflow: hidden;
}
.kl-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.kl-hint ol {
  margin: 0.2em 0 0 1.3em;
  padding: 0;
}
.kl-hint li { margin: 0.15em 0; }
@media (max-width: 640px) {
  .kl-board { height: 300px; }
}
</style>
