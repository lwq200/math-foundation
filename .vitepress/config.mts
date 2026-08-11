import { defineConfig } from 'vitepress'
import { katex } from '@mdit/plugin-katex'
import { withMermaid } from 'vitepress-plugin-mermaid'

// 数学内容（集合记号 {∅,{∅}}、LaTeX 下标 w_{n−k} 等）含 {{ / }}
// 会被 Vue 当作模板插值。此插件在 markdown 渲染完成后统一把
// {{ / }} 转义为 HTML 实体（浏览器与 GitHub 仍显示为 {{ / }}，
// 源文件保持原样）。覆盖 renderer.render 可同时作用于
// SSR 渲染与客户端 SFC 编译两条路径。
// VitePress 在 markdown.config 回调后会重置 renderer，因此不能只覆盖
// renderer.render；改为包一层 md.render，对最终 HTML 统一转义
// {{ / }} 为 HTML 实体（浏览器仍显示为 {{ / }}，源文件保持原样）。
function escapeVueBraces(md: any) {
  const render = md.render.bind(md)
  md.render = (src: string, env?: any) => {
    let html = render(src, env)
    html = html.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;')
    return html
  }
}

// 侧边栏：只列成品章节与答案速查页（工程文档不对外）
const books = [
  {
    text: '册01 · 逻辑与数',
    collapsed: false,
    items: [
      { text: '第01章 · 数', link: '/册01-逻辑与数/第01章-数' },
      { text: '第02章 · 逻辑', link: '/册01-逻辑与数/第02章-逻辑' },
      { text: '第03章 · 集合', link: '/册01-逻辑与数/第03章-集合' },
      { text: '第04章 · 函数', link: '/册01-逻辑与数/第04章-函数' },
      { text: '第05章 · 证明方法入门', link: '/册01-逻辑与数/第05章-证明方法入门' },
      { text: '第06章 · 证明实战', link: '/册01-逻辑与数/第06章-证明实战' },
      { text: '答案速查页', link: '/册01-逻辑与数/答案速查页' },
    ],
  },
  {
    text: '册02 · 实数极限与连续',
    collapsed: true,
    items: [
      { text: '第01章 · 实数', link: '/册02-实数极限与连续/第01章-实数' },
      { text: '第02章 · 浮点', link: '/册02-实数极限与连续/第02章-浮点' },
      { text: '第03章 · 数列极限', link: '/册02-实数极限与连续/第03章-数列极限' },
      { text: '第04章 · 函数极限', link: '/册02-实数极限与连续/第04章-函数极限' },
      { text: '第05章 · 连续', link: '/册02-实数极限与连续/第05章-连续' },
      { text: '答案速查页', link: '/册02-实数极限与连续/答案速查页' },
    ],
  },
  {
    text: '册03 · 单变量微积分',
    collapsed: true,
    items: [
      { text: '第01章 · 导数', link: '/册03-单变量微积分/第01章-导数' },
      { text: '第02章 · 求导法则与链式法则', link: '/册03-单变量微积分/第02章-求导法则与链式法则' },
      { text: '第03章 · 中值定理', link: '/册03-单变量微积分/第03章-中值定理' },
      { text: '第04章 · 积分与 FTC', link: '/册03-单变量微积分/第04章-积分与FTC' },
      { text: '第05章 · 积分技巧', link: '/册03-单变量微积分/第05章-积分技巧' },
      { text: '第06章 · 数列与级数', link: '/册03-单变量微积分/第06章-数列与级数' },
      { text: '第07章 · 幂级数与泰勒', link: '/册03-单变量微积分/第07章-幂级数与泰勒' },
      { text: '第08章 · 微积分的工程应用', link: '/册03-单变量微积分/第08章-微积分的工程应用' },
      { text: '答案速查页', link: '/册03-单变量微积分/答案速查页' },
    ],
  },
  {
    text: '册04 · 线性代数',
    collapsed: true,
    items: [
      { text: '第01章 · 向量', link: '/册04-线性代数/第01章-向量' },
      { text: '第02章 · 向量空间与子空间', link: '/册04-线性代数/第02章-向量空间与子空间' },
      { text: '第03章 · 矩阵', link: '/册04-线性代数/第03章-矩阵' },
      { text: '第04章 · 线性方程组与高斯消元', link: '/册04-线性代数/第04章-线性方程组与高斯消元' },
      { text: '第05章 · 行列式', link: '/册04-线性代数/第05章-行列式' },
      { text: '第06章 · 特征值与特征向量', link: '/册04-线性代数/第06章-特征值与特征向量' },
      { text: '第07章 · 对角化', link: '/册04-线性代数/第07章-对角化' },
      { text: '第08章 · 内积空间与正交', link: '/册04-线性代数/第08章-内积空间与正交' },
      { text: '第09章 · SVD 与 PCA', link: '/册04-线性代数/第09章-SVD与PCA' },
      { text: '答案速查页', link: '/册04-线性代数/答案速查页' },
    ],
  },
  {
    text: '册05 · 多元微积分与凸优化',
    collapsed: true,
    items: [
      { text: '第01章 · 多元函数与偏导', link: '/册05-多元微积分与凸优化/第01章-多元函数与偏导' },
      { text: '第02章 · 多元链式法则与多元泰勒', link: '/册05-多元微积分与凸优化/第02章-多元链式法则与多元泰勒' },
      { text: '第03章 · 多元积分', link: '/册05-多元微积分与凸优化/第03章-多元积分' },
      { text: '第04章 · 凸集与凸函数', link: '/册05-多元微积分与凸优化/第04章-凸集与凸函数' },
      { text: '第05章 · 凸性判定与二次型', link: '/册05-多元微积分与凸优化/第05章-凸性判定与二次型' },
      { text: '第06章 · 无约束优化与梯度下降', link: '/册05-多元微积分与凸优化/第06章-无约束优化与梯度下降' },
      { text: '第07章 · 高维景观鞍点与局部最优', link: '/册05-多元微积分与凸优化/第07章-高维景观鞍点与局部最优' },
      { text: '第08章 · 约束优化拉格朗日与 KKT', link: '/册05-多元微积分与凸优化/第08章-约束优化拉格朗日与KKT' },
      { text: '答案速查页', link: '/册05-多元微积分与凸优化/答案速查页' },
    ],
  },
  {
    text: '册06 · 概率统计与信息',
    collapsed: true,
    items: [
      { text: '第01章 · 概率公理', link: '/册06-概率统计与信息/第01章-概率公理' },
      { text: '第02章 · 条件概率与独立', link: '/册06-概率统计与信息/第02章-条件概率与独立' },
      { text: '第03章 · 随机变量与分布', link: '/册06-概率统计与信息/第03章-随机变量与分布' },
      { text: '第04章 · 期望与方差', link: '/册06-概率统计与信息/第04章-期望与方差' },
      { text: '第05章 · 频率派统计', link: '/册06-概率统计与信息/第05章-频率派统计' },
      { text: '第06章 · 贝叶斯推断', link: '/册06-概率统计与信息/第06章-贝叶斯推断' },
      { text: '第07章 · 常见分布族', link: '/册06-概率统计与信息/第07章-常见分布族' },
      { text: '第08章 · 信息熵与条件熵', link: '/册06-概率统计与信息/第08章-信息熵与条件熵' },
      { text: '第09章 · 互信息与 KL 散度', link: '/册06-概率统计与信息/第09章-互信息与KL散度' },
      { text: '答案速查页', link: '/册06-概率统计与信息/答案速查页' },
    ],
  },
  {
    text: '册07 · 图论与可计算性',
    collapsed: true,
    items: [
      { text: '第01章 · 图的基础', link: '/册07-图论与可计算性/第01章-图的基础' },
      { text: '第02章 · 树与图的遍历', link: '/册07-图论与可计算性/第02章-树与图的遍历' },
      { text: '第03章 · 最短路径与 Dijkstra', link: '/册07-图论与可计算性/第03章-最短路径与Dijkstra' },
      { text: '第04章 · 图着色', link: '/册07-图论与可计算性/第04章-图着色' },
      { text: '第05章 · 欧拉与哈密顿', link: '/册07-图论与可计算性/第05章-欧拉与哈密顿' },
      { text: '第06章 · 计算模型与图灵机', link: '/册07-图论与可计算性/第06章-计算模型与图灵机' },
      { text: '第07章 · 可判定性与停机问题', link: '/册07-图论与可计算性/第07章-可判定性与停机问题' },
      { text: '第08章 · P 与 NP', link: '/册07-图论与可计算性/第08章-P与NP' },
      { text: '答案速查页', link: '/册07-图论与可计算性/答案速查页' },
    ],
  },
]

// vitepress-plugin-mermaid：MermaidPlugin 实为 Vite 插件（不能 md.use），
// 正确用法是用 withMermaid 包装整个配置：它会注入 MermaidMarkdown（markdown-it
// fence 插件）、注册 Mermaid Vue 组件，并配置 mermaid 所需依赖别名。
//
// mermaid 主题：theme:'base' + themeVariables，走学术绿/暖金/赤褐配色，
// 与全站视觉统一（美学评审）。
// 注意：Mermaid 解析颜色【不支持 CSS var()】（实测报 Unsupported color format），
// 故这里用实际色值（浅色）；深色模式由 custom.css 的 `.dark .mermaid svg`
// 反相滤镜兜底（与静态 SVG 图的深色方案一致）。
export default defineConfig(withMermaid({
  mermaid: {
    theme: 'base',
    themeVariables: {
      primaryColor: '#2f6f4f33',
      primaryBorderColor: '#2f6f4f',
      primaryTextColor: '#2b302e',
      lineColor: '#2f6f4f',
      secondaryColor: '#c9a22722',
      secondaryBorderColor: '#c9a227',
      tertiaryColor: '#b3382c22',
      tertiaryBorderColor: '#b3382c',
      nodeBorderRadius: '8px',
      fontFamily: "'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif",
      fontSize: '14px',
    },
  },

  lang: 'zh-CN',
  title: '数学基础 · 创世游戏系列丛书基础卷',
  description: '《数学基础》· 创世游戏系列丛书基础卷：7 册苏格拉底对话体自学教材，从零推导、可复写证明、计算训练场 —— 造物主与老谟一问一答',
  base: '/math-foundation/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  // 工程文档（蓝图 / 册 README）不参与站点构建
  srcExclude: ['**/蓝图_v0.1.md', '丛书蓝图_v0.1.md', '**/README.md'],

  // 静态资源目录：项目根 public/（Vite 默认 publicDir，相对项目 root），
  // 构建时原样复制到 dist。logo.svg / assets/viz/* 等放这里。
  publicDir: 'public',

  head: [
    ['meta', { name: 'keywords', content: '数学,教材,微积分,线性代数,概率论,信息论,苏格拉底,对话体,自学' }],
    ['meta', { name: 'theme-color', content: '#42b883' }],
  ],

  markdown: {
    lineNumbers: false,
    config(md) {
      md.use(katex, {
        mathFence: true,
        output: 'html',
        // 册03/册04 正文大量使用 \(...\) / \[...\] 内联与块级公式，
        // 默认 delimiters='dollars' 只识别 $ / $$，必须启用 'all'
        // 才能同时渲染括号式（brackets）与美元式（dollars）两种写法。
        delimiters: 'all',
      })
      escapeVueBraces(md)
    },
  },

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: '数学基础系列',
    nav: [
      { text: '首页', link: '/' },
      {
        text: '册次目录',
        items: [
          { text: '册01 · 逻辑与数', link: '/册01-逻辑与数/第01章-数' },
          { text: '册02 · 实数极限与连续', link: '/册02-实数极限与连续/第01章-实数' },
          { text: '册03 · 单变量微积分', link: '/册03-单变量微积分/第01章-导数' },
          { text: '册04 · 线性代数', link: '/册04-线性代数/第01章-向量' },
          { text: '册05 · 多元微积分与凸优化', link: '/册05-多元微积分与凸优化/第01章-多元函数与偏导' },
          { text: '册06 · 概率统计与信息', link: '/册06-概率统计与信息/第01章-概率公理' },
        ],
      },
    ],

    sidebar: [
      { text: '🏠 首页', link: '/' },
      ...books,
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            displayDetails: '显示详情',
            resetButtonTitle: '清除',
            backButtonTitle: '返回',
            noResultsText: '未找到结果',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },

    outline: { label: '本页目录', level: [2, 3] },
    docFooter: {
      prev: '上一章',
      next: '下一章',
    },
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    lastUpdated: { text: '更新于', formatOptions: { dateStyle: 'medium', timeStyle: 'short' } },
    footer: {
      message: '苏格拉底对话体 · 从零重新推导 · 知识是推导出来的，不是背出来的',
      copyright: 'Copyright © 2026 · 开源教材（CC BY 4.0）',
    },
  },
}))
