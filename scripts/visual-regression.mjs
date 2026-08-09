// visual-regression.mjs — 视觉回归占位入口
//
// 说明：
//   - 团队中 consistency-auditor 正在产出「视觉回归审计脚本」。
//   - 本文件是 Actions visual-regression job 的稳定入口，负责把工作转交给
//     审计脚本（若已产出）或退化安全地报告「未配置基线」。
//   - 因此本文件：不覆盖审计脚本、不重复实现截图逻辑，只做「门面」。
//
// 约定：
//   - 若存在 scripts/vrt/run.mjs 或 scripts/vrt-main.mjs，则视为审计脚本并执行。
//   - 否则以非零但「非阻断」的方式提示（由 CI 中 continue-on-error 兜底）。

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const candidates = [
  resolve(root, 'scripts/vrt/run.mjs'),
  resolve(root, 'scripts/vrt-main.mjs'),
  resolve(root, '.vitepress/audit/visual-regression.mjs'),
]

const entry = candidates.find((p) => existsSync(p))

if (entry) {
  console.log(`[vrt] 转发到审计脚本：${entry}`)
  // Windows 下 import() 绝对路径必须为 file:// URL，否则抛 ERR_UNSUPPORTED_ESM_URL_SCHEME
  const { default: mod } = await import(pathToFileURL(entry).href)
  if (typeof mod === 'function') {
    await mod({ base: '/math-foundation/' })
  }
} else {
  console.warn(
    '[vrt] 未找到审计脚本（scripts/vrt/run.mjs 等）。' +
      'CI 中以 continue-on-error 兜底，不影响部署。'
  )
}
