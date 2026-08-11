// 验证：logo 200 / Mermaid 无 var() 报错 / fig 图加载
import { chromium } from 'playwright'

const BASE = 'http://localhost:4173/math-foundation'
const exe = 'C:/Users/lwq/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
const b = await chromium.launch({ executablePath: exe, headless: true })

// 1. logo 直连
const r1 = await fetch(BASE + '/logo.svg')
console.log(`[${r1.status === 200 ? 'PASS' : 'FAIL'}] logo.svg HTTP ${r1.status}`)

// 2. 首页 logo img 加载
const p = await b.newPage()
await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(2500)
const logoOk = await p.evaluate(() => {
  const img = document.querySelector('.image-src img') || document.querySelector('.VPHero img')
  return img ? img.naturalWidth > 0 : false
})
console.log(`[${logoOk ? 'PASS' : 'FAIL'}] 首页 logo 实际加载`)

// 3. Mermaid 页无 var() 报错
let merr = null
p.on('console', (m) => { if (m.type() === 'error' && m.text().includes('Unsupported color')) merr = m.text() })
await p.goto(BASE + '/册01-逻辑与数/第01章-数', { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(3000)
const msvg = await p.locator('.mermaid svg').count()
console.log(`[${msvg > 0 ? 'PASS' : 'FAIL'}] Mermaid svg=${msvg} 深色报错: ${merr ? merr.slice(0, 60) : '无'}`)

// 4. fig 图加载（册02-04）
await p.goto(BASE + '/册02-实数极限与连续/第04章-函数极限', { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(2500)
const figOk = await p.evaluate(() => {
  const img = [...document.querySelectorAll('img')].find((i) => (i.getAttribute('src') || '').includes('fig-euler'))
  return img ? { src: img.getAttribute('src'), ok: img.naturalWidth > 0 } : null
})
console.log(`[${figOk && figOk.ok ? 'PASS' : 'FAIL'}] fig-euler 图加载 src=${figOk ? figOk.src : '未找到'}`)
await b.close()
