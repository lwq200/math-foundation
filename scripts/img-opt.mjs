// img-opt.mjs — 可视化资源构建前优化
//
// 职责（在 `vitepress build` 之前运行）：
//   1. 读取源目录 assets/viz/ 下的 SVG 图片（团队产出位置）
//   2. 用 svgo 做矢量压缩（去掉注释/空白/冗余属性/元数据）
//   3. 用 sharp 为每个 SVG 生成 PNG 栅格 fallback（供不支持 SVG 的环境）
//   4. 将优化产物写入 .vitepress/public/assets/viz/ —— 即 VitePress 的 public 目录，
//      构建时 VitePress 会把整个 public/ 原样拷贝进 dist/，并在 base=/math-foundation/
//      下自动为根路径引用加上前缀。
//
// 用法：在 `vitepress build` 之前运行，即 `npm run build:all`
// （等价于 `npm run img-opt && vitepress build`）。
//
// 引用规范（base=/math-foundation/ 时）：
//   - markdown 图片：![极限示意图](/assets/viz/fig-euler-limit.svg)
//   - Vue 组件内动态引用：useData().theme 或直接 import { withBase } from 'vitepress'
//     之后 withBase('/assets/viz/fig-euler-limit.svg')
//   两种写法在构建后都会指向 /math-foundation/assets/viz/fig-euler-limit.svg。

import { readdirSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 源目录：团队在仓库根 assets/viz/ 产出 SVG
const SRC = resolve(root, 'assets/viz')
// 产物目录：VitePress public 目录（构建时会原样拷贝进 dist/，base 前缀自动加）
const OUT = resolve(root, '.vitepress/public/assets/viz')
// PNG fallback 的渲染宽度（px）。SVG 视口等比缩放，长宽比保留。
const PNG_WIDTH = 1200

const svgo = await import('svgo').then((m) => m.default ?? m).catch(() => null)
const sharp = (await import('sharp').then((m) => m.default ?? m).catch(() => null))

if (!svgo || !sharp) {
  console.error('[img-opt] 依赖缺失：请先 `npm install`（svgo + sharp）。跳过图片优化。')
  process.exit(1)
}

/** 递归收集某目录下所有 .svg 文件（返回相对 base 的路径） */
function collectSvgs(dir, base) {
  if (!exists(dir)) return []
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectSvgs(full, join(base, entry)))
    else if (/\.svg$/i.test(entry)) out.push(join(base, entry))
  }
  return out
}

function exists(p) {
  try {
    statSync(p)
    return true
  } catch {
    return false
  }
}

// svgo 配置：激进压缩，适合机器生成的图表；保留 viewBox 保证缩放不失真。
const SVG_OPTIONS = {
  multipass: true,
  plugins: [
    'preset-default',
    {
      name: 'removeViewBox',
      active: false,
    },
  ],
}

let total = 0
let fail = 0

for (const rel of collectSvgs(SRC, '')) {
  const srcPath = join(SRC, rel)
  const nameNoExt = rel.replace(/\.svg$/i, '')
  const outSvg = join(OUT, `${nameNoExt}.svg`)
  const outPng = join(OUT, `${nameNoExt}.png`)

  mkdirSync(dirname(outSvg), { recursive: true })

  try {
    const raw = readFileSync(srcPath, 'utf8')

    // 1) SVG 矢量压缩
    const { data: minified } = svgo.optimize(raw, { path: srcPath, ...SVG_OPTIONS })
    writeFileSync(outSvg, minified, 'utf8')

    // 2) PNG 栅格 fallback（宽按 PNG_WIDTH，高按视口等比）
    const svgBuf = Buffer.from(minified, 'utf8')
    const img = sharp(svgBuf)
    const meta = await img.metadata()
    const h = meta.width && meta.height ? Math.round((PNG_WIDTH * meta.height) / meta.width) : PNG_WIDTH
    await img
      .resize({ width: PNG_WIDTH, height: h, fit: 'inside' })
      .png({ compressionLevel: 9, palette: true })
      .toFile(outPng)

    total += 1
    console.log(`[img-opt] ✓ ${rel} -> ${outSvg} (+ PNG)`)
  } catch (e) {
    fail += 1
    console.warn(`[img-opt] ✗ ${rel}: ${e.message}`)
  }
}

console.log(`[img-opt] 完成：成功 ${total} 个，失败 ${fail} 个。产物目录：${OUT}`)
if (fail > 0) process.exitCode = 1
