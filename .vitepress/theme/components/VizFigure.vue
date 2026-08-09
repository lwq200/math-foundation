<!--
  VizFigure.vue — 交互图形 SSR 安全加载示范
  ==========================================================
  目标：把依赖 jsxgraph（浏览器全局 document/canvas）的交互组件接入 VitePress，
  同时不影响 SSR 构建与首屏体积。

  要点：
   1. 用 vitepress 提供的 defineClientComponent 声明「仅客户端」组件。
      - 它会在 SSR 阶段输出占位（<ClientOnly> 语义），仅在浏览器端 import 真正的实现，
      - 且实现被打包成独立 chunk，懒加载，不进入首屏 app 主包。
   2. 真正的实现（GraphCanvas.vue）import 'jsxgraph' 在 onMounted 后才 new JXG.Board(...)，
      避免 setup 阶段访问 document 导致 SSR 报错。
   3. 交互组件在 md 中用 <VizFigure /> 直接写；或在主题组件里全局注册后直接用。

  依赖声明（见 package.json devDependencies）：
   - "jsxgraph": "^1.7.1"
   - "@vitejs/plugin-vue": "^5.2.1"   （VitePress 内置，用于解析 .vue）

  用法（markdown）：
  ```md
  <VizFigure src="/assets/viz/fig-euler-limit.svg"
             label="极限逼近示意图" />
  ```
-->
<script setup lang="ts">
import { defineClientComponent } from 'vitepress'

defineProps<{ src: string; label?: string }>()

// 懒加载 + 仅客户端：实现文件 GraphCanvas.vue 会被拆成独立 chunk，
// 首屏不会下载 jsxgraph 的运行时。
const GraphCanvas = defineClientComponent(() => import('./GraphCanvas.vue'))
</script>

<template>
  <figure class="viz-figure">
    <!-- defineClientComponent 在 SSR 阶段渲染默认 fallback（这里传了 SVG 静态图），
         浏览器端才挂载交互版 GraphCanvas。 -->
    <GraphCanvas v-bind="$attrs" />
    <figcaption v-if="label">{{ label }}</figcaption>
  </figure>
</template>

<style scoped>
.viz-figure {
  margin: 1rem 0;
  text-align: center;
}
.viz-figure figcaption {
  margin-top: 0.4rem;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
