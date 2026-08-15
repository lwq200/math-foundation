<script setup lang="ts">
/**
 * MatrixTransformCanvas —— 矩阵变换·单位圆→椭圆 交互 画布（仅客户端）
 *
 * 教学点：A = [[a,b],[c,d]] 作用在单位圆上，得到椭圆
 *  (x,y) = (a·cos t + b·sin t, c·cos t + d·sin t)。
 *  - 四个滑杆直接调矩阵元素；预设按钮给出经典矩阵
 *  - 椭圆的主轴方向 = 特征向量方向，主轴长度比 = 特征值（模）
 *  - 恒等矩阵椭圆=圆；剪切矩阵圆被"斜拉"；旋转矩阵圆仍是圆（只是转）
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
// 静态引入 jsxgraph：使其进入页面 chunk 的静态依赖图（构建时自动 modulepreload），避免纯动态 import 被浏览器调度排后
import JXG from 'jsxgraph'

const boardEl = ref<HTMLDivElement | null>(null)

const aVal = ref(1)
const bVal = ref(0)
const cVal = ref(0)
const dVal = ref(1)

let board: any = null
let unitCircle: any = null
let ellipse: any = null
let darkObserver: MutationObserver | null = null

function rebuild() {
  if (!board) return
  const a = aVal.value, b = bVal.value, c = cVal.value, d = dVal.value

  board.removeObject(unitCircle)
  board.removeObject(ellipse)

  unitCircle = board.create('curve', [
    (t: number) => Math.cos(t),
    (t: number) => Math.sin(t),
    0, 2 * Math.PI,
  ], {
    strokeColor: 'var(--vp-c-text-3)', strokeWidth: 1.5, strokeDasharray: [5, 4], withLabel: false,
  })

  ellipse = board.create('curve', [
    (t: number) => a * Math.cos(t) + b * Math.sin(t),
    (t: number) => c * Math.cos(t) + d * Math.sin(t),
    0, 2 * Math.PI,
  ], {
    strokeColor: '#2f6f4f', strokeWidth: 3, withLabel: false,
  })
}

function setMatrix(a: number, b: number, c: number, d: number) {
  aVal.value = a; bVal.value = b; cVal.value = c; dVal.value = d
  rebuild()
}

function buildBoard() {
  if (!boardEl.value) return
  board = JXG.JSXGraph.initBoard(boardEl.value, {
    boundingbox: [-4.5, 4.5, 4.5, -4.5],
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
  <div class="mt-canvas">
    <div class="mt-buttons">
      <button class="mt-btn" @click="setMatrix(1, 0, 0, 1)">恒等</button>
      <button class="mt-btn" @click="setMatrix(2, 0, 0, 1)">缩放 (2,1)</button>
      <button class="mt-btn" @click="setMatrix(0.707, -0.707, 0.707, 0.707)">旋转 45°</button>
      <button class="mt-btn" @click="setMatrix(1, 0.8, 0, 1)">剪切</button>
      <span class="mt-matrix">A = [[{{ aVal.toFixed(1) }}, {{ bVal.toFixed(1) }}], [{{ cVal.toFixed(1) }}, {{ dVal.toFixed(1) }}]]</span>
    </div>

    <div class="mt-sliders">
      <label>a<input type="range" min="-2" max="2" step="0.1" v-model.number="aVal" @input="rebuild" /></label>
      <label>b<input type="range" min="-2" max="2" step="0.1" v-model.number="bVal" @input="rebuild" /></label>
      <label>c<input type="range" min="-2" max="2" step="0.1" v-model.number="cVal" @input="rebuild" /></label>
      <label>d<input type="range" min="-2" max="2" step="0.1" v-model.number="dVal" @input="rebuild" /></label>
    </div>

    <div ref="boardEl" class="mt-board" />

    <div class="mt-hint">
      <p><strong>怎么玩：</strong></p>
      <ol>
        <li>拖 <strong>a,b,c,d</strong> 四个滑杆（或用预设按钮），灰色虚线圆是单位圆，<b>绿色曲线是 A 作用后的椭圆</b>。</li>
        <li>看<b>椭圆的主轴</b>：主轴方向就是矩阵的特征向量方向（Av=λv 的"不转向"方向），主轴伸缩比是特征值的模。</li>
        <li>试「旋转」：圆还是圆（只是转了）——旋转矩阵的特征值是 e^{±iθ}（模=1）；试「剪切」：圆被斜拉成椭圆，特征方向不在坐标轴上。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.mt-canvas {
  margin: 1.2em 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.8em 0.9em 0.4em;
  background: var(--vp-c-bg-soft);
}
.mt-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6em;
  align-items: center;
  margin-bottom: 0.6em;
}
.mt-btn {
  border: 1px solid var(--vp-c-brand-2);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
  padding: 0.2em 0.9em;
  cursor: pointer;
  font-size: 0.88em;
  transition: background 0.2s ease;
}
.mt-btn:hover { background: var(--vp-c-brand-soft); }
.mt-matrix {
  margin-left: auto;
  font-size: 0.88em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
}
.mt-sliders {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8em;
  margin-bottom: 0.6em;
}
.mt-sliders label {
  display: flex;
  align-items: center;
  gap: 0.35em;
  font-size: 0.88em;
  color: var(--vp-c-text-1);
  min-width: 8em;
}
.mt-sliders input[type="range"] {
  flex: 1;
  min-width: 5em;
}
.mt-board {
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
}
.mt-hint {
  margin-top: 0.6em;
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
.mt-hint ol {
  margin: 0.2em 0 0 1.3em;
  padding: 0;
}
.mt-hint li { margin: 0.15em 0; }
@media (max-width: 640px) {
  .mt-board { height: 320px; }
}
</style>
