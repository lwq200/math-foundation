// 分批实测：node diag-part.mjs <batch 1-4>
// 每批 3 页，输出 PASS/FAIL，含深色模式检查
import { chromium } from 'playwright'

const exe = 'C:/Users/lwq/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
const BASE = 'http://localhost:4173/math-foundation'

const GROUPS = [
  [
    { n: '首页hero', url: '/', sel: '.VPHero .actions a', expect: '按钮' },
    { n: 'EpsNSequences(册02-03)', url: '/册02-实数极限与连续/第03章-数列极限', sel: '.epsn-board svg' },
    { n: 'LimitEpsilonDelta(册02-04)+SVG', url: '/册02-实数极限与连续/第04章-函数极限', sel: '.eps-board svg' },
  ],
  [
    { n: 'TangentExplorer(册03-01)+SVG', url: '/册03-单变量微积分/第01章-导数', sel: '.tan-board svg' },
    { n: 'RiemannSum(册03-04)', url: '/册03-单变量微积分/第04章-积分与FTC', sel: '.riemann-board svg' },
    { n: 'DotProduct(册04-01)', url: '/册04-线性代数/第01章-向量', sel: '.dp-board svg' },
  ],
  [
    { n: 'MatrixTransform(册04-06)', url: '/册04-线性代数/第06章-特征值与特征向量', sel: '.mt-board svg' },
    { n: 'GradientDescent(册05-06)', url: '/册05-多元微积分与凸优化/第06章-无约束优化与梯度下降', sel: '.gd-board svg' },
    { n: 'CDFExplorer(册06-03)', url: '/册06-概率统计与信息/第03章-随机变量与分布', sel: '.cdf-board svg' },
  ],
  [
    { n: 'CLTSampling(册06-05)', url: '/册06-概率统计与信息/第05章-频率派统计', sel: '.clt-board svg' },
    { n: 'NormalDistSlider(册06-07)', url: '/册06-概率统计与信息/第07章-常见分布族', sel: '.nds-board svg' },
    { n: 'KLDivergence(册06-09)', url: '/册06-概率统计与信息/第09章-互信息与KL散度', sel: '.kl-board svg' },
  ],
]

const batch = Number(process.argv[2] || 1)
const group = GROUPS[batch - 1]
if (!group) { console.log('batch 需 1-4'); process.exit(1) }

const b = await chromium.launch({ executablePath: exe, headless: true })
console.log(`=== 第 ${batch} 批（${group.length} 页）===\n`)
for (const pageInfo of group) {
  const p = await b.newPage()
  let err = null
  p.on('pageerror', (e) => (err = e.message.slice(0, 100)))
  p.on('console', (m) => { if (m.type() === 'error' && m.text().includes('JSXGraph')) err = m.text().slice(0, 100) })

  // 浅色
  await p.goto(BASE + pageInfo.url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => (err = 'goto:' + e.message))
  await p.waitForTimeout(3000)
  const svgLight = await p.locator(pageInfo.sel).count().catch(() => -1)

  // 深色
  await p.evaluate(() => document.documentElement.classList.add('dark'))
  await p.waitForTimeout(1500)
  const svgDark = await p.locator(pageInfo.sel).count().catch(() => -1)

  const ok = !err && svgLight > 0 && svgDark > 0
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${pageInfo.n}`)
  console.log(`   浅色svg=${svgLight} 深色svg=${svgDark} error=${err ? err : '无'}`)
  await p.close()
}
await b.close()
console.log(`\n=== 第 ${batch} 批完成 ===`)
