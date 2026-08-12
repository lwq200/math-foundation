<script setup lang="ts">
/**
 * DotProductCanvas —— 点积/投影/余弦 交互 画布（仅客户端）
 *
 * 教学点：u·v = |u||v|cosθ。拖两个向量端点：
 *  - 同向（θ≈0）：点积≈|u||v|（最大）；垂直（θ=90°）：点积=0；反向：点积为负
 *  - 投影 = (u·v)/|v| = u 在 v 方向上的"影子"长度
 *  - 点积是"对齐程度"的度量：cosθ 就是对齐的标尺
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
// 静态引入 jsxgraph：使其进入页面 chunk 的静态依赖图（构建时自动 modulepreload），避免纯动态 import 被浏览器调度排后
import JXG from 'jsxgraph'

const boardEl = ref<HTMLDivElement | null>(null)

const uLen = ref(0)
const vLen = ref(0)
const dotVal = ref(0)
const cosVal = ref(0)
const angDeg = ref(0)
const projVal = ref(0)

let board: any = null
let uPt: any = null
let vPt: any = null
let angleEl: any = null
let darkObserver: MutationObserver | null = null

function update() {
  const ux = uPt.X(), uy = uPt.Y()
  const vx = vPt.X(), vy = vPt.Y()
  const lu = Math.hypot(ux, uy)
  const lv = Math.hypot(vx, vy)
  const dot = ux * vx + uy * vy
  const cos = lu > 0 && lv > 0 ? dot / (lu * lv) : 0
  const deg = Math.acos(Math.min(1, Math.max(-1, cos))) * 180 / Math.PI
  uLen.value = lu
  vLen.value = lv
  dotVal.value = dot
  cosVal.value = cos
  angDeg.value = deg
  projVal.value = lv > 0 ? dot / lv : 0
  // 更新夹角弧
  if (angleEl) angleEl.setAttribute({ visible: lu > 0.05 && lv > 0.05 })
}

function buildBoard() {
  if (!boardEl.value) return
  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [-5.5, 5.5, 5.5, -5.5],
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

  const origin = board.create('point', [0, 0], { visible: false, fixed: true })

  uPt = board.create('point', [3, 1], {
    name: 'u', size: 3, color: '#2f6f4f', face: 'circle', fixed: false,
  })
  vPt = board.create('point', [1, 2.2], {
    name: 'v', size: 3, color: '#c9a227', face: 'circle', fixed: false,
  })

  // 向量箭头
  board.create('arrow', [origin, uPt], {
    strokeColor: '#2f6f4f', strokeWidth: 3, withLabel: false,
  })
  board.create('arrow', [origin, vPt], {
    strokeColor: '#c9a227', strokeWidth: 3, withLabel: false,
  })

  // 夹角弧
  angleEl = board.create('angle', [vPt, origin, uPt], {
    radius: 1.2, fillColor: '#b3382c', fillOpacity: 0.18,
    strokeColor: '#b3382c', strokeWidth: 1, withLabel: false,
  })

  uPt.on('drag', update)
  vPt.on('drag', update)

  update()

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
  <div class="dp-canvas">
    <div class="dp-readout">
      <span>|u| = {{ uLen.toFixed(3) }}</span>
      <span>|v| = {{ vLen.toFixed(3) }}</span>
      <span>u·v = {{ dotVal.toFixed(3) }}</span>
      <span>cosθ = {{ cosVal.toFixed(4) }}</span>
      <span>θ = {{ angDeg.toFixed(1) }}°</span>
      <span class="dp-proj">投影 |u|cosθ = {{ projVal.toFixed(3) }}</span>
    </div>

    <div ref="boardEl" class="dp-board" />

    <div class="dp-hint">
      <p><strong>怎么玩：</strong></p>
      <ol>
        <li>拖绿色点 <strong>u</strong>、金色点 <strong>v</strong>（起点都在原点），红色弧显示夹角 θ。</li>
        <li>把两向量转到<b>同向</b>：u·v 最大（=|u||v|）；转到<b>垂直</b>：u·v = 0；转到<b>反向</b>：u·v 为负——点积是"对齐程度"的标尺。</li>
        <li><b>投影</b> = (u·v)/|v| = u 在 v 方向上的影子长度：点积除以 |v| 就是把"对齐量"折算成 v 方向上的长度。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.dp-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.dp-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 1em;
  align-items: center;
  margin-bottom: 0.6em;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
}
.dp-proj {
  margin-left: auto;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.dp-board {
  width: 100%;
  height: 380px;
  border-radius: 8px;
  overflow: hidden;
}
.dp-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.dp-hint ol {
  margin: 0.2em 0 0 1.3em;
  padding: 0;
}
.dp-hint li {
  margin: 0.15em 0;
}
@media (max-width: 640px) {
  .dp-board { height: 300px; }
}
</style>
