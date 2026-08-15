// scripts/shot-dijkstra.mjs — Dijkstra 交互组件多帧截图（用于多模态目检）
// 依赖本地 preview：http://localhost:4173/math-foundation/
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, '.vitepress', 'audit', 'dij-shots')
mkdirSync(OUT, { recursive: true })

const URL =
  'http://localhost:4173/math-foundation/册07-图论与可计算性/第03章-最短路径与Dijkstra.html'

const { chromium } = await import('playwright')

const exe = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1228', 'chrome-win64', 'chrome.exe')
  : undefined

let browser
try {
  browser = await chromium.launch()
} catch {
  browser = await chromium.launch({ executablePath: exe })
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.locator('.dij-step').first().waitFor({ timeout: 30000 })
await page.waitForTimeout(800)

const canvas = page.locator('.dij-canvas')
await canvas.scrollIntoViewIfNeeded()
await page.waitForTimeout(400)

// 1. 整页截图（含上下文，浅色初始态）
await page.screenshot({ path: join(OUT, '1-fullpage-initial.png') })

// 2. 组件元素截图：初始态
await canvas.screenshot({ path: join(OUT, '2-initial.png') })

// 3. 点 3 次「下一步」：部分松弛
for (let i = 0; i < 3; i++) await page.locator('.dij-step').click()
await page.waitForTimeout(300)
await canvas.screenshot({ path: join(OUT, '3-step3.png') })

// 4. 点完剩余：执行到底
for (let i = 0; i < 12; i++) await page.locator('.dij-step').click()
await page.waitForTimeout(300)
await canvas.screenshot({ path: join(OUT, '4-done.png') })

// 5. 深色模式初始态（重置后切深色重开）
await page.locator('.dij-fn-btn', { hasText: '重置' }).click()
await page.emulateMedia({ colorScheme: 'dark' })
await page.waitForTimeout(600)
await canvas.screenshot({ path: join(OUT, '5-dark.png') })

const readout = (await page.locator('.dij-readout').textContent()) ?? ''
console.log('READOUT:', readout.slice(0, 120))
console.log('PAGEERRORS:', pageErrors.length, pageErrors.slice(0, 3).join(' | '))
await browser.close()
console.log('DONE')
