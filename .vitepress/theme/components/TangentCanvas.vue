<script setup lang="ts">
/**
 * TangentCanvas —— 差商趋近导数·割线贴合切线 交互画布（仅客户端）
 *
 * 教学点：差商 (f(a+h)−f(a))/h 在 h→0 时趋近 f'(a)。
 *  - 拖动切点 a（约束在曲线上），橙色虚线是切线（斜率 f'(a)）
 *  - 拖动 h（可正可负）让割线端点 Q=(a+h, f(a+h)) 沿曲线滑向切点，割线逐步贴合切线
 *  - 切到 |x| 并把 a 拖到 0：h>0 右差商 ≈ +1、h<0 左差商 ≈ −1，左右不相等
 *    → |x| 在 0 处不可导（尽管连续）
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
// 静态引入 jsxgraph：使其进入页面 chunk 的静态依赖图（构建时自动 modulepreload）
import JXG from 'jsxgraph'

const FNS: Record<string, { f: (x: number) => number; d: (x: number) => number; label: string }> = {
  sq: { f: (x) => x * x, d: (x) => 2 * x, label: 'f(x) = x²' },
  cb: { f: (x) => x * x * x, d: (x) => 3 * x * x, label: 'f(x) = x³' },
  abs: { f: (x) => Math.abs(x), d: (x) => (x > 0 ? 1 : x < 0 ? -1 : NaN), label: 'f(x) = |x|' },
}

const boardEl = ref<HTMLDivElement | null>(null)
const fnKey = ref('sq')
const hVal = ref(0.5)
const readout = ref('')
const sideNote = ref('')

let board: any = null
let curve: any = null
let aPt: any = null
let bPt: any = null
let secSeg: any = null
let tanLine: any = null
let darkObserver: MutationObserver | null = null

function fA(x: number) {
  return FNS[fnKey.value].f(x)
}
function dA(x: number) {
  return FNS[fnKey.value].d(x)
}
function fmt(x: number) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—'
  const s = Math.abs(x) < 1e-9 ? 0 : x
  return s.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.000')
}

/** 割线端点 Q=(a+h, f(a+h))：h 变小时沿曲线滑向切点 */
function placeB(a: number, h: number) {
  if (!bPt) return
  const bx = a + h
  bPt.setPosition(JXG.COORDS_BY_USER, [bx, fA(bx)])
  bPt.setAttribute({ visible: Math.abs(h) > 1e-9 })
}

function updateTanLine(a: number) {
  if (!tanLine) return
  const slope = dA(a)
  if (Number.isFinite(slope)) {
    tanLine.setAttribute({ visible: true })
    tanLine.setPosition(JXG.COORDS_BY_USER, [
      [a - 3, fA(a) - 3 * slope],
      [a + 3, fA(a) + 3 * slope],
    ])
  } else {
    tanLine.setAttribute({ visible: false })
  }
}

function updateReadouts(a: number, h: number) {
  const dq = h === 0 ? NaN : (fA(a + h) - fA(a)) / h
  readout.value = `切点 a = ${a.toFixed(2)}，h = ${h >= 0 ? '+' : ''}${h.toFixed(2)}，差商 = ${fmt(dq)}，f′(a) = ${fmt(dA(a))}`
  // |x| 且切点靠近 0：动态计算左右差商（h=±0.5），左右不相等 → 不可导现场
  if (fnKey.value === 'abs' && Math.abs(a) < 0.4) {
    const h0 = 0.5
    const right = (fA(a + h0) - fA(a)) / h0
    const left = (fA(a - h0) - fA(a)) / -h0
    const cur = h === 0 ? 'h=0' : h < 0 ? `左差商 ≈ ${fmt(dq)}` : `右差商 ≈ ${fmt(dq)}`
    sideNote.value = `|x| 在 a≈0：右差商 ≈ ${fmt(right)}、左差商 ≈ ${fmt(left)}，左右不相等 → 0 处不可导（尽管连续）。当前 ${cur}。`
  } else {
    sideNote.value = ''
  }
}

/** 切点 a 变化后：重吸附曲线、跟随点、切线、读出 */
function syncAfterA(a: number) {
  const h = hVal.value
  if (aPt) aPt.setPosition(JXG.COORDS_BY_USER, [a, fA(a)])
  placeB(a, h)
  updateTanLine(a)
  updateReadouts(a, h)
}

function redrawFunction() {
  const a = aPt ? aPt.X() : 1
  const h = hVal.value
  if (curve) board.removeObject(curve)
  curve = board.create('curve', [
    (t: number) => t,
    (t: number) => FNS[fnKey.value].f(t),
    -5, 5,
  ], {
    strokeColor: '#42b883', strokeWidth: 3, withLabel: false,
  })
  if (aPt) aPt.setPosition(JXG.COORDS_BY_USER, [a, fA(a)])
  placeB(a, h)
  updateTanLine(a)
  updateReadouts(a, h)
}

function switchFn(fn: string) {
  fnKey.value = fn
  redrawFunction()
}

function onHChange() {
  const h = hVal.value
  const a = aPt ? aPt.X() : 1
  placeB(a, h)
  updateReadouts(a, h)
}

function buildBoard() {
  if (!boardEl.value) return
  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [-6, 8, 6, -8],
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

  // 切点 a：可拖动，但约束在曲线上（拖动时 y 被拉回 f(x)）
  aPt = board.create('point', [1, 1], {
    name: 'a', size: 2.2, color: '#2f6f4f', face: 'circle',
    snapToGrid: true, snapSizeX: 0.05, snapSizeY: 0.05, withLabel: true,
  })
  aPt.on('drag', () => {
    const x = aPt.X()
    const y = fA(x)
    aPt.setPosition(JXG.COORDS_BY_USER, [x, y])
    syncAfterA(x)
  })

  // 割线端点 Q=(a+h, f(a+h))：随 h 沿曲线滑动
  bPt = board.create('point', [1.5, 2.25], {
    name: 'Q', size: 2, color: '#3d8b66', face: 'circle', fixed: true, withLabel: true,
  })

  // 割线：有限线段，从切点 a 到端点 Q——h 变小 Q 滑向 a，割线贴合切线
  secSeg = board.create('segment', [aPt, bPt], {
    strokeColor: '#3d8b66', strokeWidth: 2.5, withLabel: false,
  })

  // 切线：橙色虚线（无限直线）
  tanLine = board.create('line', [[1, 1], [2, 3]], {
    strokeColor: '#e0663a', strokeWidth: 2, strokeDasharray: [6, 4], withLabel: false,
  })

  redrawFunction()

  if (typeof MutationObserver !== 'undefined') {
    darkObserver = new MutationObserver(() => {
      if (!board) return
      board.setAttribute({ dark: document.documentElement.classList.contains('dark') })
    })
    darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  }
}

onMounted(buildBoard)

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
  <div class="tan-canvas">
    <div class="tan-toolbar">
      <button
        v-for="(fn, key) in FNS" :key="key"
        class="tan-btn" :class="{ active: fnKey === key }"
        @click="switchFn(key)"
      >{{ fn.label }}</button>
      <span class="tan-readout">{{ readout }}</span>
    </div>

    <div class="tan-slider">
      <label for="tan-h">差商步长 h</label>
      <input id="tan-h" type="range" min="-2" max="2" step="0.05" v-model.number="hVal" @input="onHChange" />
      <span class="tan-hval">{{ hVal >= 0 ? '+' : '' }}{{ hVal.toFixed(2) }}</span>
    </div>

    <p v-if="sideNote" class="tan-sidenote">{{ sideNote }}</p>

    <div ref="boardEl" class="tan-board" />

    <div class="tan-hint">
      <p><strong>怎么玩：</strong></p>
      <ol>
        <li>拖动绿色点 <strong>a</strong> 改变切点位置（它被吸附在曲线上），橙色虚线是切线（斜率 f′(a)）。</li>
        <li>拖动 <strong>h</strong> 滑杆让它变小（趋近 0），绿色端点 <strong>Q=(a+h, f(a+h))</strong> 会沿曲线滑向切点，绿色割线逐步贴合橙色切线——这就是「差商趋近导数」。h 拖到负值，即从左侧逼近。</li>
        <li>切到 <strong>|x|</strong> 并把 a 拖到 0：h 在正侧时差商 ≈ <b>+1</b>、负侧时差商 ≈ <b>−1</b>，左右不相等，所以 |x| 在 0 处不可导（尽管它连续）。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.tan-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.tan-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  align-items: center;
  margin-bottom: 0.6em;
}
.tan-btn {
  border: 1px solid var(--vp-c-brand-2);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
  padding: 0.2em 0.9em;
  cursor: pointer;
  font-size: 0.88em;
  transition: background 0.2s ease;
}
.tan-btn:hover { background: var(--vp-c-brand-soft); }
.tan-btn.active { background: var(--vp-c-brand-1); color: var(--vp-c-bg); border-color: var(--vp-c-brand-1); }
.tan-readout {
  margin-left: auto;
  font-size: 0.86em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
  white-space: nowrap;
}
.tan-slider {
  display: flex;
  align-items: center;
  gap: 0.7em;
  margin-bottom: 0.5em;
  font-size: 0.9em;
  color: var(--vp-c-text-1);
}
.tan-slider input[type="range"] {
  flex: 1;
  min-width: 6em;
}
.tan-hval {
  min-width: 3.2em;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.tan-sidenote {
  margin: 0 0 0.5em;
  padding: 0.45em 0.7em;
  border: 1px solid #e0663a;
  border-radius: 6px;
  background: color-mix(in srgb, #e0663a 8%, transparent);
  color: var(--vp-c-text-1);
  font-size: 0.86em;
  line-height: 1.5;
}
.tan-board {
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
}
.tan-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.tan-hint ol {
  margin: 0.2em 0 0 1.3em;
  padding: 0;
}
.tan-hint li { margin: 0.2em 0; }
@media (max-width: 640px) {
  .tan-board { height: 320px; }
  .tan-readout { margin-left: 0; }
}
</style>
