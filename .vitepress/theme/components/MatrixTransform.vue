<script setup lang="ts">
/**
 * MatrixTransform —— 矩阵变换·单位圆→椭圆 交互 包装器（P0-4，册04 第 06 章）
 * 调整 2×2 矩阵四个元素，看单位圆被 A 作用后变成椭圆——
 * 椭圆主轴方向即特征向量方向（Av=λv 方向不变）。
 */
import { defineClientComponent } from 'vitepress'

const MatrixTransformCanvas = defineClientComponent(() => import('./MatrixTransformCanvas.vue'))
</script>

<template>
  <MatrixTransformCanvas />
</template>
