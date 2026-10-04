/**
 * zh / en strings for the Skill Hub panel. The active language follows the
 * harness locale service when it is available, else the browser language.
 */

const zh = {
  "entry.label": "技能中心",
  "tab.local": "本地技能",
  "tab.market": "技能市场",
  "filter.all": "全部",
  "filter.sources": "来源",
  "filter.categories": "分类",
  "search.local": "搜索本地技能…",
  "search.market": "搜索技能市场…",
  "action.refresh": "刷新",
  "action.new": "新建技能",
  "action.install": "安装",
  "action.installing": "安装中…",
  "action.installed": "已安装",
  "action.view": "查看",
  "action.edit": "编辑",
  "action.save": "保存",
  "action.cancel": "取消",
  "action.delete": "删除",
  "action.export": "导出 ZIP",
  "action.enable": "启用",
  "action.disable": "停用",
  "action.close": "关闭",
  "action.back": "返回会话",
  "action.loadMore": "加载更多",
  "action.open": "打开页面",
  "label.name": "名称",
  "label.description": "描述",
  "label.whenToUse": "使用时机",
  "label.content": "正文（Markdown）",
  "label.path": "路径",
  "label.version": "版本",
  "label.downloads": "下载量",
  "label.owner": "作者",
  "label.files": "文件",
  "label.installRoot": "安装到",
  "root.user": "用户目录 ~/.dsh/skills",
  "root.project": "项目 .dsh/skills",
  "state.enabled": "已启用",
  "state.disabled": "已停用",
  "empty.local": "还没有本地技能",
  "empty.market": "没有找到技能，换个关键词试试",
  "empty.detail": "选择一个技能查看详情",
  "loading": "加载中…",
  "error.title": "出错了",
  "confirm.delete": "确定删除这个技能吗？（会移到 .trash，可恢复）",
  "toast.saved": "已保存",
  "toast.deleted": "已删除",
  "toast.toggled": "状态已更新",
  "toast.exported": "已导出",
  "toast.installed": "安装完成",
  "detail.skillMd": "SKILL.md 预览",
  "market.installHint": "安装到本地技能目录，之后 agent 即可使用。",
  "local.count": "共 {count} 个技能",
};

const en = {
  "entry.label": "Skills",
  "tab.local": "Local",
  "tab.market": "Marketplace",
  "filter.all": "All",
  "filter.sources": "Sources",
  "filter.categories": "Categories",
  "search.local": "Search local skills…",
  "search.market": "Search the marketplace…",
  "action.refresh": "Refresh",
  "action.new": "New skill",
  "action.install": "Install",
  "action.installing": "Installing…",
  "action.installed": "Installed",
  "action.view": "View",
  "action.edit": "Edit",
  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.delete": "Delete",
  "action.export": "Export ZIP",
  "action.enable": "Enable",
  "action.disable": "Disable",
  "action.close": "Close",
  "action.back": "Back to chat",
  "action.loadMore": "Load more",
  "action.open": "Open page",
  "label.name": "Name",
  "label.description": "Description",
  "label.whenToUse": "When to use",
  "label.content": "Body (Markdown)",
  "label.path": "Path",
  "label.version": "Version",
  "label.downloads": "Downloads",
  "label.owner": "Owner",
  "label.files": "Files",
  "label.installRoot": "Install to",
  "root.user": "User (~/.dsh/skills)",
  "root.project": "Project (.dsh/skills)",
  "state.enabled": "Enabled",
  "state.disabled": "Disabled",
  "empty.local": "No local skills yet",
  "empty.market": "Nothing found — try another keyword",
  "empty.detail": "Pick a skill to see its details",
  "loading": "Loading…",
  "error.title": "Something went wrong",
  "confirm.delete": "Delete this skill? (moved to .trash, recoverable)",
  "toast.saved": "Saved",
  "toast.deleted": "Deleted",
  "toast.toggled": "Updated",
  "toast.exported": "Exported",
  "toast.installed": "Installed",
  "detail.skillMd": "SKILL.md preview",
  "market.installHint": "Installs into the local skill directory; the agent can use it right away.",
  "local.count": "{count} skills",
};

const DICTS = { zh, en };

/** Translate one key in the active language (falls back to zh, then the key). */
export function makeTranslator(lang) {
  const dict = DICTS[lang] ?? zh;
  return (key, params) => {
    const raw = dict[key] ?? zh[key] ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/gu, (whole, name) => (name in params ? String(params[name]) : whole));
  };
}

/** Pick a language from a locale snapshot, else the browser. */
export function detectLanguage(locale) {
  const active = locale?.getSnapshot?.().active;
  if (active === "zh" || active === "en") return active;
  return (typeof navigator !== "undefined" && /^zh/iu.test(navigator.language ?? "")) ? "zh" : "en";
}
