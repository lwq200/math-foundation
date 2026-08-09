<script setup lang="ts">
/**
 * EpsNSequencesCanvas —— ε-N 数列极限 交互 画布（仅客户端）
 *
 * 教学点：aₙ = 1/n → 0。拖 ε（0.05~0.8），观察门槛 N(ε)=⌈1/ε⌉ 右移：
 *  - 红色点：n ≤ N，还没进带（|aₙ| ≥ ε）
 *  - 绿色点：n > N，全部落在 (L−ε, L+ε) 内（|aₙ| < ε）
 * 「任意 ε 都能找到 N，使 n>N 之后全部进带」→ 极限的几何化。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

const boardEl = ref<HTMLDivElement | null>(null)

const NMAX = 35
const epsVal = ref(0.3)
const nVal = ref(4)
const inBand = ref(0)

let JXG: any = null
let board: any = null
let pts: any[] = []
let bandTop: any = null
let bandBot: any = null
let nLine: any = null
let epsSlider: any = null
let darkObserver: MutationObserver | null = null

function rebuild() {
  if (!board) return
  const eps = epsSlider.Value()
  epsVal.value = eps
  const N = Math.ceil(1 / eps)
  nVal.value = N

  // 带线 y = ±ε
  bandTop.setPosition(JXG.COORDS_BY_USER, [[-0.5, eps], [NMAX + 2, eps]])
  bandBot.setPosition(JXG.COORDS_BY_USER, [[-0.5, -eps], [NMAX + 2, -eps]])
  // 门槛线 x = N
  nLine.setPosition(JXG.COORDS_BY_USER, [[N, 1.1], [N, -0.25]])

  // 更新点颜色
  let cnt = 0
  for (let i = 0; i < pts.length; i++) {
    const n = i + 1
    const inside = n > N && Math.abs(1 / n) < eps
    if (inside) cnt++
    pts[i].setAttribute({ color: inside ? '#2f6f4f' : '#b3382c', size: inside ? 2.5 : 2 })
  }
  inBand.value = cnt
}

async function buildBoard() {
  if (!boardEl.value) return
  const jsxg = await import('jsxgraph')
  JXG = jsxg.default ?? jsxg.JXG

  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [-1, 1.15, NMAX + 3, -0.3],
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

  // 极限 L=0 参考线
  board.create('line', [[-0.5, 0], [NMAX + 2, 0]], {
    strokeColor: 'var(--vp-c-text-3)', strokeWidth: 1, withLabel: false,
  })
  // ε 带
  bandTop = board.create('line', [[-0.5, 0.3], [NMAX + 2, 0.3]], {
    strokeColor: '#c9a227', strokeWidth: 1.5, strokeDasharray: [6, 4], fixed: true,
  })
  bandBot = board.create('line', [[-0.5, -0.3], [NMAX + 2, -0.3]], {
    strokeColor: '#c9a227', strokeWidth: 1.5, strokeDasharray: [6, 4], fixed: true,
  })
  // 门槛线 x = N
  nLine = board.create('line', [[4, 1.1], [4, -0.25]], {
    strokeColor: '#2f6f4f', strokeWidth: 2, fixed: true,
  })

  // 数列点 (n, 1/n)
  for (let n = 1; n <= NMAX; n++) {
    pts.push(board.create('point', [n, 1 / n], {
      size: 2.5, color: '#b3382c', face: 'circle', fixed: true, withLabel: false,
    }))
  }

  epsSlider = board.create('slider', [
    [-0.8, 0.9], [6, 0.9], [0.05, 0.3, 0.8],
  ], { name: 'ε', snapWidth: 0.05, strokeColor: '#c9a227', fillColor: '#e0b84c' })
  epsSlider.on('drag', rebuild)

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
  <div class="epsn-canvas">
    <div class="epsn-readout">
      <span>ε = {{ epsVal.toFixed(2) }}</span>
      <span>门槛 N(ε) = ⌈1/ε⌉ = {{ nVal }}</span>
      <span class="epsn-ok">n > N 后落入带内的点数 = {{ inBand }}</span>
    </div>

    <div ref="boardEl" class="epsn-board" />

    <div class="epsn-hint">
      <p><strong>怎么玩：</strong></p>
      <ol>
        <li>把 <strong>ε</strong> 从大往小拖：琥珀带（±ε）变窄，绿色门槛线 <strong>N(ε)=⌈1/ε⌉</strong> 不断右移。</li>
        <li>红点 = 还没进带（n ≤ N）；<b>绿点</b> = 已经进带（n > N，|aₙ| &lt; ε）。门槛右侧全绿，这就是"n 足够大之后全部落入带内"。</li>
        <li>体会：ε 是挑战者（要多紧），N 是你给出的门槛（多靠后）——<b>任意 ε 都能找到 N</b>，正是数列极限的定义。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.epsn-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.epsn-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 1em;
  align-items: center;
  margin-bottom: 0.6em;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
}
.epsn-ok {
  margin-left: auto;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.epsn-board {
  width: 100%;
  height: 380px;
  border-radius: 8px;
  overflow: hidden;
}
.epsn-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.epsn-hint ol {
  margin: 0.2em 0 0 1.3em;
  padding: 0;
}
.epsn-hint li {
  margin: 0.15em 0;
}
@media (max-width: 640px) {
  .epsn-board { height: 300px; }
}
</style>
