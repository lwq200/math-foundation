<script setup lang="ts">
/**
 * RiemannSum —— 黎曼和 → 定积分 交互 包装器（对应 P0-2「黎曼和→定积分逼近」，册03 第 04 章）
 *
 * 薄包装层：仅客户端 + 懒加载。绘图逻辑在 RiemannSumCanvas.vue。
 */
import { defineClientComponent } from 'vitepress'

const RiemannSumCanvas = defineClientComponent(() => import('./RiemannSumCanvas.vue'))
</script>

<template>
  <RiemannSumCanvas />
</template>
