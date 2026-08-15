# 《数学基础》· 创世游戏系列丛书基础卷

> 创世游戏全书的第一块地基。后续每一卷（分析、代数、概率、信息……）的严格化走廊，都建立在本卷的推导之上。

**苏格拉底对话体自学教材**：造物主（读者）⇄ 老谟（毒舌导师）一问一答，从"只会开和关的比特"一路推到"能写出自己的第一个证明"。核心不是灌输结论，而是让读者跟着对话**从零重新推导**每一块地基。

✅ **全书完结：7 册 · 53 章**

- **在线阅读**：https://lwq200.github.io/math-foundation/
- **许可**：CC BY 4.0（详见 `LICENSE`）

## 系列结构（7 册 · 53 章）

| 册 | 主题 | 章数 |
|---|------|------|
| 册01 | 逻辑与数 | 6 |
| 册02 | 实数极限与连续 | 5 |
| 册03 | 单变量微积分 | 8 |
| 册04 | 线性代数 | 9 |
| 册05 | 多元微积分与凸优化 | 8 |
| 册06 | 概率统计与信息 | 9 |
| 册07 | 图论与可计算性 | 8 |

## 每章标配

- **严格化走廊**：定义 → 定理（带全前提）→ 可复写证明 → 反例/边界，每步标注"依据"
- **计算训练场**：每章 ≥2 道中大型计算题（动笔 10 分钟+），附完整分步解答
- **学派中立**：贝叶斯/频率、黎曼/勒贝格等分歧显式标注进路
- **工程落地**：每个概念追问"如果让我造一个，我会怎么做"

## 阅读建议

1. **顺序阅读**：册01 → 册07 按依赖顺序推进，每册末尾的"预告"会指向下一册。
2. **动手优先**：先做「计算训练场」，再对「答案速查页」——不要边算边翻。
3. **可复写证明**：严格化走廊里的每个证明，试着合上屏幕在白纸上重写一遍。

## 离线下载

每册提供 **PDF**（打印/批注友好）与 **EPUB**（Kindle/手机阅读，公式内嵌字体）两种格式，可在 [站点下载区](https://lwq200.github.io/math-foundation/#下载) 获取；文件也在本仓库 `public/downloads/`。

| 册 | 主题 | PDF / EPUB |
|---|------|-----------|
| 册01 | 逻辑与数 | [`downloads/册01-逻辑与数.pdf`](public/downloads/册01-逻辑与数.pdf) · [`EPUB`](public/downloads/册01-逻辑与数.epub) |
| 册02 | 实数极限与连续 | [`downloads/册02-实数极限与连续.pdf`](public/downloads/册02-实数极限与连续.pdf) · [`EPUB`](public/downloads/册02-实数极限与连续.epub) |
| 册03 | 单变量微积分 | [`downloads/册03-单变量微积分.pdf`](public/downloads/册03-单变量微积分.pdf) · [`EPUB`](public/downloads/册03-单变量微积分.epub) |
| 册04 | 线性代数 | [`downloads/册04-线性代数.pdf`](public/downloads/册04-线性代数.pdf) · [`EPUB`](public/downloads/册04-线性代数.epub) |
| 册05 | 多元微积分与凸优化 | [`downloads/册05-多元微积分与凸优化.pdf`](public/downloads/册05-多元微积分与凸优化.pdf) · [`EPUB`](public/downloads/册05-多元微积分与凸优化.epub) |
| 册06 | 概率统计与信息 | [`downloads/册06-概率统计与信息.pdf`](public/downloads/册06-概率统计与信息.pdf) · [`EPUB`](public/downloads/册06-概率统计与信息.epub) |
| 册07 | 图论与可计算性 | [`downloads/册07-图论与可计算性.pdf`](public/downloads/册07-图论与可计算性.pdf) · [`EPUB`](public/downloads/册07-图论与可计算性.epub) |

> 导出脚本：`scripts/export-books.mjs`（`npm run export`），排版回归：`scripts/audit-pdf.mjs`。

## 本地开发

```bash
npm install        # 安装 VitePress 及 KaTeX / Mermaid 插件
npm run dev        # 本地开发预览（http://localhost:5173）
npm run build      # 生产构建，产物在 .vitepress/dist/
```

推送 `main` 分支后，GitHub Actions 自动构建并部署到 GitHub Pages。

## 相关

- 创作这套教材的写作工作流：[socratic-book-coauthor](https://github.com/lwq200/creation-game/tree/main/skills/socratic-book-coauthor)
- 同门师弟——杂学篇（生活技能宇宙：🍳 学做饭、💬 谈恋爱与沟通……原理到手，万物皆可造）：[creation-game-misc](https://github.com/lwq200/creation-game-misc)
- 老谟 × 造物主的原版故事线：[creation-game](https://github.com/lwq200/creation-game)
