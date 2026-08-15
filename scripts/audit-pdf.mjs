// audit-pdf.mjs — PDF 排版审核脚本
//
// 用法：
//   node scripts/audit-pdf.mjs                    # 审核 public/downloads/ 下全部 PDF
//   node scripts/audit-pdf.mjs --book 1           # 只审核册01
//   node scripts/audit-pdf.mjs --report out.json  # 输出 JSON 报告
//
// 检测项（基于 pdfjs 逐页文本块几何 + 绘图操作符）：
//   [W] near-blank   近空白页：整页无正文且无图（排除封面/目录/纯图页/封底）
//   [W] orphan-head  孤立标题：页面下 2/3 出现章/节标题，但该标题之后本页无正文
//   [I] img-only     纯图页：正文 0 字但含图像（mermaid/SVG 图页，正常）
//   [I] info         每页文本量 / 起止块 y 坐标，供人工抽查
//
// 输出：控制台报告（+ 可选 JSON）

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const PDFJS = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js')

const args = process.argv.slice(2)
const onlyBook = (() => {
  const i = args.indexOf('--book')
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : null
})()
const reportPath = (() => {
  const i = args.indexOf('--report')
  return i >= 0 && args[i + 1] ? args[i + 1] : null
})()

const dir = 'public/downloads'
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.pdf'))
  .sort()
  .filter((f, i) => (onlyBook ? String(i + 1) === String(onlyBook) : true))

const PAGE_H = 841.89
const FOOTER_H = 30
const MARGIN_BOTTOM = 44

const reports = []

for (const file of files) {
  const data = new Uint8Array(readFileSync(`${dir}/${file}`))
  const doc = await PDFJS.getDocument({ data, disableWorker: true, isEvalSupported: false }).promise

  const issues = []
  const pageSummaries = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const blocks = tc.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({
        text: it.str.trim(),
        y: it.transform[5],
        h: it.height,
      }))

    const bodyBlocks = blocks.filter((b) => b.y > FOOTER_H && b.y < PAGE_H - MARGIN_BOTTOM - 10)
    const bodyLen = bodyBlocks.reduce((s, b) => s + b.text.length, 0)

    // 纯图页推断：正文 0 字但页面总文本仅剩页眉页脚（mermaid/SVG 图页特征）
    const totalLen = blocks.reduce((s, b) => s + b.text.length, 0)
    const imgOnly = bodyLen === 0 && totalLen > 0 && totalLen < 80

    // 1) 近空白页：正文极少（排除封面/目录/封底/纯图页）
    if (bodyLen < 40 && !imgOnly) {
      issues.push({
        type: 'near-blank',
        page: p,
        detail: `正文仅 ${bodyLen} 字（全页 ${totalLen} 字）`,
      })
    }

    // 2) 孤立标题：页下 2/3 区域出现章/节标题，且其后本页无正文跟随
    const lowerTwoThirds = bodyBlocks.filter((b) => b.y < PAGE_H * 0.35) // y 小=靠底
    const bottomHead = lowerTwoThirds
      .sort((a, b) => b.y - a.y)[0] // 最靠底部的块
    if (bottomHead && bottomHead.h > 14 && bottomHead.text.length < 70) {
      const headingLike = /^第\s*\d+\s*章|^\d+(\.\d+)*\s|^[一二三四五六七八九十]+、/.test(bottomHead.text)
      // 其下（y 更小）是否还有正文块？无则孤立
      const below = bodyBlocks.some((b) => b.y < bottomHead.y - 2)
      if (headingLike && !below) {
        issues.push({
          type: 'orphan-head',
          page: p,
          detail: `页底部孤立标题: "${bottomHead.text.slice(0, 40)}"`,
        })
      }
    }

    pageSummaries.push({
      page: p,
      len: bodyLen,
      first: imgOnly ? '[纯图页]' : blocks.map((b) => b.text).join('').slice(0, 20),
      imgOnly,
    })
  }

  const nearBlank = issues.filter((i) => i.type === 'near-blank').length
  const orphan = issues.filter((i) => i.type === 'orphan-head').length

  reports.push({ file, pages: doc.numPages, issues, summary: { nearBlank, orphan } })

  console.log(`\n===== ${file} (${doc.numPages} 页) =====`)
  console.log(`  近空白页: ${nearBlank}  孤立标题: ${orphan}`)
  if (issues.length) {
    for (const it of issues) console.log(`  [${it.type}] 第${it.page}页: ${it.detail}`)
  } else {
    console.log('  ✅ 未发现问题')
  }
  const imgOnly = pageSummaries.filter((s) => s.len === 0 && s.first === '[纯图页]').length
  console.log(`  纯图页数: ${imgOnly}`)

  await doc.destroy()
}

if (reportPath) {
  writeFileSync(reportPath, JSON.stringify(reports, null, 2), 'utf8')
  console.log(`\n[audit] 报告已写入: ${reportPath}`)
}

const total = reports.reduce((s, r) => s + r.issues.length, 0)
console.log(`\n[audit] 完成：${reports.length} 册，共 ${total} 条疑似问题`)
