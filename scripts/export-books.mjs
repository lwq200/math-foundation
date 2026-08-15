// export-books.mjs — 将《数学基础》7 册 Markdown 导出为 PDF 与 EPUB
//
// 用法：
//   node scripts/export-books.mjs            # 导出全部 7 册
//   node scripts/export-books.mjs --book 1   # 只导出册01
//   node scripts/export-books.mjs --skip-pdf # 只导出 EPUB
//
// 产物：public/downloads/册XX-*.pdf + .epub（构建时随 public 自动进 dist）
//
// 技术方案（不依赖 pandoc / calibre）：
//   - markdown-it + @mdit/plugin-katex（delimiters:'all'）渲染正文与公式
//   - mermaid 服务端 render 为内联 SVG（失败降级为文本代码块）
//   - 图片统一 data URI（PDF）或 EPUB 内资源文件
//   - PDF：Playwright headless Chromium page.pdf()
//   - EPUB：jszip 打包（mimetype 首位 STORE）

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownIt from 'markdown-it'
import { katex } from '@mdit/plugin-katex'
import container from 'markdown-it-container'
import JSZip from 'jszip'
import { randomUUID } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(root, 'public', 'downloads')
const PUBLIC_DIR = join(root, 'public')

// ---------------------------------------------------------------------------
// 册配置（顺序与 .vitepress/config.mts sidebar 一致；文件名对应各册 .md）
// ---------------------------------------------------------------------------
const BOOKS = [
  { id: '册01-逻辑与数', title: '册01 · 逻辑与数', theme: '从比特到命题：地基四件套',
    chapters: ['第01章-数', '第02章-逻辑', '第03章-集合', '第04章-函数', '第05章-证明方法入门', '第06章-证明实战', '答案速查页'] },
  { id: '册02-实数极限与连续', title: '册02 · 实数极限与连续', theme: '小数怎么塞进比特，极限如何被钉死',
    chapters: ['第01章-实数', '第02章-浮点', '第03章-数列极限', '第04章-函数极限', '第05章-连续', '答案速查页'] },
  { id: '册03-单变量微积分', title: '册03 · 单变量微积分', theme: '变化率与累积的严格版本',
    chapters: ['第01章-导数', '第02章-求导法则与链式法则', '第03章-中值定理', '第04章-积分与FTC', '第05章-积分技巧', '第06章-数列与级数', '第07章-幂级数与泰勒', '第08章-微积分的工程应用', '答案速查页'] },
  { id: '册04-线性代数', title: '册04 · 线性代数', theme: '矩阵的骨架与变换',
    chapters: ['第01章-向量', '第02章-向量空间与子空间', '第03章-矩阵', '第04章-线性方程组与高斯消元', '第05章-行列式', '第06章-特征值与特征向量', '第07章-对角化', '第08章-内积空间与正交', '第09章-SVD与PCA', '答案速查页'] },
  { id: '册05-多元微积分与凸优化', title: '册05 · 多元微积分与凸优化', theme: '高维怎么找最优',
    chapters: ['第01章-多元函数与偏导', '第02章-多元链式法则与多元泰勒', '第03章-多元积分', '第04章-凸集与凸函数', '第05章-凸性判定与二次型', '第06章-无约束优化与梯度下降', '第07章-高维景观鞍点与局部最优', '第08章-约束优化拉格朗日与KKT', '答案速查页'] },
  { id: '册06-概率统计与信息', title: '册06 · 概率统计与信息', theme: '随机如何量化：双轨并述',
    chapters: ['第01章-概率公理', '第02章-条件概率与独立', '第03章-随机变量与分布', '第04章-期望与方差', '第05章-频率派统计', '第06章-贝叶斯推断', '第07章-常见分布族', '第08章-信息熵与条件熵', '第09章-互信息与KL散度', '答案速查页'] },
  { id: '册07-图论与可计算性', title: '册07 · 图论与可计算性', theme: '连接关系与算的边界',
    chapters: ['第01章-图的基础', '第02章-树与图的遍历', '第03章-最短路径与Dijkstra', '第04章-图着色', '第05章-欧拉与哈密顿', '第06章-计算模型与图灵机', '第07章-可判定性与停机问题', '第08章-P与NP', '答案速查页'] },
]

// ---------------------------------------------------------------------------
// 命令行参数
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const onlyBook = (() => {
  const i = args.indexOf('--book')
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : null
})()
const skipPdf = args.includes('--skip-pdf')

// ---------------------------------------------------------------------------
// 渲染基础：markdown-it + katex + 容器
// ---------------------------------------------------------------------------
const md = new MarkdownIt({
  html: true,           // 正文可能有少量内联 HTML
  linkify: false,
  typographer: false,
  breaks: false,
})
md.use(katex, { mathFence: true, output: 'html', delimiters: 'all', throwOnError: false, strict: false })

// 通用 VitePress 风格容器 :::tip / :::warning / :::danger / :::note / :::info / :::details
const CONTAINERS = ['tip', 'warning', 'danger', 'note', 'info', 'details']
for (const name of CONTAINERS) {
  md.use(container, name, {
    validate: (params) => params.trim().startsWith(name),
    render(tokens, idx) {
      const t = tokens[idx]
      if (t.nesting === 1) {
        // 提取标题（:::tip 标题 里的标题部分）
        const rest = t.info.trim().slice(name.length).trim()
        const label = rest || { tip: '提示', warning: '注意', danger: '警告', note: '说明', info: '信息', details: '详情' }[name]
        return `<div class="admonition admonition-${name}"><p class="admonition-title">${label}</p>\n`
      }
      return '</div>\n'
    },
  })
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---------------------------------------------------------------------------
// 章节渲染：md -> HTML
// mermaid 块收集为 [{id, code}]，以占位 div 留在 HTML 中，随后统一渲染成 PNG。
// epubImages 模式：图片改引 EPUB 内资源相对路径。
// ---------------------------------------------------------------------------
async function renderChapter(mdPath, tag, epubImages) {
  let src = readFileSync(mdPath, 'utf8')

  // 1) 提取 mermaid 代码块 -> 占位 div（markdown-it 不会碰它）
  const mermaid = []
  src = src.replace(/```mermaid\n([\s\S]*?)```/g, (_m, code) => {
    const id = `mmd_${tag.replace(/[^a-zA-Z0-9_]/g, '_')}_${mermaid.length}`
    mermaid.push({ id, code: code.trim() })
    return `\n\n<div class="mmd-ph" id="${id}"></div>\n\n`
  })

  // 2) markdown 渲染
  let html = md.render(src)

  // 2.5) 交互组件裸标签（Vue 组件在 markdown 中会被 html:true 原样透传，
  //       导出版（PDF/EPUB）无 JS 水合，必须替换为静态说明块，否则读者看到尖括号裸文本）
  const COMPONENT_NAMES = ['DijkstraExplorer', 'CDFExplorer', 'CLTSampling', 'NormalDistSlider', 'KLDivergence',
    'TangentExplorer', 'RiemannSum', 'MatrixTransform', 'GradientDescent', 'DotProduct', 'LimitEpsilonDelta', 'EpsNSequences']
  const compRe = new RegExp(`<(${COMPONENT_NAMES.join('|')})\\s*/?>`, 'g')
  html = html.replace(compRe, (m, name) =>
    `<div class="interactive-note"><strong>交互演示（${name}）</strong>：此组件为在线版的动态演示，离线 PDF/EPUB 中无法交互。完整推导见本章正文与「计算训练场」。</div>`
  )

  // 3) 图片处理
  html = html.replace(/<img src="([^"]+)"([^>]*)>/g, (full, srcAttr, rest) => {
    let p = srcAttr
    if (p.startsWith('/math-foundation/')) p = p.replace('/math-foundation/', '')
    else if (p.startsWith('/assets/')) p = p.replace(/^\//, '')
    else if (p.startsWith('/')) p = p.replace(/^\//, '')
    const abs = resolve(PUBLIC_DIR, p)
    if (!existsSync(abs) || statSync(abs).isDirectory()) return full
    const ext = extname(abs).toLowerCase()
    const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream'
    if (epubImages) {
      const name = basename(abs)
      epubImages.push({ src: `images/${name}`, absPath: abs })
      return `<img src="../images/${name}"${rest}>`
    }
    const b64 = readFileSync(abs).toString('base64')
    return `<img src="data:${mime};base64,${b64}"${rest}>`
  })

  return { html, mermaid }
}

// ---------------------------------------------------------------------------
// Mermaid：用 Chromium 渲染为 PNG（PDF 与 EPUB 共用，兼容性最佳）
// 需要本地 http 提供 mermaid ESM（file:// 下 module import 受 CORS 限制）
// ---------------------------------------------------------------------------
import { createServer } from 'node:http'

async function renderMermaidPngs(list) {
  if (!list.length) return []
  const { chromium } = await import('playwright')
  const exe = findChrome()
  const browser = await chromium.launch(exe ? { executablePath: exe } : {})
  const page = await browser.newPage({ viewport: { width: 1800, height: 1400 } })

  const mmdFile = join(root, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js')
  const server = createServer((req, res) => {
    if (req.url === '/mmd/mermaid.min.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' })
      res.end(readFileSync(mmdFile))
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<!DOCTYPE html><html><head><script src="/mmd/mermaid.min.js"></script></head><body></body></html>')
    }
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
    await page.evaluate(() => {
      const mmd = window.mermaid
      if (!mmd) throw new Error('mermaid UMD 未加载')
      window.__mmd = mmd
      mmd.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'base',
        themeVariables: {
          primaryColor: '#2f6f4f33', primaryBorderColor: '#2f6f4f', primaryTextColor: '#2b302e',
          lineColor: '#2f6f4f', secondaryColor: '#c9a22722', secondaryBorderColor: '#c9a227',
          tertiaryColor: '#b3382c22', tertiaryBorderColor: '#b3382c', nodeBorderRadius: '8px',
          fontFamily: "'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif", fontSize: '14px',
        },
        flowchart: { htmlLabels: false, useMaxWidth: false },
      })
    })

    const out = []
        const shotPage = await browser.newPage({ viewport: { width: 1800, height: 1400 }, deviceScaleFactor: 2 })
        for (const item of list) {
          let svgStr = null
          try {
            svgStr = await page.evaluate(async ({ id, code }) => {
              const r = await window.__mmd.render(`svg_${id}`, code)
              return r.svg
            }, item)
          } catch (e) {
            console.warn(`[export] mermaid ${item.id} 渲染失败，降级为文本: ${e.message}`)
          }
          if (svgStr) {
            try {
              // 用 Chromium 截图 SVG（中文字体完美支持；librsvg 在 sharp 里常找不到 Windows 字体）。
              // 关键：不要强行把 width 设为 1600——mermaid 输出的 svg 自带 width/height（按 viewBox），
              // 若强制 1600 宽 + height:auto，纵向流程图会被等比放大成几页高（册01 曾 3520px≈5 页）。
              // 保持原生尺寸渲染，用 deviceScaleFactor 提升清晰度（2x），嵌入时由 img{max-width:100%} 约束。
              const html = `<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;background:#fff}</style></head><body>${svgStr}</body></html>`
              await shotPage.setContent(html, { waitUntil: 'load' })
              await shotPage.evaluate(() => document.fonts?.ready)
              const png = await shotPage.locator('svg').screenshot()
              out.push({ id: item.id, png })
            } catch (e) {
              console.warn(`[export] mermaid ${item.id} 截图失败，降级为文本: ${e.message}`)
              out.push({ id: item.id, png: null, code: item.code })
            }
          } else {
            out.push({ id: item.id, png: null, code: item.code })
          }
        }
        await shotPage.close()
            return out
          } finally {
    server.close()
    await browser.close()
  }
}

// 把渲染好的 mermaid PNG 嵌入章节 HTML（pdf: data URI；epub: 资源相对路径）
function embedMermaid(html, mmdPngs, mode, epubImages) {
  for (const { id, png, code } of mmdPngs) {
    const ph = `<div class="mmd-ph" id="${id}"></div>`
    if (!png) {
      html = html.split(ph).join(`<pre class="mermaid-fallback"><code>${escapeHtml(code || '')}</code></pre>`)
      continue
    }
    if (mode === 'pdf') {
      html = html.split(ph).join(`<img class="mmd-img" src="data:image/png;base64,${png.toString('base64')}"/>`)
    } else {
      const name = `mmd-${id}.png`
      epubImages.push({ src: `images/${name}`, buf: png })
      html = html.split(ph).join(`<img class="mmd-img" src="../images/${name}"/>`)
    }
  }
  return html
}

// ---------------------------------------------------------------------------
// KaTeX 样式（字体 data URI 内联，供 PDF 单文件自足）
// ---------------------------------------------------------------------------
function katexCssInline() {
  const css = readFileSync(join(root, 'node_modules', 'katex', 'dist', 'katex.min.css'), 'utf8')
  return css.replace(/url\(fonts\/([^)]+)\)/g, (_m, f) => {
    const abs = join(root, 'node_modules', 'katex', 'dist', 'fonts', f)
    if (!existsSync(abs)) return _m
    return `url(data:font/woff2;base64,${readFileSync(abs).toString('base64')})`
  })
}

// ---------------------------------------------------------------------------
// 排版样式（PDF 与 EPUB 共用）
// ---------------------------------------------------------------------------
const BOOK_CSS = `
  body { font-family: "PingFang SC","Microsoft YaHei","Noto Sans SC","Source Han Sans SC","Hiragino Sans GB",sans-serif;
         font-size: 15px; line-height: 1.85; color: #222; margin: 0; }
  h1, h2, h3, h4, h5 { color: #1d3d2f; line-height: 1.4; }
  h1 { font-size: 26px; margin-top: 0; }
  h2 { font-size: 20px; margin-top: 1.6em; border-bottom: 1px solid #e0ded5; padding-bottom: .2em; }
  h3 { font-size: 17px; margin-top: 1.4em; }
  h4 { font-size: 15px; margin-top: 1.2em; }
  p { margin: .6em 0; text-align: justify; }
  blockquote { border-left: 3px solid #2f6f4f; margin: .8em 0; padding: .2em 0 .2em 1em; color: #4a4a44; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 13.5px; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; word-break: break-word; overflow-wrap: break-word; }
  th { background: #f0f4f1; }
  pre { background: #f6f6f2; border: 1px solid #e6e4da; border-radius: 6px; padding: 12px;
        white-space: pre-wrap; word-wrap: break-word; font-size: 13px; line-height: 1.6; }
  code { font-family: Consolas, Menlo, "Courier New", monospace; font-size: 13px; }
  p code, li code, td code { background: #f0efeb; padding: 1px 5px; border-radius: 3px; }
  pre code { background: none; padding: 0; }
  img { max-width: 100%; height: auto; }
  /* mermaid 纵向流程图可能原生比一页还高：限制显示高度，整体缩放进一页，
     避免 break-inside:avoid 无法整块跳页导致被横跨多页截断（清晰度由 2x 分辨率保证） */
  .mmd-img { max-width: 100%; max-height: 22.6cm; height: auto; }
  hr { border: none; border-top: 1px dashed #bbb; margin: 1.6em 0; }
  ul, ol { padding-left: 1.6em; }
  li { margin: .3em 0; }
  .katex-display { overflow-x: auto; overflow-y: hidden; padding: 4px 0; }
  .admonition { border: 1px solid #d9d6cb; border-left-width: 4px; border-radius: 6px; padding: .6em 1em; margin: 1em 0; }
  .admonition-title { font-weight: 700; margin: 0 0 .4em; }
  .admonition-tip { border-left-color: #2f6f4f; } .admonition-note { border-left-color: #2f6f4f; }
  .admonition-warning { border-left-color: #c9a227; } .admonition-danger { border-left-color: #b3382c; }
  .admonition-info { border-left-color: #35618f; }
  .mermaid-fallback { white-space: pre-wrap; }
  .interactive-note { border: 1px dashed #c9a227; background: #fbf7ea; border-radius: 6px;
                      padding: .5em .8em; margin: 1em 0; font-size: 13.5px; color: #6b5a1e; }
  /* ---- 打印分页保护：防止图/表/公式/代码块在页边界被切断 ---- */
  img, .mmd-img, .katex-display, pre, .admonition, blockquote {
    break-inside: avoid; page-break-inside: avoid;
  }
  table { break-inside: auto; page-break-inside: auto; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  h1, h2, h3, h4, h5 { break-after: avoid; page-break-after: avoid; }
`

// 自动探测本机 ms-playwright 已下载的 Chromium（版本可能与当前 playwright 期望不一致）
function findChrome() {
  const base = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : null
  if (!base || !existsSync(base)) return null
  for (const d of readdirSync(base)) {
    const dir = join(base, d)
    if (!statSync(dir).isDirectory()) continue
    const candidates = [
      join(dir, 'chrome-win64', 'chrome.exe'),
      join(dir, 'chrome-win', 'chrome.exe'),
      join(dir, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
      join(dir, 'chrome-headless-shell-win', 'chrome-headless-shell.exe'),
    ]
    for (const c of candidates) if (existsSync(c)) return c
  }
  return null
}

// ---------------------------------------------------------------------------
// PDF 组装
// ---------------------------------------------------------------------------
async function buildPdf(book, chapters, mmdPngs, outPath) {
  const { chromium } = await import('playwright')
  const exe = findChrome()
  const browser = await chromium.launch(exe ? { executablePath: exe } : {})
  const page = await browser.newPage()

  const tocItems = chapters.map((c, i) => `<li><a href="#ch${i}">${escapeHtml(c.title)}</a></li>`).join('\n')
  const chapterSections = chapters.map((c, i) => {
    const h = mmdPngs.length ? embedMermaid(c.html, mmdPngs, 'pdf', null) : c.html
    return `<section class="chapter" id="ch${i}">${h}</section>`
  })
  const body = [
    `<section class="cover">
       <div class="cover-box">
         <h1>${book.title}</h1>
         <p class="subtitle">《数学基础》· 创世游戏系列丛书基础卷</p>
         <p class="theme">${book.theme}</p>
         <p class="meta">7 册 · 53 章 · 苏格拉底对话体自学教材<br>造物主（读者）⇄ 老谟（毒舌导师）—— 知识是推导出来的，不是背出来的</p>
         <p class="license">开源教材 · CC BY 4.0 · 在线版：lwq200.github.io/math-foundation</p>
       </div>
     </section>`,
    `<section class="toc-page"><h1>目录</h1><ol class="toc">${tocItems}</ol></section>`,
    ...chapterSections,
  ].join('\n')

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>${book.title}</title>
<style>
  ${katexCssInline()}
  ${BOOK_CSS}
  .cover { page-break-after: always; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
  .cover-box { text-align: center; padding: 0 3cm; }
  .cover h1 { font-size: 34px; margin-bottom: .4em; }
  .cover .subtitle { font-size: 16px; color: #4a6b5a; }
  .cover .theme { font-size: 15px; color: #666; margin-top: 1.2em; }
  .cover .meta { font-size: 13px; color: #777; margin-top: 2em; line-height: 1.9; }
  .cover .license { font-size: 12px; color: #999; margin-top: 3em; }
  .toc-page { page-break-after: always; }
  .toc { font-size: 15px; line-height: 2.1; }
  .toc a { color: #2f6f4f; text-decoration: none; }
  section.chapter { page-break-before: always; }
</style></head><body>${body}</body></html>`

  // 临时文件（data URI 有 ~2MB 上限，KaTeX 字体内联后 HTML 偏大，走 file://）
  const tmp = join(root, '.tmp-export', `pdf-${book.id}.html`)
  mkdirSync(dirname(tmp), { recursive: true })
  writeFileSync(tmp, html, 'utf8')

  await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'load' })
  // 等 KaTeX/字体渲染完成
  await page.evaluate(() => document.fonts?.ready)
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:8px;color:#999;width:100%;text-align:center;padding:0 1.5cm;">《数学基础》· 创世游戏系列丛书基础卷</div>',
    footerTemplate: '<div style="font-size:8px;color:#999;width:100%;text-align:center;">第 <span class="pageNumber"></span> 页 · 共 <span class="totalPages"></span> 页</div>',
    margin: { top: '1.7cm', bottom: '1.5cm', left: '1.6cm', right: '1.6cm' },
  })

  await browser.close()
  console.log(`[export] PDF 完成: ${outPath}`)
}

// ---------------------------------------------------------------------------
// EPUB 组装
// ---------------------------------------------------------------------------
async function buildEpub(book, chapters, mmdPngs, outPath) {
  const zip = new JSZip()
  // mimetype 必须第一位且 STORE
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`)

  const uid = `urn:uuid:${randomUUID()}`
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const lang = 'zh-CN'

  // 资源收集：图片 + 字体
  const images = []
  const fontsDir = join(root, 'node_modules', 'katex', 'dist', 'fonts')
  const fonts = existsSync(fontsDir) ? readdirSync(fontsDir).filter((f) => f.endsWith('.woff2')) : []

  let itemSeq = 0
  const autoId = () => `it-${itemSeq++}`
  const manifestItems = []

  // cover
  const coverHtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head><title>${book.title}</title><link rel="stylesheet" href="css/book.css"/></head>
<body><div class="epub-cover">
  <h1>${book.title}</h1>
  <p class="subtitle">《数学基础》· 创世游戏系列丛书基础卷</p>
  <p class="theme">${book.theme}</p>
  <p class="meta">7 册 · 53 章 · 苏格拉底对话体自学教材<br/>造物主（读者）⇄ 老谟（毒舌导师）</p>
  <p class="license">开源教材 · CC BY 4.0</p>
</div></body></html>`
  zip.file('OEBPS/cover.xhtml', coverHtml)
  manifestItems.push(`<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`)

  // nav（目录）
  const navLis = chapters.map((c, i) => `<li><a href="chapters/ch${i}.xhtml">${escapeHtml(c.title)}</a></li>`).join('\n')
  const navHtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}">
<head><title>目录</title></head>
<body><nav epub:type="toc"><h1>目录</h1><ol>${navLis}</ol></nav></body></html>`
  zip.file('OEBPS/nav.xhtml', navHtml)
  manifestItems.push(`<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`)

  // 各章
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i]
    const chapterHtml = mmdPngs.length ? embedMermaid(c.html, mmdPngs, 'epub', images) : c.html
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head><title>${escapeHtml(c.title)}</title>
<link rel="stylesheet" href="../css/book.css"/><link rel="stylesheet" href="../css/katex.min.css"/></head>
<body>${chapterHtml}</body></html>`
    zip.file(`OEBPS/chapters/ch${i}.xhtml`, xhtml)
    manifestItems.push(`<item id="ch${i}" href="chapters/ch${i}.xhtml" media-type="application/xhtml+xml"/>`)
    for (const img of c.images) images.push(img)
  }

  // CSS
  zip.file('OEBPS/css/book.css', BOOK_CSS)
  manifestItems.push(`<item id="css-book" href="css/book.css" media-type="text/css"/>`)
  const katexCss = readFileSync(join(root, 'node_modules', 'katex', 'dist', 'katex.min.css'), 'utf8')
  zip.file('OEBPS/css/katex.min.css', katexCss)
  manifestItems.push(`<item id="css-katex" href="css/katex.min.css" media-type="text/css"/>`)

  // 字体（去重）
  const seenFonts = new Set()
  for (const f of fonts) {
    if (seenFonts.has(f)) continue
    seenFonts.add(f)
    zip.file(`OEBPS/fonts/${f}`, readFileSync(join(fontsDir, f)), { compression: 'DEFLATE' })
    manifestItems.push(`<item id="${autoId()}" href="fonts/${f}" media-type="font/woff2"/>`)
  }

  // 图片（去重）
  const seenImgs = new Set()
  for (const img of images) {
    if (seenImgs.has(img.src)) continue
    seenImgs.add(img.src)
    const name = basename(img.src)
    const buf = img.buf || readFileSync(img.absPath)
    zip.file(`OEBPS/images/${name}`, buf, { compression: 'DEFLATE' })
    const ext = extname(name).toLowerCase()
    const media = ext === '.svg' ? 'image/svg+xml' : 'image/png'
    manifestItems.push(`<item id="${autoId()}" href="images/${name}" media-type="${media}"/>`)
  }

  const manifest = manifestItems.join('\n  ')
  const spineList = ['cover', 'nav', ...chapters.map((_, i) => `ch${i}`)]

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${uid}</dc:identifier>
    <dc:title>${book.title}（《数学基础》· 创世游戏系列丛书基础卷）</dc:title>
    <dc:creator>创世游戏系列</dc:creator>
    <dc:language>${lang}</dc:language>
    <dc:rights>CC BY 4.0</dc:rights>
    <dc:description>苏格拉底对话体自学教材：造物主（读者）⇄ 老谟（毒舌导师），从零重新推导。</dc:description>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
  ${manifest}
  </manifest>
  <spine>${spineList.map((id) => `<itemref idref="${id}"/>`).join('')}</spine>
</package>`

  zip.file('OEBPS/content.opf', opf)
  zip.file('OEBPS/toc.ncx', buildNcx(book, chapters, uid, now, lang))

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    streamFiles: false,
  })
  writeFileSync(outPath, content)
  console.log(`[export] EPUB 完成: ${outPath} (${(content.length / 1024).toFixed(0)} KB)`)
}

function buildNcx(book, chapters, uid, now, lang) {
  const navPoints = chapters
    .map((c, i) => `    <navPoint id="np${i}" playOrder="${i + 1}"><navLabel><text>${escapeHtml(c.title)}</text></navLabel><content src="chapters/ch${i}.xhtml"/></navPoint>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${uid}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
  <docTitle><text>${book.title}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const list = onlyBook ? BOOKS.slice(onlyBook - 1, onlyBook) : BOOKS

  for (let bi = 0; bi < list.length; bi++) {
    const book = list[bi]
    console.log(`[export] === ${book.id} ===`)
    const chapters = []
    for (let ci = 0; ci < book.chapters.length; ci++) {
      const name = book.chapters[ci]
      const mdPath = join(root, book.id, `${name}.md`)
      if (!existsSync(mdPath)) {
        console.warn(`[export] 缺文件: ${mdPath}，跳过`)
        continue
      }
      const images = []
      const { html, mermaid } = await renderChapter(mdPath, `${bi}_${ci}`, images)
      // 章节标题取 md 第一行 # 标题
      const first = readFileSync(mdPath, 'utf8').split('\n').find((l) => l.trim().startsWith('# '))
      const title = first ? first.replace(/^#\s+/, '').trim() : name
      chapters.push({ html, images, title, name, mermaid })
      console.log(`[export]   渲染: ${name} (${title})`)
    }

    // 统一渲染本册全部 mermaid -> PNG
    const allMermaid = chapters.flatMap((c) => c.mermaid || [])
    let mmdPngs = []
    if (allMermaid.length) {
      try {
        mmdPngs = await renderMermaidPngs(allMermaid)
        console.log(`[export]   mermaid: ${allMermaid.length} 张 -> PNG ${mmdPngs.length} 张`)
      } catch (e) {
        console.warn(`[export] mermaid 渲染失败（将降级为文本）: ${e.message}`)
      }
    }

    const pdfOut = join(OUT_DIR, `${book.id}.pdf`)
    const epubOut = join(OUT_DIR, `${book.id}.epub`)

    if (!skipPdf) {
      try {
        await buildPdf(book, chapters, mmdPngs, pdfOut)
      } catch (e) {
        console.error(`[export] PDF 失败 ${book.id}: ${e.message}`)
      }
    }
    try {
      await buildEpub(book, chapters, mmdPngs, epubOut)
    } catch (e) {
      console.error(`[export] EPUB 失败 ${book.id}: ${e.message}`)
    }
  }
  console.log('[export] 全部完成')
}

main()
