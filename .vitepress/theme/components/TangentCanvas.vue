<script setup lang="ts">
/**
 * TangentCanvas —— 切线/割线/差商 实际画布（仅客户端）
 *
 * 由 TangentExplorer.vue 通过 defineClientComponent 懒加载。
 * 教学点（分步可暂停、不吞推导）：
 *  - 拖动点 a：切点沿曲线移动，实时显示 f(a) 与切线斜率 f'(a)
 *  - 拖动 h 滑杆：割线（过 (a,f(a)) 与 (a+h,f(a+h))）逐步贴合切线
 *  - 差商读数：实时显示 (f(a+h)-f(a))/h，h→0 时趋近 f'(a)
 *  - 函数切换：x² / x³ / |x|
 *    · x³ 在 a=0 处切线斜率 = 0，直观区分「切线水平 ≠ 导数为零点一定极值」
 *    · |x| 在 a=0 处左右差商符号相反、互为相反数 → 斜率冲突 → 不可导，
 *      呼应「可导 ⇒ 连续，连续 ⇏ 可导」
 *
 * SSR 安全：jsxgraph 只在 onMounted 内动态 import（await import('jsxgraph')），
 * setup/SSR 阶段不访问 document → 构建不炸。本组件自身不会在 SSR 阶段执行
 * onMounted，且 defineClientComponent 也只在浏览器挂载。
 * 用 ref 容器而非固定 id，保证一页多个实例不冲突。
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const boardEl = ref<HTMLDivElement | null>(null)

type FnKey = 'x2' | 'x3' | 'abs'

// 函数与其导数（用于切线/差商数值显示，与 JSXGraph 曲线共用同一数学定义）
const FNS: Record<FnKey, { name: string; f: (x: number) => number; d: (x: number) => number }> = {
  x2:  { name: 'x²',  f: (x) => x * x,           d: (x) => 2 * x },
  x3:  { name: 'x³',  f: (x) => x * x * x,       d: (x) => 3 * x * x },
  abs: { name: '|x|', f: (x) => Math.abs(x),     d: (x) => (x > 0 ? 1 : x < 0 ? -1 : NaN) },
}

const fnKey = ref<FnKey>('x2')

// 读数值（Vue 响应式，供模板显示）
const diffQ = ref<number>(0)
const slopeVal = ref<number>(0)
const aVal = ref<number>(1)
const hVal = ref<number>(1)

let JXG: any = null
let board: any = null
let curve: any = null
let tanLine: any = null
let secLine: any = null
let aPt: any = null
let hSlider: any = null
let darkObserver: MutationObserver | null = null

const fA = (x: number) => FNS[fnKey.value].f(x)

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return Number(v.toFixed(4)).toString()
}

function updateReadouts(a: number, h: number) {
  const f = FNS[fnKey.value].f
  const fa = f(a)
  const fah = f(a + h)
  const dq = h !== 0 ? (fah - fa) / h : NaN
  diffQ.value = Number.isFinite(dq) ? dq : NaN
  slopeVal.value = FNS[fnKey.value].d(a)
  aVal.value = a
  hVal.value = h
}

// 重建曲线 + 切线 + 割线（函数切换时调用）
function redrawFunction() {
  if (!board) return
  const a = aPt.X()
  const h = hSlider.Value()

  // 曲线
  board.removeObject(curve)
  curve = board.create('functiongraph', [(x: number) => fA(x), -6, 6], {
    strokeColor: '#42b883',
    strokeWidth: 3,
  })

  // 切线：过 (a, f(a))、斜率为 f'(a)
  // 注意：JSXGraph 1.13 的 line 不支持 function 父对象（旧版 1.7 可容忍），
  // 必须用坐标点数组；拖动时下方 setPosition 实时更新，与割线同机制。
  const slope = FNS[fnKey.value].d(a)
  board.removeObject(tanLine)
  if (Number.isFinite(slope)) {
    tanLine = board.create('line', [
      [a - 3, fA(a) - 3 * slope],
      [a + 3, fA(a) + 3 * slope],
    ], { strokeColor: '#e0663a', strokeWidth: 2, strokeDasharray: [4, 3], fixed: true })
  }

  // 割线：过 (a, f(a)) 与 (a+h, f(a+h))，随 h 滑杆移动逐步贴合切线
  board.removeObject(secLine)
  secLine = board.create('line', [
    [a, fA(a)],
    [a + h, fA(a + h)],
  ], { strokeColor: '#3d8b66', strokeWidth: 2, fixed: true })

  updateReadouts(a, h)
}

async function buildBoard() {
  if (!boardEl.value) return
  // 动态加载 jsxgraph（仅浏览器，懒加载，不进首屏主包）
  // jsxgraph 1.13+ ESM 为 default 导出，旧版为 .JXG 命名导出，兼容两种
  const jsxg = await import('jsxgraph')
  JXG = jsxg.default ?? jsxg.JXG

  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [-6, 8, 6, -8],
    axis: true,
    grid: true,
    pan: { needTwoFingers: false },
    zoom: { factorX: 1.4, factorY: 1.4 },
    // 深色模式：init 时探测 html.dark（VitePress 主题类）
    dark: typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
    // 用 CSS 变量取色，保证与站点品牌色、深浅色适配一致
    color: {
      axis: 'var(--vp-c-text-3)',
      grid: 'var(--vp-c-divider)',
      background: 'transparent',
      foreground: 'var(--vp-c-text-1)',
      highlight: '#42b883',
      border: 'var(--vp-c-divider)',
    },
  })

  // 切点 a（可拖动）
  aPt = board.create('point', [1, 1], {
    name: 'a',
    size: 3,
    color: '#2f6f4f',
    face: 'circle',
    fixed: false,
    snapSizeX: 0.05,
    snapSizeY: 0.05,
    snapToGrid: true,
  })
  aPt.on('drag', () => {
    const a = aPt.X()
    const h = hSlider.Value()
    const slope = FNS[fnKey.value].d(a)
    if (tanLine) {
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
    if (secLine) {
      secLine.setPosition(JXG.COORDS_BY_USER, [
        [a, fA(a)],
        [a + h, fA(a + h)],
      ])
    }
    updateReadouts(a, h)
  })

  // h 滑杆：0.1 ~ 3，步进 0.1
  hSlider = board.create('slider', [
    [-4, 6.5],
    [2, 6.5],
    [0.1, 1, 3],
  ], {
    name: 'h',
    snapWidth: 0.1,
    strokeColor: '#2f6f4f',
    highlightStrokeColor: '#2f6f4f',
    fillColor: '#42b883',
  })
  hSlider.on('drag', () => {
    const a = aPt.X()
    const h = hSlider.Value()
    if (secLine) {
      secLine.setPosition(JXG.COORDS_BY_USER, [
        [a, fA(a)],
        [a + h, fA(a + h)],
      ])
    }
    updateReadouts(a, h)
  })

  redrawFunction()

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

function switchFn(k: FnKey) {
  fnKey.value = k
  redrawFunction()
}

// 函数切换：重建曲线 + 切线 + 割线 + 读数
watch(fnKey, () => redrawFunction())

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
  <div class="tangent-canvas">
    <div class="tan-toolbar">
      <span class="tan-label">函数 f(x)：</span>
      <button
        v-for="(meta, k) in FNS"
        :key="k"
        class="tan-fn-btn"
        :class="{ active: fnKey === k }"
        @click="switchFn(k)"
      >
        f(x) = {{ meta.name }}
      </button>
      <span class="tan-readout-static">
        切点 a = {{ aVal.toFixed(2) }}，差商 = {{ fmt(diffQ) }}，f'(a) = {{ fmt(slopeVal) }}
      </span>
    </div>

    <div ref="boardEl" class="tan-board" />

    <div class="tan-hint">
      <p><strong>怎么玩（分步、不吞推导）：</strong></p>
      <ol>
        <li>拖动绿色点 <strong>a</strong> 改变切点位置，橙色虚线是切线（斜率 f'(a)）。</li>
        <li>拖动 <strong>h</strong> 滑杆让它变小，绿色割线会逐步<b>贴合</b>橙色切线——这就是「差商趋近导数」。</li>
        <li>切到 <strong>|x|</strong> 并把 a 拖到 0：左边差商 ≈ −1，右边差商 ≈ +1，<b>左右不相等</b>，所以 |x| 在 0 处<b>不可导</b>（尽管它连续）。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.tangent-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.tan-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em;
  margin-bottom: 0.6em;
}
.tan-label {
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.tan-fn-btn {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  padding: 0.15em 0.7em;
  cursor: pointer;
  font-size: 0.9em;
}
.tan-fn-btn.active {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
  border-color: var(--vp-c-brand-1);
}
.tan-readout-static {
  margin-left: auto;
  font-size: 0.85em;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}
.tan-board {
  width: 100%;
  height: 380px;
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
.tan-hint li {
  margin: 0.15em 0;
}
@media (max-width: 640px) {
  .tan-board { height: 300px; }
  .tan-readout-static { display: none; }
}
</style>
