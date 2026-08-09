<script setup lang="ts">
/**
 * NormalDistSlider —— 正态分布 μ/σ 交互 包装器（P1-1，册06 第 07 章）
 * 拖 μ 平移钟形、拖 σ 改变胖瘦，面积恒为 1（纠正"PDF 纵轴=概率"误区）。
 */
import { defineClientComponent } from 'vitepress'

const NormalDistSliderCanvas = defineClientComponent(() => import('./NormalDistSliderCanvas.vue'))
</script>

<template>
  <NormalDistSliderCanvas />
</template>
