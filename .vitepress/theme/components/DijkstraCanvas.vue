<!--
  DijkstraCanvas.vue — Dijkstra 最短路径 交互画布（仅客户端）
  ==========================================================
  - 册07 第03章：带权图逐步松弛演示。
  - 玩法：点「下一步」逐步执行 Dijkstra——每次定死当前最近的未定点，
    并更新其邻居的 dist；路径与前驱树实时高亮。可切换负权反例观察贪心翻车。
  - 深色模式：跟随 html.dark，MutationObserver 实时同步；CSS 用 --vp-c-* 变量。
  - 加载/错误态：jsxgraph 懒加载失败时显示错误占位（审核 P2-6 要求）。
-->
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
// 静态引入 jsxgraph：与现有画布一致，进入页面 chunk 静态依赖图（构建时 modulepreload）
import JXG from 'jsxgraph'

// ---- 图数据：经典 Dijkstra 示例（s=0）----
// 顶点坐标（画布坐标，比例由 boundingbox 适配）
const VERTICES = [
  { label: 's', x: -5, y: 2 },   // 0 起点
  { label: 'a', x: -2, y: 4 },   // 1
  { label: 'b', x: 0, y: 1.5 },  // 2
  { label: 'c', x: 2, y: 4 },    // 3
  { label: 't', x: 4.5, y: 2 },  // 4 终点
]
// 边：u, v, weight
const EDGES = [
  [0, 1, 7], [0, 2, 2], [1, 2, 3], [1, 3, 2],
  [2, 3, 4], [2, 4, 6], [3, 4, 1],
]
// 负权反例：s-a 边改为 -4，观察贪心翻车
const NEG_EDGES = [
  [0, 1, -4], [0, 2, 2], [1, 2, 3], [1, 3, 2],
  [2, 3, 4], [2, 4, 6], [3, 4, 1],
]

const boardEl = ref<HTMLDivElement | null>(null)
const ready = ref(false)
const error = ref(false)
const stepInfo = ref('')
const mode = ref<'normal' | 'neg'>('normal')

let board: any = null
let pts: any[] = []
let edges: any[] = []
let edgeLabels: any[] = []
let dark = false

// ---- Dijkstra 执行状态 ----
let dist: number[] = []
let settled: boolean[] = []
let prev: (number | null)[] = []
let stepIdx = 0
let trace: { type: string; u: number; v: number; msg: string }[] = []

const CSS_VAR = (v: string, fallback: string) => {
  if (typeof document === 'undefined') return fallback
  const val = getComputedStyle(document.documentElement).getPropertyValue(v).trim()
  return val || fallback
}

function buildTrace(neg: boolean) {
  const edges2 = neg ? NEG_EDGES : EDGES
  const n = VERTICES.length
  dist = new Array(n).fill(Infinity)
  settled = new Array(n).fill(false)
  prev = new Array(n).fill(null)
  dist[0] = 0
  trace = []
  stepIdx = 0
  // 生成逐步记录：每轮选最近未定点 + 松弛其边
  for (let iter = 0; iter < n; iter++) {
    let u = -1
    for (let i = 0; i < n; i++) {
      if (!settled[i] && (u === -1 || dist[i] < dist[u])) u = i
    }
    if (u === -1 || dist[u] === Infinity) break
    trace.push({ type: 'settle', u, v: -1, msg: `定死 ${VERTICES[u].label}（dist=${dist[u]}）` })
    settled[u] = true
    for (const [a, b, w] of edges2) {
      if (a === u && !settled[b] && dist[b] > dist[a] + w) {
        const old = dist[b]
        dist[b] = dist[a] + w
        prev[b] = a
        trace.push({ type: 'relax', u: a, v: b, msg: `松弛 ${VERTICES[a].label}→${VERTICES[b].label}：${old === Infinity ? '∞' : old} → ${dist[b]}` })
      } else if (b === u && !settled[a] && dist[a] > dist[b] + w) {
        const old = dist[a]
        dist[a] = dist[b] + w
        prev[a] = b
        trace.push({ type: 'relax', u: b, v: a, msg: `松弛 ${VERTICES[b].label}→${VERTICES[a].label}：${old === Infinity ? '∞' : old} → ${dist[a]}` })
      }
    }
  }
}

function stepOnce() {
  if (stepIdx >= trace.length) { stepInfo.value = '✅ 算法完成（所有可达点已定死）'; return }
  const ev = trace[stepIdx]
  stepIdx++
  const cSettle = CSS_VAR('--vp-c-brand-1', '#42b883')
  const cRelax = CSS_VAR('--vp-c-warning-2', '#c9a227')
  if (ev.type === 'settle') {
    pts[ev.u].setAttribute({ fillColor: cSettle })
    stepInfo.value = ev.msg
  } else {
    edges.forEach((e, i) => {
      const [a, b] = (mode.value === 'neg' ? NEG_EDGES : EDGES)[i]
      if ((a === ev.u && b === ev.v) || (b === ev.u && a === ev.v)) {
        e.setAttribute({ strokeColor: cRelax, strokeWidth: 4 })
      }
    })
    stepInfo.value = ev.msg
  }
  // 显示当前 dist 状态
  stepInfo.value += ` ｜ 当前 dist：${dist.map((d, i) => `${VERTICES[i].label}=${d === Infinity ? '∞' : d}`).join(' ')}`
}

function resetBoard() {
  if (!board) return
  if (typeof board.cleanUp === 'function') board.cleanUp()
  initBoard()
}

function toggleMode() {
  mode.value = mode.value === 'normal' ? 'neg' : 'normal'
  // 颜色归一化
  const cText = CSS_VAR('--vp-c-text-2', '#666')
  edges.forEach((e, i) => {
    e.setAttribute({ strokeColor: cText, strokeWidth: 2 })
  })
  resetBoard()
}

function initBoard() {
  if (!boardEl.value) return
  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [-6.5, 5.5, 6.5, -1],
    axis: false,
    grid: false,
    showNavigation: false,
    showCopyright: false,
    zoom: { factorX: 1.4, factorY: 1.4 },
    pan: { needTwoFingers: false },
    resize: { enabled: true, needInitialSize: false },
    renderer: 'svg',
  })
  const cEdge = CSS_VAR('--vp-c-text-3', '#999')
  const cLabel = CSS_VAR('--vp-c-text-2', '#666')
  const cVertex = CSS_VAR('--vp-c-text-1', '#222')
  const useEdges = mode.value === 'neg' ? NEG_EDGES : EDGES

  // 边 + 权值标签
  useEdges.forEach(([a, b, w]) => {
    const e = board.create('segment', [
      [VERTICES[a].x, VERTICES[a].y],
      [VERTICES[b].x, VERTICES[b].y],
    ], {
      strokeColor: cEdge,
      strokeWidth: 2,
      straightFirst: false,
      straightLast: false,
    })
    edges.push(e)
    const mx = (VERTICES[a].x + VERTICES[b].x) / 2
    const my = (VERTICES[a].y + VERTICES[b].y) / 2
    const lbl = board.create('text', [mx, my + 0.25, String(w)], {
      fontSize: 13,
      color: cLabel,
      anchorX: 'middle',
      anchorY: 'middle',
    })
    edgeLabels.push(lbl)
  })

  // 顶点
  VERTICES.forEach((v) => {
    const p = board.create('point', [v.x, v.y], {
      size: 3,
      name: v.label,
      strokeColor: cVertex,
      fillColor: v.label === 's' ? CSS_VAR('--vp-c-brand-1', '#42b883') : '#ffffff',
      face: 'circle',
      withLabel: true,
      label: { fontSize: 14, color: cVertex },
    })
    p.setAttribute({ fixed: true })
    pts.push(p)
  })

  buildTrace(mode.value === 'neg')
  stepInfo.value = '点击「下一步」逐步执行 Dijkstra：每次定死当前最近的未定点并松弛其邻居。'
  ready.value = true
}

function applyDark(d: boolean) {
  dark = d
  // 轻量处理：深色模式下线宽颜色微调（走 CSS 变量路径即可，主要视觉由容器 CSS 承担）
}

onMounted(async () => {
  try {
    dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    // 确保 jsxgraph 可用（静态 import 已加载）
    if (!JXG || !JXG.JSXGraph) throw new Error('jsxgraph 加载失败')
    initBoard()
    // 深色跟随
    const mo = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark')
      if (isDark !== dark) {
        applyDark(isDark)
        // 重绘：跟随主题（简单方案：重置画布让颜色重新解析）
        if (ready.value) { if (typeof board?.cleanUp === 'function') board.cleanUp(); initBoard() }
      }
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    observer = mo
  } catch (e) {
    console.error('DijkstraCanvas 初始化失败:', e)
    error.value = true
  }
})

let observer: MutationObserver | null = null
onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  if (board) { if (typeof board.cleanUp === 'function') board.cleanUp(); board = null }
})
</script>

<template>
  <div class="dij-canvas">
    <!-- board 始终在 DOM 中（onMounted 需拿到 ref），加载/错误态作为覆盖层叠加 -->
    <div ref="boardEl" class="dij-board" :class="{ 'dij-board-hidden': !ready }" />
    <div v-if="error" class="dij-overlay dij-error">交互图加载失败，请刷新重试</div>
    <div v-else-if="!ready" class="dij-overlay dij-skeleton">交互图加载中…</div>
    <template v-if="ready">
      <div class="dij-toolbar">
        <span class="dij-mode">图：<button class="dij-fn-btn" :class="{ active: mode === 'normal' }" @click="mode !== 'normal' && toggleMode()">非负权</button>
          <button class="dij-fn-btn" :class="{ active: mode === 'neg' }" @click="mode !== 'neg' && toggleMode()">负权反例</button></span>
        <button class="dij-fn-btn dij-step" @click="stepOnce">下一步 ▸</button>
        <button class="dij-fn-btn" @click="resetBoard">重置</button>
      </div>
      <div class="dij-readout">{{ stepInfo }}</div>
      <div class="dij-hint">
        <strong>怎么玩（不吞推导）：</strong>点「下一步」，观察贪心每一步怎么选；注意非负权下「最近未定点敢定死」与负权下「绕路更短导致翻车」的差别。
      </div>
    </template>
  </div>
</template>

<style scoped>
.dij-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.dij-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6em;
  align-items: center;
  margin-bottom: 0.5em;
  font-size: 0.9em;
  color: var(--vp-c-text-1);
}
.dij-mode {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
}
.dij-fn-btn {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  padding: 0.15em 0.7em;
  cursor: pointer;
  font-size: 0.9em;
  transition: background 0.2s ease;
}
.dij-fn-btn.active {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
  border-color: var(--vp-c-brand-1);
}
.dij-step {
  font-weight: 600;
}
.dij-readout {
  margin-bottom: 0.6em;
  font-size: 0.88em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
  min-height: 1.3em;
}
.dij-board {
  width: 100%;
  height: 380px;
  border-radius: 8px;
  overflow: hidden;
}
.dij-board-hidden {
  display: none;
}
.dij-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.dij-overlay {
  min-height: 380px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-text-2);
}
@media (max-width: 640px) {
  .dij-board { height: 300px; }
}
</style>
