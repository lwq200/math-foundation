<script setup lang="ts">
/**
 * DijkstraExplorer —— Dijkstra 最短路径 交互 包装器（册07 第 03 章）
 * 带权图逐步演示：拖点设权、逐步松弛、高亮最短路径与前驱树。
 * 画布由 DijkstraCanvas 实现，经 defineClientComponent 懒加载（SSR 安全）。
 */
import { defineClientComponent } from 'vitepress'

const DijkstraCanvas = defineClientComponent(() => import('./DijkstraCanvas.vue'))
</script>

<template>
  <DijkstraCanvas />
</template>
