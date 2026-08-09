<script setup lang="ts">
/**
 * LimitEpsilonDelta —— ε-δ 极限交互 包装器（对应 P0-1「ε-δ 极限带」，册02 第 04 章）
 *
 * 薄包装层：仅客户端 + 懒加载。绘图逻辑在 LimitEpsilonDeltaCanvas.vue。
 * SSR 安全（defineClientComponent）；jsxgraph 独立 chunk 懒加载。
 */
import { defineClientComponent } from 'vitepress'

const LimitEpsilonDeltaCanvas = defineClientComponent(() => import('./LimitEpsilonDeltaCanvas.vue'))
</script>

<template>
  <LimitEpsilonDeltaCanvas />
</template>
