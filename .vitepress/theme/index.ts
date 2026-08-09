import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import 'katex/dist/katex.min.css'
import './custom.css'
// 交互组件（JSXGraph）：包装器统一在此注册，画布由 defineClientComponent 懒加载。
import TangentExplorer from './components/TangentExplorer.vue'
// 部署集成师的通用交互画布包装器（defineClientComponent 懒加载，SSR 安全）
import VizFigure from './components/VizFigure.vue'
// P1 交互组件：ε-δ 极限带 / 黎曼和逼近 / 梯度下降路径（册02/册03/册05）
import LimitEpsilonDelta from './components/LimitEpsilonDelta.vue'
import RiemannSum from './components/RiemannSum.vue'
import GradientDescent from './components/GradientDescent.vue'

/**
 * 对话体段落分类：正文中对话段为 <p><strong>老谟/造物主</strong>："…"</p>。
 * 纯 CSS 无法按 strong 文本匹配，故在客户端据此给段落追加
 * dialog-lao / dialog-maker 类，实现老谟 / 造物主两套视觉区分。
 * 仅在客户端运行（SSR 阶段 window 不存在时直接返回），不污染 SSR HTML。
 */
function classifyDialog() {
  if (typeof window === 'undefined') return
  document.querySelectorAll('.vp-doc p').forEach((p) => {
    if (p.classList.contains('dialog-lao') || p.classList.contains('dialog-maker')) return
    const first = p.firstElementChild
    if (!first || first.tagName !== 'STRONG') return
    const text = (first.textContent || '').trim()
    if (text === '老谟') p.classList.add('dialog-lao')
    else if (text === '造物主') p.classList.add('dialog-maker')
  })
}

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app, router }) {
    // 全局注册交互组件包装器：任意章节 md 直接 <TangentExplorer /> / <VizFigure />
    // 即可用，无需逐文件 import。按需轻量，后续组件统一在此集中注册包装器。
    app.component('TangentExplorer', TangentExplorer)
    app.component('VizFigure', VizFigure)
    app.component('LimitEpsilonDelta', LimitEpsilonDelta)
    app.component('RiemannSum', RiemannSum)
    app.component('GradientDescent', GradientDescent)
    // 每次路由切换后（含首屏）重新分类，保证 SSR 直出的页面也有样式
    router.onAfterRouteChanged = () => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => classifyDialog())
      } else {
        classifyDialog()
      }
    }
  },
}

export default theme
