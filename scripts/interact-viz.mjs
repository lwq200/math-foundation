import { chromium } from 'playwright'

const BASE = 'http://localhost:4173/math-foundation'
const EXE = 'C:\\Users\\lwq\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe'

const TARGETS = [
  {
    name: 'MatrixTransform',
    url: '/册04-线性代数/第06章-特征值与特征向量',
    interact: async (page) => {
      const before = await page.locator('.mt-matrix').innerText()
      await page.locator('.mt-btn', { hasText: '旋转 45°' }).click()
      const afterBtn = await page.locator('.mt-matrix').innerText()
      const a = page.locator('.mt-sliders label:has-text("a") input')
      await a.focus()
      for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')
      const afterSlider = await page.locator('.mt-matrix').innerText()
      const svg = await page.locator('.mt-board svg').count()
      return { before, afterBtn, afterSlider, svg, changed: before !== afterSlider }
    },
  },
  {
    name: 'DijkstraExplorer',
    url: '/册07-图论与可计算性/第03章-最短路径与Dijkstra',
    interact: async (page) => {
      const info0 = await page.locator('.dij-readout').innerText()
      const step = page.locator('.dij-step')
      await step.click(); await step.click(); await step.click()
      const info3 = await page.locator('.dij-readout').innerText()
      let clicks = 3
      while (clicks < 40) {
        if ((await page.locator('.dij-readout').innerText()).includes('算法完成')) break
        await step.click(); clicks++
      }
      return { info0, info3, infoEnd: await page.locator('.dij-readout').innerText(), totalClicks: clicks }
    },
  },
  {
    name: 'NormalDistSlider',
    url: '/册06-概率统计与信息/第07章-常见分布族',
    interact: async (page) => {
      const mu = page.locator('.nds-sliders label:has-text("μ") input')
      const sigma = page.locator('.nds-sliders label:has-text("σ") input')
      const before = await page.locator('.nds-readout').innerText().catch(() => '')
      await mu.focus(); for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight')
      await sigma.focus(); for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft')
      const after = await page.locator('.nds-readout').innerText().catch(() => '')
      const svg = await page.locator('.nds-board svg').count()
      return { before: before.slice(0, 80), after: after.slice(0, 80), svg, changed: before !== after }
    },
  },
  {
    name: 'GradientDescent',
    url: '/册05-多元微积分与凸优化/第06章-无约束优化与梯度下降',
    interact: async (page) => {
      const read0 = await page.locator('.gd-readout').innerText()
      await page.locator('.gd-btn', { hasText: '走 1 步' }).click()
      await page.locator('.gd-btn', { hasText: '走 10 步' }).click()
      const read1 = await page.locator('.gd-readout').innerText()
      // 调到发散：拖 JSXGraph η 滑杆到最右（0.25）较麻烦，直接点走10步看状态
      return { read0, read1, changed: read0 !== read1 }
    },
  },
]

// 其余用 HTML range 或仅验证挂载的组件
const MOUNT_ONLY = [
  ['TangentExplorer', '/册03-单变量微积分/第01章-导数', '.tan-board'],
  ['RiemannSum', '/册03-单变量微积分/第04章-积分与FTC', '.riemann-board'],
  ['DotProduct', '/册04-线性代数/第01章-向量', '.dp-board'],
  ['EpsNSequences', '/册02-实数极限与连续/第03章-数列极限', '.epsn-board'],
  ['LimitEpsilonDelta', '/册02-实数极限与连续/第04章-函数极限', '.eps-board'],
  ['CDFExplorer', '/册06-概率统计与信息/第03章-随机变量与分布', '.cdf-board'],
  ['CLTSampling', '/册06-概率统计与信息/第05章-频率派统计', '.clt-board'],
  ['KLDivergence', '/册06-概率统计与信息/第09章-互信息与KL散度', '.kl-board'],
]

const browser = await chromium.launch({ executablePath: EXE })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push('CONSOLE: ' + m.text().slice(0, 150)) })
page.on('response', (r) => { if (r.status() === 404) errors.push('404: ' + r.url()) })

const results = []
for (const t of TARGETS) {
  const eb = errors.length
  await page.goto(BASE + t.url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  let detail = {}
  let ok = true, note = ''
  try { detail = await t.interact(page) } catch (e) { ok = false; note = 'FAIL: ' + e.message.split('\n')[0] }
  results.push({ name: t.name, ok, note, errs: errors.length - eb, detail })
}

for (const [name, url, sel] of MOUNT_ONLY) {
  const eb = errors.length
  await page.goto(BASE + url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  let svg = 0, ok = true, note = ''
  try { svg = await page.locator(sel + ' svg').count() } catch (e) { ok = false; note = e.message.split('\n')[0] }
  results.push({ name, ok, note, errs: errors.length - eb, mounted: svg > 0, svg })
}

console.log('=== INTERACTION RESULTS ===')
for (const r of results) {
  console.log(`\n## ${r.name}  ok=${r.ok} mounted=${r.mounted ?? 'n/a'} errs=${r.errs} ${r.note}`)
  console.log(JSON.stringify(r.detail ?? {}, null, 2))
}
console.log('\n=== TOTAL ERRORS ===\n' + (errors.length ? errors.join('\n') : 'NONE'))
await browser.close()
