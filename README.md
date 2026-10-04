# dsh-skill-hub

> **DSH 技能中心** —— 一个 DeepSeek Harness 插件：把「本地技能管理」和「三大技能市场」装进同一个面板，让 agent 的能力随技能即装即用。

## 这是什么插件？ / What is this?

**dsh-skill-hub** 是给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）用的**技能（Agent Skills）管理与市场插件**。技能是 `SKILL.md` 描述的能力包——装一个技能，agent 就多一项本领。这个插件解决两件事：

1. **管理本地已装技能** —— 浏览、搜索、查看/编辑、新建、启用/停用、删除、导入/导出 DSH 的技能目录（`~/.dsh/skills` 等），不用再手工翻文件；
2. **逛市场装新技能** —— 在同一个视图里搜索、预览完整 `SKILL.md`、一键下载安装来自 **[ClawHub](https://clawhub.com)**、**[ModelScope](https://modelscope.cn/skills)**、**[QwenPaw](https://platform.agentscope.io)** 三大技能源的技能，支持来源筛选与分类筛选、显示作者头像。

**两个入口**：左侧边栏的「技能中心」面板给人用；`skill_hub` 工具给 agent 用（它能自己搜技能、看详情、装技能）。

**一句话**：以前装技能要找仓库 → 下 zip → 解压 → 拷到 `~/.dsh/skills`；现在是「搜索 → 点安装」。

**What it is** — a DeepSeek Harness plugin for [Agent Skills](https://github.com/anthropics/skills) (`SKILL.md` capability packs). It manages the skills installed on your machine (browse / edit / enable / delete / import / export) and lets you search, preview and one-click install skills from the **ClawHub**, **ModelScope** and **QwenPaw** marketplaces in one merged view with source and category filters. Two entry points: a **Skills panel** in the sidebar for humans, and a **`skill_hub` tool** so the agent can find and install skills by itself.

---

## 功能 / Features

### 本地技能 / Local skills
- 列出全部本地技能并按来源分组：`~/.dsh/skills`（用户）、`<项目>/.dsh/skills`（项目）、`~/.agents/skills`、自定义目录
- 搜索、查看 / 编辑（名称、描述、whenToUse、正文）、新建、启用 / 停用（改写 `disable-model-invocation`）
- 删除（移入 `.trash`，可恢复）、导出 ZIP、从 ZIP 导入
- 只会改动“重新扫描能解析到的路径”，软链接技能只读

### 技能市场 / Marketplaces
| 来源 | 说明 | 浏览 / 搜索 | 详情 | 下载 |
|---|---|---|---|---|
| **ClawHub** | OpenClaw 生态技能注册表（clawhub.ai） | `/api/v1/search`、`/api/v1/skills` | 含完整 SKILL.md | `/api/v1/download` zip |
| **ModelScope** | 魔搭 Skills 技能中心（modelscope.cn/skills） | `/openapi/v1/skills` | `ReadMeContent` = SKILL.md | `/archive/zip/master` |
| **QwenPaw** | AgentScope 平台技能广场（platform.agentscope.io） | `/openapi/v1/skills` | 解压读取 SKILL.md | `/archive/zip/{version}` |

全部为匿名公开接口，无需 API key。

### 界面 / UI
- 左侧边栏新增 **技能中心（Skills）** 面板（`sidebar.panellist` + `main` 插槽），中英双语、跟随 DSH 主题与语言，页头带「返回会话」
- **技能市场合并视图**：三个源并行抓取、轮转交错展示，每张卡带来源徽章与作者头像（ClawHub 用 GitHub 头像、ModelScope 用 logo）
- **筛选**：来源开关（ClawHub / ModelScope / QwenPaw 任选）＋ 统一分类（工程开发 / 数据研究 / 文档办公 / 设计创作 / 自动化集成 / 产品管理 / 营销增长 / 安全合规），带实时数量徽章
- 详情预览（完整 SKILL.md + 文件清单）、安装位置可选（用户目录 / 项目目录）、一键安装

### 模型工具 / Model tool
注册 `skill_hub` 工具，动作：`sources`、`local_list`、`local_read`、`local_create`、`local_update`、`local_set_enabled`、`local_delete`、`market_search`、`market_detail`、`market_install`。用 Config 里的 `enableTools` 可关闭。

---

## 安装 / Install

**一键安装（官方 CLI）：**

```sh
dsh plugin --profile web add github:<owner>/dsh-skill-hub
```

装完重启 DeepSeek Harness，左侧边栏即出现「技能中心」面板。

**从源码构建安装（开发）：**

```powershell
# 1. 构建（需要 node + esbuild devDependency）
node scripts/build.mjs

# 2. 安装进 profile 并登记 bundle（会先备份 profile/package.json）
node scripts/install.mjs

# 3. 重启 DeepSeek Harness
```

`scripts/install.mjs` 会把包复制到 `<profile>/node_modules/dsh-skill-hub`（自带 fflate / schemastery 等运行时依赖），并在 profile 的 `package.json` 里登记 `dsh.profile.bundles` 与 `dependencies`。安装位置默认 `~/.dsh/profiles/desktop`，可用 `--profile <dir>` 指定。

## 配置 / Config

写在 profile 的 `cordis.patch.yml`，或在“设置 → 插件 → dsh-skill-hub”里改（支持热更新）：

```yaml
- id: skill-hub
  name: 'dsh-skill-hub'
  config:
    installRoot: user          # user = ~/.dsh/skills ；project = 工作区 .dsh/skills
    defaultSource: clawhub     # clawhub | modelscope | qwenpaw
    disabledSources: []        # 隐藏某些市场
    customSkillDirs: []        # 额外技能根目录
    requestTimeoutMs: 20000
    enableTools: true          # 是否给模型暴露 skill_hub 工具
```

## API / HTTP routes

浏览器与工具共用同一套路由（仅回环地址可写）：

```
GET  /api/dsh-skill-hub/health
GET  /api/dsh-skill-hub/sources
GET  /api/dsh-skill-hub/local/list?q=
GET  /api/dsh-skill-hub/local/read?name=&path=
POST /api/dsh-skill-hub/local/create | update | set-enabled | delete | import
GET  /api/dsh-skill-hub/local/export?name=&path=      → zip
GET  /api/dsh-skill-hub/market/search?source=&q=&cursor=&limit=
GET  /api/dsh-skill-hub/market/detail?source=&id=&owner=&version=&uuid=
POST /api/dsh-skill-hub/market/install                { source, id, owner?, version?, name?, root?, overwrite? }
```

## 安全 / Safety
- 写操作路由有回环信任栅栏，且只触碰“重新扫描解析到的技能路径”
- 解压/导入有路径穿越防护（拒绝 `..`、绝对路径、盘符）、文件数与体积上限
- 安装只写入技能根目录，不执行技能内容

## 开发 / Development
```
lib/            宿主端（纯 ESM，无构建）
src/client/     浏览器端（JSX，esbuild 打包成 lib/client.js）
test/smoke.mjs  核心逻辑 + 三个市场的真实联调
test/client-smoke.mjs  客户端包加载 + 服务端渲染冒烟
```

## License
MIT
