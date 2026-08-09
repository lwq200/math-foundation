# 《数学基础》· 创世游戏系列丛书基础卷

> 创世游戏全书的第一块地基。后续每一卷（分析、代数、概率、信息……）的严格化走廊，都建立在本卷的推导之上。

**苏格拉底对话体自学教材**：造物主（读者）⇄ 老谟（毒舌导师）一问一答，从"只会开和关的比特"一路推到"能写出自己的第一个证明"。核心不是灌输结论，而是让读者跟着对话**从零重新推导**每一块地基。

- **在线阅读**：https://lwq200.github.io/math-foundation/
- **许可**：CC BY 4.0（详见 `LICENSE`）

## 系列结构（7 册 · 47 章）

| 册 | 主题 | 章数 |
|---|------|------|
| 册01 | 逻辑与数 | 6 |
| 册02 | 实数极限与连续 | 5 |
| 册03 | 单变量微积分 | 8 |
| 册04 | 线性代数 | 9 |
| 册05 | 多元微积分与凸优化 | 8 |
| 册06 | 概率统计与信息 | 9 |
| 册07 | 图论与可计算性 | 即将推出 |

## 每章标配

- **严格化走廊**：定义 → 定理（带全前提）→ 可复写证明 → 反例/边界，每步标注"依据"
- **计算训练场**：每章 ≥2 道中大型计算题（动笔 10 分钟+），附完整分步解答
- **学派中立**：贝叶斯/频率、黎曼/勒贝格等分歧显式标注进路
- **工程落地**：每个概念追问"如果让我造一个，我会怎么做"

## 如何创作与延续本系列

- **创作规范（skill）**：[socratic-book-coauthor](https://github.com/lwq200/creation-game/tree/main/skills/socratic-book-coauthor) —— 人物设定、章节铁律、质量清单
- **创世游戏主仓库**：[lwq200/creation-game](https://github.com/lwq200/creation-game)

## 本地开发

```bash
npm install        # 安装 VitePress 及 KaTeX / Mermaid 插件
npm run dev        # 本地开发预览（http://localhost:5173）
npm run build      # 生产构建，产物在 .vitepress/dist/
npm run preview    # 预览构建产物
```

推送 `main` 分支后，GitHub Actions 自动构建并部署到 GitHub Pages。
