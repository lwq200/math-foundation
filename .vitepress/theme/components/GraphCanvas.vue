<!--
  GraphCanvas.vue — jsxgraph 交互画布（仅客户端）
  ==========================================================
  - 这是被 VizFigure.vue 通过 defineClientComponent 懒加载的实现组件。
  - 所有 jsxgraph API 调用都放在 onMounted 之后，因为 jsxgraph 在创建
    JXG.Board 时会访问 document / 父元素尺寸，SSR 阶段（无 DOM）调用会报错。
  - import 'jsxgraph' 只在此文件内进行，jsxgraph 会被打包进本组件的懒加载 chunk，
    不进首屏主包。
  - 用 ref 容器而非固定 id，避免一页出现多个 VizFigure 时 DOM id 冲突。
-->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
// 静态引入 jsxgraph：使其进入页面 chunk 的静态依赖图（构建时自动 modulepreload），避免纯动态 import 被浏览器调度排后
import JXG from 'jsxgraph'

const container = ref<HTMLDivElement | null>(null)

// 说明：jsxgraph 是 CommonJS/浏览器库。Vite 构建时 import 'jsxgraph' 即可，
// 其 UMD 全局（window.JXG）在模块加载后可用。这里给出最简调用骨架，
// 实际绘图逻辑由 interaction-prototyper 在 onMounted 中实现。
onMounted(async () => {
  if (!container.value) return
  // initBoard 接受元素引用（而非 id 字符串），多实例安全。
  const board = JXG.JSXGraph.initBoard(container.value, {
    boundingbox: [-6, 6, 6, -6],
    axis: true,
    grid: true,
    showNavigation: false,
  })
  // 示例：画一条 sin 曲线，验证 jsxgraph 可用
  board.create('functiongraph', [(x: number) => Math.sin(x)], {
    strokeColor: '#42b883',
    strokeWidth: 2,
  })
})
</script>

<template>
  <div ref="container" class="viz-graph-canvas" />
</template>

<style scoped>
.viz-graph-canvas {
  width: 100%;
  max-width: 640px;
  height: 420px;
  margin: 0 auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}
</style>
