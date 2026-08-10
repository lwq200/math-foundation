// scripts/diag-all.mjs — 《数学基础》第二轮全页运行验证（Playwright 骨架）
//
// ⚠️ 本轮为「只读准备」：清单见 .vitepress/audit/测试清单.md，本脚本骨架供下一轮实测使用。
// 待评审组长问题清单 + 前端修改完成后执行：`node scripts/diag-all.mjs`
//
// 职责（对应测试清单 1–6 节）：
//   1. 对全部交互组件所在章节 + 首页 + 各册章首页 + Mermaid 章节做全页遍历，
//      收集 pageerror / console.error / 关键 svg 渲染 / 读数期望比对。
//   2. 首页 hero 校验（logo / 按钮 href 单 base 前缀，点击无 404）。
//   3. 2 张 SVG 图加载校验。
//   4. 深色模式：切换 .dark 后画布仍在、公式/读数可读。
//
// 运行前提：
//   - `npm run build:all` 已构建（静态资源就位）
//   - `vitepress preview` 端口 4173（未占用则自动拉起，复用 vrt/run.mjs 探活思路）
//   - 本机装有 chromium headless-shell（executablePath 见下）

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const REPORT_DIR = resolve(ROOT, '.vitepress/audit/report')

const PREVIEW_PORT = 4173
const PREVIEW_HOST = `http://localhost:${PREVIEW_PORT}`
const BASE = '/math-foundation/'
const BASE_PATH = BASE.replace(/\/$/, '')

// chromium headless-shell 可执行路径（本机固定版本 1228）
const HEADLESS_SHELL =
  'C:/Users/lwq/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'

const urlFor = (path) => `${PREVIEW_HOST}${BASE_PATH}${path}`

// ---------------------------------------------------------------------------
// 页面清单：<name> / 相对路径 / 页面类型
// ---------------------------------------------------------------------------
const PAGES = [
  { name: 'home', path: '/', type: 'home' },
  // Mermaid
  { name: '册01-01-数', path: '/册01-逻辑与数/第01章-数', type: 'mermaid' },
  { name: '册02-02-浮点', path: '/册02-实数极限与连续/第02章-浮点', type: 'mermaid' },
  { name: '册05-01-多元函数与偏导', path: '/册05-多元微积分与凸优化/第01章-多元函数与偏导', type: 'mermaid' },
  { name: '册05-02-多元链式法则与多元泰勒', path: '/册05-多元微积分与凸优化/第02章-多元链式法则与多元泰勒', type: 'mermaid' },
  { name: '册05-05-凸性判定与二次型', path: '/册05-多元微积分与凸优化/第05章-凸性判定与二次型', type: 'mermaid' },
  // 交互组件（11 个）
  { name: '册02-03-数列极限-EpsN', path: '/册02-实数极限与连续/第03章-数列极限', type: 'component', comp: 'EpsNSequences' },
  { name: '册02-04-函数极限-LimitED', path: '/册02-实数极限与连续/第04章-函数极限', type: 'component+svg', comp: 'LimitEpsilonDelta', svg: 'fig-euler-limit' },
  { name: '册03-01-导数-Tangent', path: '/册03-单变量微积分/第01章-导数', type: 'component+svg', comp: 'TangentExplorer', svg: 'fig-tangent-slope' },
  { name: '册03-04-积分-Riemann', path: '/册03-单变量微积分/第04章-积分与FTC', type: 'component', comp: 'RiemannSum' },
  { name: '册04-01-向量-DotProduct', path: '/册04-线性代数/第01章-向量', type: 'component', comp: 'DotProduct' },
  { name: '册04-06-特征值-Matrix', path: '/册04-线性代数/第06章-特征值与特征向量', type: 'component', comp: 'MatrixTransform' },
  { name: '册05-06-梯度下降-GD', path: '/册05-多元微积分与凸优化/第06章-无约束优化与梯度下降', type: 'component', comp: 'GradientDescent' },
  { name: '册06-03-随机变量-CDF', path: '/册06-概率统计与信息/第03章-随机变量与分布', type: 'component', comp: 'CDFExplorer' },
  { name: '册06-05-频率派-CLT', path: '/册06-概率统计与信息/第05章-频率派统计', type: 'component', comp: 'CLTSampling' },
  { name: '册06-07-分布族-NormalDist', path: '/册06-概率统计与信息/第07章-常见分布族', type: 'component', comp: 'NormalDistSlider' },
  { name: '册06-09-互信息-KL', path: '/册06-概率统计与信息/第09章-互信息与KL散度', type: 'component', comp: 'KLDivergence' },
  // 各册章首页（无渲染异常 + 标题正确）
  { name: '册02-首页-实数', path: '/册02-实数极限与连续/第01章-实数', type: 'chapterHome' },
  { name: '册04-首页-向量', path: '/册04-线性代数/第01章-向量', type: 'chapterHome' },
  { name: '册06-首页-概率公理', path: '/册06-概率统计与信息/第01章-概率公理', type: 'chapterHome' },
]

// 组件 → 画布 svg 选择器 + 读数选择器 + 期望断言（与测试清单 §2 对齐）
const COMPONENTS = {
  EpsNSequences: {
    board: '.epsn-canvas .epsn-board svg',
    readout: '.epsn-canvas .epsn-readout',
    expectText: [
      ['ε = 0.30', { contains: 'ε = 0.30' }],
      ['N(ε)=4', { contains: '⌈1/ε⌉ = 4' }],
    ],
  },
  LimitEpsilonDelta: {
    board: '.eps-canvas .eps-board svg',
    readout: '.eps-canvas .eps-readout',
    expectText: [
      ['ε = 0.80', { contains: 'ε = 0.80' }],
      ['δ = 1.20', { contains: 'δ = 1.20' }],
      ['状态 out', { contains: '曲线穿出' }],
    ],
  },
  TangentExplorer: {
    board: '.tangent-canvas .tan-board svg',
    readout: '.tangent-canvas .tan-readout-static',
    expectText: [
      ['差商=3', { contains: '差商 = 3' }],
      ['f\'(a)=2', { contains: 'f\'(a) = 2' }],
    ],
  },
  RiemannSum: {
    board: '.riemann-canvas .riemann-board svg',
    readout: '.riemann-canvas .riemann-readout',
    expectText: [
      ['n = 8', { contains: 'n = 8' }],
      ['真值 8/3', { contains: '8/3' }],
    ],
  },
  DotProduct: {
    board: '.dp-canvas .dp-board svg',
    readout: '.dp-canvas .dp-readout',
    expectText: [
      ['u·v=5.200', { contains: '5.200' }],
      ['cosθ≈0.6804~0.6805', { regex: /0\.680[45]/ }],
    ],
  },
  MatrixTransform: {
    board: '.mt-canvas .mt-board svg',
    readout: '.mt-canvas .mt-matrix',
    expectText: [['恒等矩阵', { contains: '[[1.0, 0.0], [0.0, 1.0]]' }]],
  },
  GradientDescent: {
    board: '.gd-canvas .gd-board svg',
    readout: '.gd-canvas .gd-readout',
    expectText: [
      ['η=0.06', { contains: 'η = 0.06' }],
      ['f=22.5000', { contains: '22.5000' }],
    ],
  },
  CDFExplorer: {
    board: '.cdf-canvas .cdf-board svg',
    readout: '.cdf-canvas .cdf-readout',
    expectText: [
      ['x=0.50', { contains: 'x = 0.50' }],
      ['Φ(0.5)=0.6915', { contains: '0.6915' }],
    ],
  },
  CLTSampling: {
    board: '.clt-canvas .clt-board svg',
    readout: '.clt-canvas .clt-readout',
    expectText: [['σ=0.1291', { contains: '0.1291' }]],
  },
  NormalDistSlider: {
    board: '.nds-canvas .nds-board svg',
    readout: '.nds-canvas .nds-readout',
    expectText: [
      ['μ=0.00', { contains: 'μ = 0.00' }],
      ['峰值=0.3989', { contains: '0.3989' }],
    ],
  },
  KLDivergence: {
    board: '.kl-canvas .kl-board svg',
    readout: '.kl-canvas .kl-readout',
    expectText: [
      ['KL(P‖Q)=0.000', { contains: 'KL(P‖Q) = 0.000' }],
      ['KL(Q‖P)=0.000', { contains: 'KL(Q‖P) = 0.000' }],
    ],
  },
}

// ---------------------------------------------------------------------------
// preview 探活 / 拉起（复用 vrt/run.mjs 思路，Windows 分支）
// ---------------------------------------------------------------------------
function ensurePreview() {
  return new Promise((resolvePreview, rejectPreview) => {
    const probe = spawn(
      'powershell',
      ['-NoProfile', '-Command', `Test-NetConnection -ComputerName localhost -Port ${PREVIEW_PORT} -InformationLevel Quiet`],
      { shell: true },
    )
    let out = ''
    probe.stdout?.on('data', (d) => (out += d.toString()))
    probe.on('close', (code) => {
      if (out.includes('True')) return resolvePreview(PREVIEW_HOST)
      const child = spawn('npx', ['vitepress', 'preview', '--port', String(PREVIEW_PORT)], {
        cwd: ROOT, stdio: 'inherit', shell: true,
      })
      child.on('error', (e) => rejectPreview(e))
      const deadline = Date.now() + 30_000
      const timer = setInterval(() => {
        if (Date.now() > deadline) { clearInterval(timer); return rejectPreview(new Error('preview 启动超时')) }
        const t = spawn(
          'powershell',
          ['-NoProfile', '-Command', `Test-NetConnection -ComputerName localhost -Port ${PREVIEW_PORT} -InformationLevel Quiet`],
          { shell: true },
        )
        let so = ''
        t.stdout?.on('data', (d) => (so += d.toString()))
        t.on('close', () => {
          if (so.includes('True')) { clearInterval(timer); resolvePreview(PREVIEW_HOST) }
        })
      }, 1500)
    })
  })
}

// ---------------------------------------------------------------------------
// 单个页面诊断：收集 pageerror / console.error / svg 渲染 / 读数期望
// ---------------------------------------------------------------------------
async function diagnosePage(page, p) {
  const errors = []
  page.on('pageerror', (e) => errors.push({ type: 'pageerror', msg: String(e.message || e) }))
  page.on('console', (m) => { if (m.type() === 'error') errors.push({ type: 'console', msg: m.text() }) })
  // 捕获 404 资源的具体 URL（定位公共 404：favicon 等）
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push({ type: 'http', status: r.status(), url: r.url() })
  })

  // 用 'load' 而非 'networkidle'：避免 favicon 404 / 网络瞬断使 networkidle 永不满足导致超时。
  // 失败自动重试一次（网络瞬断属环境噪声）。
  let res = null
  for (let attempt = 0; attempt < 2 && !res; attempt++) {
    try {
      res = await page.goto(urlFor(p.path), { waitUntil: 'load', timeout: 30_000 })
    } catch (e) {
      if (attempt === 0) await page.waitForTimeout(1000)
      else throw e
    }
  }
  const result = { name: p.name, path: p.path, http: res ? res.status() : null, errors: [], checks: {} }

  // 等待正文渲染
  await page.waitForSelector('.vp-doc, .VPHero', { timeout: 10_000 }).catch(() => {})

  // 1) 页面类型专项
  if (p.type === 'home') result.checks.hero = await checkHero(page)
  if (p.type === 'mermaid') result.checks.mermaid = await checkMermaid(page)
  if (p.svg) result.checks.svg = await checkSvgImg(page, p.svg)
  if (p.comp) result.checks.component = await checkComponent(page, COMPONENTS[p.comp])
  if (p.type === 'chapterHome') result.checks.title = await page.locator('h1').first().textContent().catch(() => '—')

  // 2) 深色模式：对含组件/公式/图的页面切换 .dark
  if (p.comp || p.type === 'mermaid' || p.svg) {
    result.checks.dark = await checkDarkMode(page, p)
  }

  // 3) 汇总错误（导航完成后把收集到的错误并入）
  result.errors = errors

  return result
}

async function checkHero(page) {
  const out = {}
  const imgSrc = await page.locator('.VPHero .image-src').first().getAttribute('src').catch(() => null)
  out.heroImageSrc = imgSrc
  out.heroImageSrcBasePrefix = imgSrc ? imgSrc.startsWith(BASE_PATH) : false

  const navLogo = await page
    .locator('.VPNavBarTitle .logo, .VPNavBarTitle img')
    .first()
    .getAttribute('src')
    .catch(() => null)
  out.navLogoSrc = navLogo
  out.navLogoBasePrefix = navLogo ? navLogo.startsWith(BASE_PATH) : false

  const actionHref = await page.locator('.VPHero .action a').first().getAttribute('href').catch(() => null)
  out.actionHref = actionHref
  // 必须「单 base」：以 /math-foundation/ 开头，且不含 /math-foundation/math-foundation/
  out.actionHrefSingleBase =
    actionHref ? actionHref.startsWith(BASE_PATH) && !actionHref.includes(`${BASE_PATH}${BASE_PATH}`) : false

  const h1 = await page.locator('.VPHero .name').first().textContent().catch(() => null)
  out.heroTitle = (h1 || '').trim()

  // favicon：运行时 head 注入的 icon link 的 href（排查裸 /logo.svg 404）
  const icons = await page
    .evaluate(() =>
      Array.from(document.querySelectorAll('link[rel*="icon"]')).map((l) => ({
        rel: l.getAttribute('rel'),
        href: l.getAttribute('href'),
      })),
    )
    .catch(() => [])
  out.iconLinks = icons

  return out
}

async function checkMermaid(page) {
  const count = await page.locator('.mermaid svg').count()
  return { mermaidSvgCount: count, rendered: count > 0 }
}

async function checkSvgImg(page, key) {
  const img = page.locator(`img[src*="${key}"]`).first()
  const ok = await img.evaluate((el) => {
    const e = el
    return {
      src: e.getAttribute('src'),
      complete: e.complete,
      naturalWidth: e.naturalWidth,
    }
  }).catch(() => ({ src: null, complete: false, naturalWidth: 0 }))
  return { ...ok, loaded: ok.complete && ok.naturalWidth > 0 }
}

async function checkComponent(page, spec) {
  const out = {}
  // 画布 svg 渲染
  const svg = page.locator(spec.board).first()
  const svgCount = await svg.count()
  out.boardSvgCount = svgCount
  if (svgCount > 0) {
    out.svgShapeCount = await page
      .locator(`${spec.board} path, ${spec.board} circle, ${spec.board} line, ${spec.board} text`)
      .count()
  } else {
    out.svgShapeCount = 0
  }

  // 读数期望
  const readoutText = (await page.locator(spec.readout).first().textContent().catch(() => '')) || ''
  out.readoutText = readoutText.replace(/\s+/g, ' ').trim()
  out.expects = {}
  for (const [label, matcher] of spec.expectText) {
    if (matcher.regex) out.expects[label] = matcher.regex.test(readoutText)
    else out.expects[label] = readoutText.includes(matcher.contains)
  }
  return out
}

async function checkDarkMode(page, p) {
  // 切换前先注册错误监听，避免漏掉切换瞬间的 pageerror
  let newPageErrors = 0
  let newConsoleErrors = 0
  const onErr = () => newPageErrors++
  const onCon = (m) => { if (m.type() === 'error') newConsoleErrors++ }
  page.on('pageerror', onErr)
  page.on('console', onCon)

  const before = await page.locator('svg').count()
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(500)
  const after = await page.locator('svg').count()

  page.off('pageerror', onErr)
  page.off('console', onCon)

  // 知识锚点块：内联浅色背景在深色下是否残留（内容层问题，记录不阻断）
  const anchorBg = await page
    .evaluate(() => {
      const els = Array.from(document.querySelectorAll('blockquote[style*="background"]'))
      return els.slice(0, 5).map((el) => {
        const cs = getComputedStyle(el)
        return { bg: cs.backgroundColor, rgb: cs.backgroundColor }
      })
    })
    .catch(() => [])

  return {
    svgBefore: before,
    svgAfter: after,
    svgPersisted: before > 0 && after === before,
    newPageErrors,
    newConsoleErrors,
    anchorBlockquoteCount: anchorBg.length,
    anchorBlockquoteBg: anchorBg,
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
async function main() {
  mkdirSync(REPORT_DIR, { recursive: true })
  const { chromium } = await import('playwright')

  await ensurePreview()
  const browser = await chromium.launch({
    executablePath: HEADLESS_SHELL,
    headless: true,
    args: ['--no-sandbox'],
  })

  const results = []
  try {
    for (const p of PAGES) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      try {
        results.push(await diagnosePage(page, p))
      } catch (e) {
        results.push({ name: p.name, path: p.path, fatal: String(e.message || e), errors: [], checks: {} })
      }
      await ctx.close()
    }
  } finally {
    await browser.close()
  }

  writeReport(results)
  summarize(results)
}

function writeReport(results) {
  writeFileSync(resolve(REPORT_DIR, 'diag-all.json'), JSON.stringify(results, null, 2))
  const lines = ['# 第二轮全页运行验证 · diag-all 报告', `- 生成时间：${new Date().toISOString()}`, '']
  for (const r of results) {
    const errCount = r.errors?.length || 0
    lines.push(`## ${r.name}（${r.path}）HTTP=${r.http} pageerror/console=${errCount}`)
    if (r.errors?.length)
      lines.push(`- 错误：${r.errors.map((e) => (e.type === 'http' ? `${e.type} ${e.status} ${e.url}` : `${e.type}: ${e.msg}`)).join(' | ')}`)
    if (r.checks) lines.push('```json\n' + JSON.stringify(r.checks, null, 2) + '\n```')
    if (r.fatal) lines.push(`- 致命：${r.fatal}`)
    lines.push('')
  }
  writeFileSync(resolve(REPORT_DIR, 'diag-all.md'), lines.join('\n'))
}

// 已知/低危问题分类（记录但不判整页 FAIL）
const KNOWN = {
  mermaidColorVar: /Unsupported color format: "var\(--mf-mermaid/i,
  netChanged: /ERR_NETWORK_CHANGED/i, // headless-shell 网络瞬断（环境噪声）
  favicon404: /logo\.svg$/, // favicon 缺 base 前缀的 404
  hydration: /Hydration completed but contains mismatches/i, // VitePress 首页水合常见警告
}

function isKnownConsole(msg) {
  // 'Failed to load resource' 是浏览器对资源失败(404/网络)的 console 重复提示，
  // 真实问题已由 response 监听(http status)单独捕获并分类，避免 double-count。
  return (
    KNOWN.mermaidColorVar.test(msg) ||
    KNOWN.netChanged.test(msg) ||
    KNOWN.hydration.test(msg) ||
    /Failed to load resource/i.test(msg)
  )
}
function isKnownHttp(err) {
  return err.type === 'http' && KNOWN.favicon404.test(err.url)
}

function summarize(results) {
  let fail = 0
  let knownIssues = new Map()
  for (const r of results) {
    const bad = []
    const notes = []
    if (r.fatal) bad.push('FATAL')

    // 错误分类：真实 pageerror vs 404 资源 vs 已知 console（favicon/网络瞬断/mermaid var）
    if (r.errors?.length) {
      const realErr = r.errors.filter((e) => {
        if (e.type === 'http') return false // 404 资源单独处理
        return !isKnownConsole(e.msg)
      })
      const http404 = r.errors.filter((e) => e.type === 'http' && !isKnownHttp(e))
      const favicon404 = r.errors.filter((e) => e.type === 'http' && isKnownHttp(e))
      if (realErr.length) bad.push(`ERROR(${realErr.length})`)
      if (http404.length) notes.push(`404:${http404.map((e) => e.url.replace(BASE_PATH, '')).join(',')}`)
      if (favicon404.length) knownIssues.set('favicon-logo-404', (knownIssues.get('favicon-logo-404') || 0) + 1)
    }

    if (r.checks) {
      const c = r.checks
      if (c.hero) {
        if (!c.hero.heroImageSrcBasePrefix) bad.push('hero-logo-base')
        if (!c.hero.navLogoBasePrefix) bad.push('nav-logo-base')
        if (!c.hero.actionHrefSingleBase) bad.push('hero-action-base')
      }
      if (c.svg && !c.svg.loaded) bad.push('svg-not-loaded')
      if (c.mermaid && !c.mermaid.rendered) bad.push('mermaid-not-rendered')
      if (c.component) {
        if (c.component.boardSvgCount === 0 || c.component.svgShapeCount === 0) bad.push('board-svg-empty')
        for (const [k, v] of Object.entries(c.component.expects || {})) if (!v) bad.push(`expect:${k}`)
      }
      if (c.dark && !c.dark.svgPersisted) bad.push('dark-svg-lost')
      if (c.dark && c.dark.newPageErrors > 0) {
        const realDark = c.dark.newPageErrors
        // 深色切换时新增的 pageerror 若非 mermaid var 颜色问题，判失败
        if (realDark > 0) {
          // 若该页为 mermaid 页且报错是 var 颜色 → 已知问题
          const mermaidKnown = r.errors?.some((e) => isKnownConsole(e.msg))
          if (mermaidKnown) knownIssues.set('mermaid-dark-var-color', (knownIssues.get('mermaid-dark-var-color') || 0) + 1)
          else bad.push('dark-pageerror')
        }
      }
      // 知识锚点块内联浅色背景在深色下残留 → 内容层问题（记录）
      if (c.dark && c.dark.anchorBlockquoteCount > 0) {
        const light = c.dark.anchorBlockquoteBg.some((b) => (b.rgb || '').includes('rgb(') && !(b.rgb || '').toLowerCase().includes('0,'))
        if (light) {
          notes.push(`anchor-bg-light(${c.dark.anchorBlockquoteCount})`)
          knownIssues.set('anchor-bg-light', (knownIssues.get('anchor-bg-light') || 0) + 1)
        }
      }
    }

    if (bad.length) {
      fail++
      console.log(`✗ ${r.name} — ${bad.join(', ')}${notes.length ? ` (${notes.join(';')})` : ''}`)
    } else {
      console.log(`✓ ${r.name}${notes.length ? ` (${notes.join(';')})` : ''}`)
    }
  }
  console.log('')
  if (knownIssues.size) {
    console.log('已知/低危问题（不阻断 PASS）：')
    for (const [k, v] of knownIssues) console.log(`  · ${k} × ${v}`)
  }
  console.log(`\n通过 ${results.length - fail}/${results.length}，失败 ${fail}。详见 ${REPORT_DIR}/diag-all.md`)
}

await main()
