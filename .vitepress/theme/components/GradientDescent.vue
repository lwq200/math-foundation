<script setup lang="ts">
/**
 * GradientDescent —— 梯度下降路径 交互 包装器（对应 P0-5「梯度=最陡上升、等高线+迭代路径」，册05 第 06 章）
 *
 * 薄包装层：仅客户端 + 懒加载。绘图逻辑在 GradientDescentCanvas.vue。
 */
import { defineClientComponent } from 'vitepress'

const GradientDescentCanvas = defineClientComponent(() => import('./GradientDescentCanvas.vue'))
</script>

<template>
  <GradientDescentCanvas />
</template>
