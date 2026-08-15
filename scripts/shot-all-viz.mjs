// scripts/shot-all-viz.mjs — 全部正文引用可视化组件的多帧目检截图（light + dark）
// 依赖本地 dev：http://localhost:4173/math-foundation/
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, '.vitepress', 'audit', 'viz-shots')
mkdirSync(OUT, { recursive: true })

const BASE = 'http://localhost:4173/math-foundation'

const PAGES = [
  ['EpsNSequences', '.epsn-board', '/册02-实数极限与连续/第03章-数列极限'],
  ['LimitEpsilonDelta', '.eps-board', '/册02-实数极限与连续/第04章-函数极限'],
  ['TangentExplorer', '.tan-board', '/册03-单变量微积分/第01章-导数'],
  ['RiemannSum', '.riemann-board', '/册03-单变量微积分/第04章-积分与FTC'],
  ['DotProduct', '.dp-board', '/册04-线性代数/第01章-向量'],
  ['MatrixTransform', '.mt-board', '/册04-线性代数/第06章-特征值与特征向量'],
  ['GradientDescent', '.gd-board', '/册05-多元微积分与凸优化/第06章-无约束优化与梯度下降'],
  ['CDFExplorer', '.cdf-board', '/册06-概率统计与信息/第03章-随机变量与分布'],
  ['CLTSampling', '.clt-board', '/册06-概率统计与信息/第05章-频率派统计'],
  ['NormalDistSlider', '.nds-board', '/册06-概率统计与信息/第07章-常见分布族'],
  ['KLDivergence', '.kl-board', '/册06-概率统计与信息/第09章-互信息与KL散度'],
  ['DijkstraExplorer', '.dij-board', '/册07-图论与可计算性/第03章-最短路径与Dijkstra'],
]

const { chromium } = await import('playwright')
const exe = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1228', 'chrome-win64', 'chrome.exe')
  : undefined
let browser
try { browser = await chromium.launch() } catch { browser = await chromium.launch({ executablePath: exe }) }

const results = []
for (const [name, boardSel, path] of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('PAGE: ' + String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) {
      errors.push('CONSOLE: ' + m.text().slice(0, 200))
    }
  })
  page.on('response', (r) => { if (r.status() === 404) errors.push('404: ' + r.url()) })
  const entry = { name, ok: false, svgCount: 0, errors }
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.locator(boardSel + ' svg').first().waitFor({ timeout: 30000 })
    await page.waitForTimeout(1200)
    entry.svgCount = await page.locator(boardSel + ' svg').count()
    await page.locator(boardSel).first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(OUT, name + '-light.png') })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(600)
    await page.screenshot({ path: join(OUT, name + '-dark.png') })
    entry.ok = true
  } catch (e) {
    entry.fail = String(e).split('\n')[0]
  }
  results.push(entry)
  await ctx.close()
}
console.log(JSON.stringify(results, null, 2))
await browser.close()
console.log('DONE')
