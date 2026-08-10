<script setup lang="ts">
/**
 * KLDivergence —— KL 散度不对称 交互 包装器（P1-7，册06 第 09 章）
 * 拖 P、Q 两个三桶分布的高度，实时看 KL(P‖Q) 与 KL(Q‖P)——
 * 方向敏感（加权不同），体会"用错分布多花的比特"。
 */
import { defineClientComponent } from 'vitepress'

const KLDivergenceCanvas = defineClientComponent(() => import('./KLDivergenceCanvas.vue'))
</script>

<template>
  <KLDivergenceCanvas />
</template>
