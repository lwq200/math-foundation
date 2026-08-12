// 构建后处理：收缩首屏 modulepreload 列表。
// 背景：VitePress 自研 HTML preload 生成逻辑，会为入口可达的【全部】chunk
// （含 36 个 mermaid diagram + 12 个 Canvas 懒加载组件）生成 modulepreload。
// 60+ chunks 首屏全量预取会占死浏览器连接池，2.7MB 的 jsxgraph 曾因此
// 排队 ~15s（交互画布长时间空白）。此处删除非核心 preload：
//   - mermaid diagram chunks：SSR 已把图渲染成 SVG，客户端按需再由
//     __vitePreload 下载（即便需要也不影响功能）
//   - 12 个 Canvas 组件：defineClientComponent 懒加载，挂载时 __vitePreload
//     自动按需预取（jsxgraph 已在首屏缓存）
// 保留：framework/theme/jsxgraph/katex/dagre/mermaid 主包等核心依赖。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = '.vitepress/dist'
const htmls = []
function walk(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) walk(join(dir, f.name))
    else if (f.name.endsWith('.html')) htmls.push(join(dir, f.name))
  }
}
walk(dist)

// 需从首屏 preload 移除的 chunk：mermaid diagram chunks + Canvas 懒加载组件
const isDeferrable = (name) => /([Dd]iagram|definition)/.test(name) || /Canvas\./.test(name)

let totalRemoved = 0
for (const file of htmls) {
  const html = readFileSync(file, 'utf8')
  const before = (html.match(/rel="modulepreload"/g) || []).length
  const next = html.replace(
    /<link rel="modulepreload" href="([^"]+)"[^>]*>\s*/g,
    (m, href) => (isDeferrable(href.split('/').pop() || href) ? '' : m),
  )
  if (next !== html) {
    writeFileSync(file, next)
    const after = (next.match(/rel="modulepreload"/g) || []).length
    totalRemoved += before - after
    console.log(`patched ${file.replace(dist + '/', '')}: ${before} -> ${after} preloads`)
  }
}
console.log(`removed ${totalRemoved} preload links total`)
