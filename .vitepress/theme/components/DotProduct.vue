<script setup lang="ts">
/**
 * DotProduct —— 点积/投影/余弦 交互 包装器（P1-8，册04 第 01 章）
 * 拖两个向量端点，实时看 |u|、|v|、u·v、cosθ、投影长度。
 */
import { defineClientComponent } from 'vitepress'

const DotProductCanvas = defineClientComponent(() => import('./DotProductCanvas.vue'))
</script>

<template>
  <DotProductCanvas />
</template>
