<script setup lang="ts">
/**
 * CDFExplorer —— PDF↔CDF 关系 交互 包装器（P1-3，册06 第 03 章）
 * 拖 x，看到 PDF 下面积逐步累积为 F(x)，且 f(x)=F'(x)。
 */
import { defineClientComponent } from 'vitepress'

const CDFExplorerCanvas = defineClientComponent(() => import('./CDFExplorerCanvas.vue'))
</script>

<template>
  <CDFExplorerCanvas />
</template>
