<script setup lang="ts">
/**
 * TangentExplorer —— 切线/割线/差商 交互包装器（对应 P0-3「导数=切线斜率」）
 *
 * 本文件只是「仅客户端 + 懒加载」的薄包装层，真正的 JSXGraph 绘图逻辑在
 * TangentCanvas.vue 中（onMounted 后动态 import('jsxgraph')，SSR 安全）。
 *
 * 为什么用 defineClientComponent：
 *  - SSR 阶段渲染占位、不执行 jsxgraph 代码 → npm run build 不炸
 *  - 实现被打成独立 chunk，懒加载，jsxgraph 运行时不进首屏主包
 *
 * 已在 theme/index.ts 的 enhanceApp 中全局注册，任意章节 md 直接
 * <TangentExplorer /> 即可用，无需逐文件 import。
 */
import { defineClientComponent } from 'vitepress'

const TangentCanvas = defineClientComponent(() => import('./TangentCanvas.vue'))
</script>

<template>
  <TangentCanvas />
</template>
