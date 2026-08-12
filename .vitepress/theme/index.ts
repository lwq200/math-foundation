import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import 'katex/dist/katex.min.css'
import './custom.css'
// 首屏预载 JSXGraph：12 个交互画布（TangentCanvas 等）经 defineClientComponent 懒加载，
// 其依赖的 jsxgraph chunk 直到组件挂载才被 __vitePreload 请求，恰逢 60+ 个 mermaid
// chunk 下载高峰，被浏览器连接池排队 ~19s（画布长时间空白）。此处把 jsxgraph 拉进
// theme 首屏静态依赖链，构建时 index.html 即生成 modulepreload，文档解析早期并行预取。
import 'jsxgraph'
// 交互组件（JSXGraph）：包装器统一在此注册，画布由 defineClientComponent 懒加载。
import TangentExplorer from './components/TangentExplorer.vue'
// 部署集成师的通用交互画布包装器（defineClientComponent 懒加载，SSR 安全）
import VizFigure from './components/VizFigure.vue'
// P1 交互组件：ε-δ 极限带 / 黎曼和逼近 / 梯度下降路径（册02/册03/册05）
import LimitEpsilonDelta from './components/LimitEpsilonDelta.vue'
import RiemannSum from './components/RiemannSum.vue'
import GradientDescent from './components/GradientDescent.vue'
// P1 交互组件（第二批）：正态分布 / ε-N 数列极限 / 点积投影 / PDF↔CDF（册06/册02/册04/册06）
import NormalDistSlider from './components/NormalDistSlider.vue'
import EpsNSequences from './components/EpsNSequences.vue'
import DotProduct from './components/DotProduct.vue'
import CDFExplorer from './components/CDFExplorer.vue'
// P1 交互组件（第三批）：矩阵变换 / KL 散度 / 中心极限定理（册04/册06）
import MatrixTransform from './components/MatrixTransform.vue'
import KLDivergence from './components/KLDivergence.vue'
import CLTSampling from './components/CLTSampling.vue'

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
    app.component('NormalDistSlider', NormalDistSlider)
    app.component('EpsNSequences', EpsNSequences)
    app.component('DotProduct', DotProduct)
    app.component('CDFExplorer', CDFExplorer)
    app.component('MatrixTransform', MatrixTransform)
    app.component('KLDivergence', KLDivergence)
    app.component('CLTSampling', CLTSampling)
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
