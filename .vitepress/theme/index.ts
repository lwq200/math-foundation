import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import 'katex/dist/katex.min.css'
import './custom.css'

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
  enhanceApp({ router }) {
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
