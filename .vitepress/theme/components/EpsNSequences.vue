<script setup lang="ts">
/**
 * EpsNSequences —— ε-N 数列极限 交互 包装器（P1-9，册02 第 03 章）
 * 拖 ε 看门槛 N(ε) 移动，n>N 后所有点落入 (L−ε, L+ε) 带内。
 */
import { defineClientComponent } from 'vitepress'

const EpsNSequencesCanvas = defineClientComponent(() => import('./EpsNSequencesCanvas.vue'))
</script>

<template>
  <EpsNSequencesCanvas />
</template>
