// 补充验证：SVG 图加载 / Mermaid 渲染 / 首页点击无404
import { chromium } from 'playwright'

const exe = 'C:/Users/lwq/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
const BASE = 'http://localhost:4173/math-foundation'
const b = await chromium.launch({ executablePath: exe, headless: true })

// 1. SVG 图加载
for (const [n, url, srcKey] of [
  ['SVG ε-δ(册02-04)', '/册02-实数极限与连续/第04章-函数极限', 'fig-euler-limit'],
  ['SVG 切线(册03-01)', '/册03-单变量微积分/第01章-导数', 'fig-tangent-slope'],
]) {
  const p = await b.newPage()
  await p.goto(BASE + url, { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(2500)
  const ok = await p.evaluate((k) => {
    const img = [...document.querySelectorAll('img')].find((i) => (i.getAttribute('src') || '').includes(k))
    return img ? img.naturalWidth > 0 : false
  }, srcKey)
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${n} img加载`)
  await p.close()
}

// 2. Mermaid 渲染（册01-01）
{
  const p = await b.newPage()
  await p.goto(BASE + '/册01-逻辑与数/第01章-数', { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(3000)
  const n = await p.locator('.mermaid svg').count()
  console.log(`[${n > 0 ? 'PASS' : 'FAIL'}] Mermaid(册01-01) svg=${n}`)
  await p.close()
}

// 3. 首页按钮点击 → 无404
{
  const p = await b.newPage()
  await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(2000)
  await p.click('a:has-text("从第 1 册开始读")').catch(() => console.log('click fail'))
  await p.waitForTimeout(4000)
  const has404 = await p.evaluate(() => document.body.innerText.includes('404'))
  const hasChap = await p.evaluate(() => document.body.innerText.includes('知识锚点'))
  console.log(`[${!has404 && hasChap ? 'PASS' : 'FAIL'}] 首页点击跳转(含404:${has404}, 章节加载:${hasChap}) url=${p.url()}`)
  await p.close()
}

await b.close()
