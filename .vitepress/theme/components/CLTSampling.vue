<script setup lang="ts">
/**
 * CLTSampling —— 中心极限定理 交互 包装器（P1-2，册06 第 05 章）
 * 从均匀分布 U(0,1) 抽 n 个数的均值，重复采样看直方图逼近正态——
 * 即使总体是"平平的"均匀分布，样本均值也慢慢长出钟形脸。
 */
import { defineClientComponent } from 'vitepress'

const CLTSamplingCanvas = defineClientComponent(() => import('./CLTSamplingCanvas.vue'))
</script>

<template>
  <CLTSamplingCanvas />
</template>
