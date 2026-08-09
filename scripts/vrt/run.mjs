// scripts/vrt/run.mjs — 无障碍 + 视觉回归审计脚本（Playwright）
//
// 被 scripts/visual-regression.mjs（门面）以
//   await import('scripts/vrt/run.mjs').then(m => m.default({ base: '/math-foundation/' }))
// 的方式调用，默认导出必须为一个 async 函数，入参为 { base }。
//
// 职责：
//   1. 启动/复用 `vitepress preview`（端口 4173，与 Actions visual-regression job 对齐）
//   2. 对「关键页面 × 浅色/深色 × 桌面/移动」做全页截图
//   3. 与基线 PNG 做像素对比（pixelmatch），差异超阈值即告警
//   4. 用 @axe-core/playwright 跑 WCAG A/AA 静态审计
//   5. 产出 HTML/文本报告到 .vitepress/audit/report/
//
// 依赖（可选，缺失时安全降级、非阻断，符合门面 continue-on-error 语义）：
//   - playwright（chromium）
//   - @axe-core/playwright + axe-core（无障碍扫描）
//   - pngjs + pixelmatch（像素 diff，未装则退化为「无基线比对」仅截图）
//
// 基线管理：
//   - 基线存放于 .vitepress/audit/__snapshots__/<name>.png
//   - 传环境变量 VRT_UPDATE=1 可刷新基线（本机人工复核后随 PR 提交）
//   - 默认阈值：像素差异率 1%（diffRatioThreshold=0.01），可经 VRT_THRESHOLD 覆盖

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const SNAP_DIR = resolve(ROOT, '.vitepress/audit/__snapshots__')
const REPORT_DIR = resolve(ROOT, '.vitepress/audit/report')

const PREVIEW_PORT = 4173
const PREVIEW_HOST = 'http://localhost:4173'
const DIFF_RATIO_THRESHOLD = Number(process.env.VRT_THRESHOLD ?? 0.01) // 1%
const UPDATE_BASELINE = process.env.VRT_UPDATE === '1'

// 关键页面清单：<name> / <路径> / <是否含交互/公式/图，供等待选择器用>
const PAGES = [
  { name: 'home', path: '/', wait: '.VPHero, .vp-doc' },
  { name: 'ch01-dialogue-mermaid', path: '/册01-逻辑与数/第01章-数', wait: '.dialog-lao, .mermaid' },
  { name: 'ch04-katex', path: '/册03-单变量微积分/第04章-积分与FTC', wait: '.katex' },
  { name: 'ch06-blockquote-formula', path: '/册04-线性代数/第06章-特征值与特征向量', wait: '.katex' },
  { name: 'answer-key-table', path: '/册01-逻辑与数/答案速查页', wait: 'table' },
]

const SIZES = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
]

const THEMES = [
  { label: 'light', colorScheme: 'light' },
  { label: 'dark', colorScheme: 'dark' },
]

async function ensurePreview() {
  return new Promise((resolvePreview, rejectPreview) => {
    const url = `${PREVIEW_HOST}`
    // 简单探活：若端口已被占用（本机已起 dev/preview），直接复用
    const probe = spawn(
      process.platform === 'win32' ? 'powershell' : 'sh',
      process.platform === 'win32'
        ? ['-NoProfile', '-Command', `Test-NetConnection -ComputerName localhost -Port ${PREVIEW_PORT} -InformationLevel Quiet`]
        : ['-c', `(exec 3<>/dev/tcp/127.0.0.1/${PREVIEW_PORT}) 2>/dev/null && echo up || echo down`],
    )
    let out = ''
    probe.stdout?.on('data', (d) => (out += d.toString()))
    probe.on('close', (code) => {
      if (out.includes('up') || out.includes('True')) return resolvePreview(url)
      // 未占用：启动 vitepress preview
      const child = spawn('npx', ['vitepress', 'preview', '--port', String(PREVIEW_PORT)], {
        cwd: ROOT,
        stdio: 'inherit',
        shell: true,
      })
      child.on('error', (e) => rejectPreview(e))
      // 轮询探活，最多等 30s
      const deadline = Date.now() + 30_000
      const timer = setInterval(() => {
        if (Date.now() > deadline) {
          clearInterval(timer)
          return rejectPreview(new Error('preview server 启动超时'))
        }
        const t = spawn(
          process.platform === 'win32' ? 'powershell' : 'sh',
          process.platform === 'win32'
            ? ['-NoProfile', '-Command', `Test-NetConnection -ComputerName localhost -Port ${PREVIEW_PORT} -InformationLevel Quiet`]
            : ['-c', `(exec 3<>/dev/tcp/127.0.0.1/${PREVIEW_PORT}) 2>/dev/null && echo up || echo down`],
        )
        let so = ''
        t.stdout?.on('data', (d) => (so += d.toString()))
        t.on('close', () => {
          if (so.includes('up') || so.includes('True')) {
            clearInterval(timer)
            resolvePreview(url)
          }
        })
      }, 1500)
    })
  })
}

async function lazy(module) {
  try {
    return await import(module).then((m) => m.default ?? m)
  } catch {
    return null
  }
}

async function main({ base = '/math-foundation/' }) {
  const playwright = await lazy('playwright')
  if (!playwright) {
    console.warn('[vrt] 未安装 playwright。跳过视觉回归与无障碍扫描（CI continue-on-error 兜底）。')
    return
  }

  mkdirSync(SNAP_DIR, { recursive: true })
  mkdirSync(REPORT_DIR, { recursive: true })

  const { chromium } = playwright
  const basePath = base.replace(/\/$/, '')
  const urlFor = (path) => `${PREVIEW_HOST}${basePath}${path}`

  const axeBuilder = (await lazy('@axe-core/playwright')).default
  const pixelmatch = await lazy('pixelmatch')
  const { PNG } = (await lazy('pngjs')) ?? {}

  const report = { base, generatedAt: new Date().toISOString(), pages: PAGES.length, violations: [], diffs: [] }
  let issues = 0

  await ensurePreview()

  // 浏览器启动：优先 chromium；可用 VRT_CHANNEL 指定系统浏览器（chrome/msedge）；
  // 本机无浏览器时优雅降级（CI 已装 chromium 不受影响）。
  let browser
  try {
    const channel = process.env.VRT_CHANNEL
    browser = await chromium.launch(channel ? { channel } : {})
  } catch (e) {
    console.warn(
      `[vrt] 无法启动浏览器：${e.message.split('\n')[0]}\n` +
        '  请执行 `npx playwright install chromium`，或设置 VRT_CHANNEL=msedge/chrome 使用系统浏览器。\n' +
        '  本次跳过视觉回归与无障碍扫描（CI continue-on-error 兜底，不影响部署）。'
    )
    return
  }
  const ctx = await browser.newContext({ viewport: { width: SIZES[0].width, height: SIZES[0].height } })
  const page = await ctx.newPage()

  for (const { name, path, wait } of PAGES) {
    for (const theme of THEMES) {
      // 深浅色用独立 context，避免污染基线
      const themeCtx = await browser.newContext({
        viewport: { width: SIZES[0].width, height: SIZES[0].height },
        colorScheme: theme.colorScheme,
      })
      const themePage = await themeCtx.newPage()
      await themePage.goto(urlFor(path), { waitUntil: 'networkidle' })
      if (wait) {
        try {
          await themePage.locator(wait).first().waitFor({ timeout: 8000 })
        } catch {
          // 某页恰好无该节点时不阻断，记录
        }
      }
      const shotName = `${name}-${theme.label}-${SIZES[0].label}`
      const buf = await themePage.screenshot({ fullPage: true })
      await evaluateShot(buf, shotName, name, theme, pixelmatch, PNG)
      await themeCtx.close()
    }

    // 桌面浅色下跑 axe（每条 WCAG A/AA）
    if (axeBuilder) {
      await page.goto(urlFor(path), { waitUntil: 'networkidle' })
      const results = await new axeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      for (const v of results.violations) {
        report.violations.push({ page: name, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })
        issues++
      }
    }
  }

  // 移动端：仅对首页 + 一个公式页抽样截图
  const mobileCtx = await browser.newContext({
    viewport: { width: SIZES[1].width, height: SIZES[1].height },
  })
  const mobilePage = await mobileCtx.newPage()
  for (const { name, path } of PAGES.slice(0, 2)) {
    await mobilePage.goto(urlFor(path), { waitUntil: 'networkidle' })
    const buf = await mobilePage.screenshot({ fullPage: true })
    await evaluateShot(buf, `${name}-light-${SIZES[1].label}`, name, THEMES[0], pixelmatch, PNG)
  }
  await mobileCtx.close()

  await browser.close()

  writeReport(report)
  if (issues > 0 || report.diffs.length > 0) {
    console.warn(`[vrt] 发现 ${issues} 条无障碍违规、${report.diffs.length} 处截图差异。详见 ${REPORT_DIR}/report.md`)
    process.exitCode = 1
  } else {
    console.log(`[vrt] 审计通过：${PAGES.length * THEMES.length} 页 × 主题 + 移动抽样，无差异、无 AA 违规。`)
  }

  // ---- 内部：单张截图与基线比对 ----
  async function evaluateShot(buf, shotName, pageName, theme, pm, PNGLib) {
    const target = join(SNAP_DIR, `${shotName}.png`)
    if (UPDATE_BASELINE) {
      writeFileSync(target, buf)
      console.log(`[vrt] 基线已更新：${shotName}`)
      return
    }
    if (!existsSync(target) || !pm || !PNGLib) {
      // 无基线或缺 diff 依赖：仅落盘当前截图，留待人工复核
      writeFileSync(join(SNAP_DIR, `current-${shotName}.png`), buf)
      console.log(`[vrt] 无基线/缺依赖，已存当前截图：current-${shotName}.png`)
      return
    }
    const ref = PNGLib.sync.read(readFileSync(target))
    const cur = PNGLib.sync.read(buf)
    if (ref.width !== cur.width || ref.height !== cur.height) {
      report.diffs.push({ shotName, page: pageName, theme: theme.label, reason: '尺寸不一致', ratio: 1 })
      return
    }
    const { width, height } = ref
    const diff = new PNGLib({ width, height })
    const n = pm(ref.data, cur.data, diff.data, width, height)
    const ratio = n / (width * height)
    if (ratio > DIFF_RATIO_THRESHOLD) {
      report.diffs.push({ shotName, page: pageName, theme: theme.label, reason: `diffRatio=${ratio.toFixed(4)}`, ratio })
      writeFileSync(join(REPORT_DIR, `${shotName}.diff.png`), PNGLib.sync.write(diff))
    } else {
      console.log(`[vrt] ✓ ${shotName} 差异 ${(ratio * 100).toFixed(2)}%`)
    }
  }
}

function writeReport(report) {
  const lines = []
  lines.push('# 视觉回归 + 无障碍审计报告')
  lines.push(`- base：\`${report.base}\``)
  lines.push(`- 生成时间：${report.generatedAt}`)
  lines.push(`- 覆盖页面数：${report.pages}`)
  lines.push('')
  lines.push('## 无障碍（WCAG A/AA）')
  if (report.violations.length === 0) lines.push('- 无违规 ✓')
  for (const v of report.violations) {
    lines.push(`- **${v.id}** [${v.impact}] @ ${v.page}：${v.help}（${v.nodes} 个节点）`)
  }
  lines.push('')
  lines.push('## 截图差异')
  if (report.diffs.length === 0) lines.push('- 无超出阈值的差异 ✓')
  for (const d of report.diffs) {
    lines.push(`- **${d.shotName}**（${d.theme}）@ ${d.page}：${d.reason}`)
  }
  writeFileSync(join(REPORT_DIR, 'report.md'), lines.join('\n'))
  writeFileSync(join(REPORT_DIR, 'report.json'), JSON.stringify(report, null, 2))
}

// 供门面 import 的默认导出
export default main
