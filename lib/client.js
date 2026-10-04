window.__ModuleLoader__.load({
	id: "dsh-skill-hub",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react2 = __toESM(require("react"), 1);

// src/client/app.jsx
var import_react = __toESM(require("react"), 1);

// src/client/api.js
var API = {
  health: "api/dsh-skill-hub/health",
  sources: "api/dsh-skill-hub/sources",
  list: "api/dsh-skill-hub/local/list",
  read: "api/dsh-skill-hub/local/read",
  create: "api/dsh-skill-hub/local/create",
  update: "api/dsh-skill-hub/local/update",
  setEnabled: "api/dsh-skill-hub/local/set-enabled",
  delete: "api/dsh-skill-hub/local/delete",
  exportSkill: "api/dsh-skill-hub/local/export",
  importSkill: "api/dsh-skill-hub/local/import",
  search: "api/dsh-skill-hub/market/search",
  detail: "api/dsh-skill-hub/market/detail",
  install: "api/dsh-skill-hub/market/install"
};
var ApiError = class extends Error {
};
async function request(path, options = {}) {
  const init = { method: options.method ?? "GET", headers: {} };
  if (options.body !== void 0) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, init);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || payload && payload.ok === false) {
    throw new ApiError(payload?.error ?? `${response.status} ${response.statusText}`);
  }
  return payload;
}
var qs = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === void 0 || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text === "" ? "" : `?${text}`;
};
var api = {
  health: () => request(API.health),
  sources: () => request(API.sources),
  list: (q) => request(`${API.list}${qs({ q })}`),
  read: (name, path) => request(`${API.read}${qs({ name, path })}`),
  create: (body) => request(API.create, { method: "POST", body }),
  update: (body) => request(API.update, { method: "POST", body }),
  setEnabled: (name, path, enabled) => request(API.setEnabled, { method: "POST", body: { name, path, enabled } }),
  remove: (name, path) => request(API.delete, { method: "POST", body: { name, path } }),
  importSkill: (body) => request(API.importSkill, { method: "POST", body }),
  search: (source, q, cursor, limit) => request(`${API.search}${qs({ source, q, cursor, limit })}`),
  detail: (source, id, extra = {}) => request(`${API.detail}${qs({ source, id, ...extra })}`),
  install: (body) => request(API.install, { method: "POST", body }),
  /** Trigger a browser download for one exported skill. */
  async exportSkill(name, path) {
    const response = await fetch(`${API.exportSkill}${qs({ name, path })}`);
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        message = (await response.json()).error ?? message;
      } catch {
      }
      throw new ApiError(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return true;
  }
};

// src/client/i18n.js
var zh = {
  "entry.label": "\u6280\u80FD\u4E2D\u5FC3",
  "tab.local": "\u672C\u5730\u6280\u80FD",
  "tab.market": "\u6280\u80FD\u5E02\u573A",
  "filter.all": "\u5168\u90E8",
  "filter.sources": "\u6765\u6E90",
  "filter.categories": "\u5206\u7C7B",
  "search.local": "\u641C\u7D22\u672C\u5730\u6280\u80FD\u2026",
  "search.market": "\u641C\u7D22\u6280\u80FD\u5E02\u573A\u2026",
  "action.refresh": "\u5237\u65B0",
  "action.new": "\u65B0\u5EFA\u6280\u80FD",
  "action.install": "\u5B89\u88C5",
  "action.installing": "\u5B89\u88C5\u4E2D\u2026",
  "action.installed": "\u5DF2\u5B89\u88C5",
  "action.view": "\u67E5\u770B",
  "action.edit": "\u7F16\u8F91",
  "action.save": "\u4FDD\u5B58",
  "action.cancel": "\u53D6\u6D88",
  "action.delete": "\u5220\u9664",
  "action.export": "\u5BFC\u51FA ZIP",
  "action.enable": "\u542F\u7528",
  "action.disable": "\u505C\u7528",
  "action.close": "\u5173\u95ED",
  "action.back": "\u8FD4\u56DE\u4F1A\u8BDD",
  "action.loadMore": "\u52A0\u8F7D\u66F4\u591A",
  "action.open": "\u6253\u5F00\u9875\u9762",
  "label.name": "\u540D\u79F0",
  "label.description": "\u63CF\u8FF0",
  "label.whenToUse": "\u4F7F\u7528\u65F6\u673A",
  "label.content": "\u6B63\u6587\uFF08Markdown\uFF09",
  "label.path": "\u8DEF\u5F84",
  "label.version": "\u7248\u672C",
  "label.downloads": "\u4E0B\u8F7D\u91CF",
  "label.owner": "\u4F5C\u8005",
  "label.files": "\u6587\u4EF6",
  "label.installRoot": "\u5B89\u88C5\u5230",
  "root.user": "\u7528\u6237\u76EE\u5F55 ~/.dsh/skills",
  "root.project": "\u9879\u76EE .dsh/skills",
  "state.enabled": "\u5DF2\u542F\u7528",
  "state.disabled": "\u5DF2\u505C\u7528",
  "empty.local": "\u8FD8\u6CA1\u6709\u672C\u5730\u6280\u80FD",
  "empty.market": "\u6CA1\u6709\u627E\u5230\u6280\u80FD\uFF0C\u6362\u4E2A\u5173\u952E\u8BCD\u8BD5\u8BD5",
  "empty.detail": "\u9009\u62E9\u4E00\u4E2A\u6280\u80FD\u67E5\u770B\u8BE6\u60C5",
  "loading": "\u52A0\u8F7D\u4E2D\u2026",
  "error.title": "\u51FA\u9519\u4E86",
  "confirm.delete": "\u786E\u5B9A\u5220\u9664\u8FD9\u4E2A\u6280\u80FD\u5417\uFF1F\uFF08\u4F1A\u79FB\u5230 .trash\uFF0C\u53EF\u6062\u590D\uFF09",
  "toast.saved": "\u5DF2\u4FDD\u5B58",
  "toast.deleted": "\u5DF2\u5220\u9664",
  "toast.toggled": "\u72B6\u6001\u5DF2\u66F4\u65B0",
  "toast.exported": "\u5DF2\u5BFC\u51FA",
  "toast.installed": "\u5B89\u88C5\u5B8C\u6210",
  "detail.skillMd": "SKILL.md \u9884\u89C8",
  "market.installHint": "\u5B89\u88C5\u5230\u672C\u5730\u6280\u80FD\u76EE\u5F55\uFF0C\u4E4B\u540E agent \u5373\u53EF\u4F7F\u7528\u3002",
  "local.count": "\u5171 {count} \u4E2A\u6280\u80FD"
};
var en = {
  "entry.label": "Skills",
  "tab.local": "Local",
  "tab.market": "Marketplace",
  "filter.all": "All",
  "filter.sources": "Sources",
  "filter.categories": "Categories",
  "search.local": "Search local skills\u2026",
  "search.market": "Search the marketplace\u2026",
  "action.refresh": "Refresh",
  "action.new": "New skill",
  "action.install": "Install",
  "action.installing": "Installing\u2026",
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
  "empty.market": "Nothing found \u2014 try another keyword",
  "empty.detail": "Pick a skill to see its details",
  "loading": "Loading\u2026",
  "error.title": "Something went wrong",
  "confirm.delete": "Delete this skill? (moved to .trash, recoverable)",
  "toast.saved": "Saved",
  "toast.deleted": "Deleted",
  "toast.toggled": "Updated",
  "toast.exported": "Exported",
  "toast.installed": "Installed",
  "detail.skillMd": "SKILL.md preview",
  "market.installHint": "Installs into the local skill directory; the agent can use it right away.",
  "local.count": "{count} skills"
};
var DICTS = { zh, en };
function makeTranslator(lang) {
  const dict = DICTS[lang] ?? zh;
  return (key, params) => {
    const raw = dict[key] ?? zh[key] ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/gu, (whole, name) => name in params ? String(params[name]) : whole);
  };
}
function detectLanguage(locale) {
  const active = locale?.getSnapshot?.().active;
  if (active === "zh" || active === "en") return active;
  return typeof navigator !== "undefined" && /^zh/iu.test(navigator.language ?? "") ? "zh" : "en";
}

// src/client/categories.js
var CATEGORIES = [
  {
    key: "dev",
    zh: "\u5DE5\u7A0B\u5F00\u53D1",
    en: "Engineering",
    match: ["developer", "engineering", "development", "programming", "code", "devops", "dev-tool", "\u5DE5\u7A0B", "\u5F00\u53D1", "\u7F16\u7A0B"]
  },
  {
    key: "research",
    zh: "\u6570\u636E\u7814\u7A76",
    en: "Research",
    match: ["research", "knowledge", "science", "data", "study", "analysis", "\u7814\u7A76", "\u77E5\u8BC6", "\u6570\u636E", "\u79D1\u5B66"]
  },
  {
    key: "office",
    zh: "\u6587\u6863\u529E\u516C",
    en: "Office",
    match: ["productivity", "office", "document", "docs", "writing", "efficiency", "\u6587\u6863", "\u529E\u516C", "\u6548\u7387", "\u5199\u4F5C"]
  },
  {
    key: "media",
    zh: "\u8BBE\u8BA1\u521B\u4F5C",
    en: "Design & Media",
    match: ["ai-media", "media", "design", "creative", "image", "video", "audio", "lifestyle", "art", "\u8BBE\u8BA1", "\u521B\u4F5C", "\u5A92\u4F53", "\u751F\u6D3B", "\u827A\u672F"]
  },
  {
    key: "automation",
    zh: "\u81EA\u52A8\u5316\u96C6\u6210",
    en: "Automation",
    match: ["automation", "integration", "operations", "tools", "workflow", "agent", "\u81EA\u52A8\u5316", "\u96C6\u6210", "\u8FD0\u7EF4", "\u5DE5\u5177", "\u667A\u80FD\u4F53"]
  },
  {
    key: "product",
    zh: "\u4EA7\u54C1\u7BA1\u7406",
    en: "Product",
    match: ["product", "management", "business", "finance", "enterprise", "\u4EA7\u54C1", "\u7BA1\u7406", "\u5546\u4E1A", "\u91D1\u878D", "\u4F01\u4E1A"]
  },
  {
    key: "marketing",
    zh: "\u8425\u9500\u589E\u957F",
    en: "Marketing",
    match: ["marketing", "seo", "social", "communication", "growth", "sales", "\u8425\u9500", "\u589E\u957F", "\u793E\u4EA4", "\u6C9F\u901A", "\u9500\u552E"]
  },
  {
    key: "security",
    zh: "\u5B89\u5168\u5408\u89C4",
    en: "Security",
    match: ["security", "safety", "privacy", "compliance", "\u5B89\u5168", "\u5408\u89C4", "\u9690\u79C1"]
  }
];
var OTHER_CATEGORY = { key: "other", zh: "\u5176\u4ED6", en: "Other", match: [] };
var ALL_CATEGORIES = [...CATEGORIES, OTHER_CATEGORY];
function categoryOf(item) {
  const raw = [...item?.categories ?? [], item?.category].filter(Boolean).map((value) => String(value).toLowerCase());
  for (const entry of CATEGORIES) {
    if (raw.some((value) => entry.match.some((needle) => value.includes(needle)))) return entry.key;
  }
  return OTHER_CATEGORY.key;
}
function categoryLabel(key, lang) {
  const entry = ALL_CATEGORIES.find((candidate) => candidate.key === key);
  if (entry === void 0) return key;
  return (lang === "en" ? entry.en : entry.zh) ?? entry.zh;
}

// src/client/app.jsx
var h = import_react.default.createElement;
function useLang(locale) {
  const active = import_react.default.useSyncExternalStore(
    import_react.default.useCallback((listener) => locale ? locale.subscribe(listener) : () => {
    }, [locale]),
    import_react.default.useCallback(() => locale ? locale.getSnapshot().active : null, [locale]),
    import_react.default.useCallback(() => locale ? locale.getSnapshot().active : null, [locale])
  );
  return detectLanguage(active === null ? null : { getSnapshot: () => ({ active }) });
}
function Button({ variant, children, ...rest }) {
  return h("button", { className: "sh-btn", "data-variant": variant ?? "default", type: "button", ...rest }, children);
}
function Badge({ tone, children }) {
  return h("span", { className: "sh-badge", "data-tone": tone ?? "default" }, children);
}
function Avatar({ item }) {
  const [failed, setFailed] = import_react.default.useState(false);
  const fallback = item.source === "clawhub" && item.owner ? `https://github.com/${encodeURIComponent(item.owner)}.png` : void 0;
  const src = item.avatar ?? fallback;
  const label = String(item.ownerName ?? item.owner ?? item.displayName ?? item.name ?? "?").trim();
  if (!src || failed) {
    return h(
      "span",
      { className: "sh-avatar sh-avatar-initial", "aria-hidden": "true" },
      (label[0] ?? "?").toUpperCase()
    );
  }
  return h("img", {
    className: "sh-avatar",
    src,
    alt: "",
    loading: "lazy",
    referrerPolicy: "no-referrer",
    onError: () => setFailed(true)
  });
}
function Modal({ title, onClose, children, footer }) {
  return h(
    "div",
    { className: "sh-overlay", onMouseDown: (event) => {
      if (event.target === event.currentTarget) onClose();
    } },
    h(
      "div",
      { className: "sh-modal", role: "dialog" },
      h(
        "div",
        { className: "sh-modal-head" },
        h("div", { className: "sh-modal-title" }, title),
        h(Button, { onClick: onClose, "aria-label": "close" }, "\u2715")
      ),
      h("div", { className: "sh-modal-body" }, children),
      footer ? h("div", { className: "sh-modal-foot" }, footer) : null
    )
  );
}
function Field({ label, children }) {
  return h(
    "div",
    { className: "sh-field" },
    h("label", { className: "sh-label" }, label),
    children
  );
}
function Chip({ label, on, onClick, count }) {
  return h(
    "button",
    {
      type: "button",
      className: "sh-chip",
      "data-on": on ? "true" : "false",
      onClick,
      title: label
    },
    label,
    count === void 0 ? null : h("span", { className: "sh-chip-count" }, count),
    h("span", { className: "sh-chip-toggle", "aria-hidden": "true" }, on ? "\xD7" : "+")
  );
}
function LocalView({ t, toast, onCount }) {
  const [query, setQuery] = import_react.default.useState("");
  const [data, setData] = import_react.default.useState(null);
  const [error, setError] = import_react.default.useState(null);
  const [busy, setBusy] = import_react.default.useState(false);
  const [editing, setEditing] = import_react.default.useState(null);
  const [confirmDelete, setConfirmDelete] = import_react.default.useState(null);
  const refresh = import_react.default.useCallback(async (q) => {
    setBusy(true);
    setError(null);
    try {
      const payload = await api.list(q);
      setData(payload);
      onCount?.(payload.total ?? payload.skills?.length ?? 0);
    } catch (err) {
      setError(String(err.message ?? err));
    } finally {
      setBusy(false);
    }
  }, [onCount]);
  import_react.default.useEffect(() => {
    const timer = setTimeout(() => refresh(query.trim()), query === "" ? 0 : 220);
    return () => clearTimeout(timer);
  }, [query, refresh]);
  const toggle = async (skill) => {
    try {
      await api.setEnabled(skill.name, skill.path, !skill.enabled);
      toast(t("toast.toggled"));
      refresh(query.trim());
    } catch (err) {
      toast(String(err.message ?? err), "error");
    }
  };
  const openView = async (skill, mode) => {
    try {
      const detail = await api.read(skill.name, skill.path);
      setEditing({ mode, skill, detail });
    } catch (err) {
      toast(String(err.message ?? err), "error");
    }
  };
  const remove = async () => {
    const skill = confirmDelete;
    setConfirmDelete(null);
    if (!skill) return;
    try {
      await api.remove(skill.name, skill.path);
      toast(t("toast.deleted"));
      refresh(query.trim());
    } catch (err) {
      toast(String(err.message ?? err), "error");
    }
  };
  const exportSkill = async (skill) => {
    try {
      await api.exportSkill(skill.name, skill.path);
      toast(t("toast.exported"));
    } catch (err) {
      toast(String(err.message ?? err), "error");
    }
  };
  return h(
    import_react.default.Fragment,
    null,
    h(
      "div",
      { className: "sh-toolbar" },
      h("input", {
        className: "sh-input sh-search-input",
        value: query,
        placeholder: t("search.local"),
        onChange: (event) => setQuery(event.target.value)
      }),
      h(Button, { onClick: () => refresh(query.trim()) }, t("action.refresh")),
      h(Button, { variant: "primary", onClick: () => setEditing({ mode: "create", detail: {} }) }, t("action.new"))
    ),
    error ? h("div", { className: "sh-error" }, error) : null,
    h(
      "div",
      { className: "sh-content" },
      busy && data === null ? h("div", { className: "sh-empty" }, t("loading")) : null,
      data && data.groups.length === 0 ? h("div", { className: "sh-empty" }, t("empty.local")) : null,
      (data?.groups ?? []).map((group) => h(
        "div",
        { key: group.key },
        h(
          "div",
          { className: "sh-group-title" },
          langTitle(group),
          h("span", null, `${group.skills.length}`)
        ),
        h(
          "div",
          { className: "sh-list" },
          group.skills.map((skill) => h(
            "div",
            { className: "sh-card", key: skill.path },
            h(
              "div",
              { className: "sh-card-main" },
              h(
                "div",
                { className: "sh-card-title" },
                h("span", { className: "sh-card-name" }, skill.name),
                h(Badge, { tone: skill.enabled ? "ok" : "off" }, skill.enabled ? t("state.enabled") : t("state.disabled")),
                skill.version ? h(Badge, { tone: "brand" }, `v${skill.version}`) : null
              ),
              h("div", { className: "sh-card-desc" }, skill.description),
              h(
                "div",
                { className: "sh-card-meta" },
                h("span", null, skill.level),
                h("span", { className: "sh-dot" }, "\xB7"),
                h("span", null, skill.path)
              )
            ),
            h(
              "div",
              { className: "sh-card-actions" },
              h(Button, { onClick: () => openView(skill, "view") }, t("action.view")),
              h(Button, { onClick: () => openView(skill, "edit") }, t("action.edit")),
              h(Button, { onClick: () => toggle(skill) }, skill.enabled ? t("action.disable") : t("action.enable")),
              h(Button, { onClick: () => exportSkill(skill) }, t("action.export")),
              h(Button, { variant: "danger", onClick: () => setConfirmDelete(skill) }, t("action.delete"))
            )
          ))
        )
      ))
    ),
    editing ? h(SkillEditor, {
      t,
      toast,
      state: editing,
      onClose: () => setEditing(null),
      onSaved: () => {
        setEditing(null);
        toast(t("toast.saved"));
        refresh(query.trim());
      }
    }) : null,
    confirmDelete ? h(Modal, {
      title: confirmDelete.name,
      onClose: () => setConfirmDelete(null),
      footer: [
        h(Button, { key: "cancel", onClick: () => setConfirmDelete(null) }, t("action.cancel")),
        h(Button, { key: "del", variant: "danger", onClick: remove }, t("action.delete"))
      ]
    }, h("div", null, t("confirm.delete"), h("div", { className: "sh-muted", style: { marginTop: 8 } }, confirmDelete.path))) : null
  );
}
function langTitle(group) {
  const zh2 = typeof navigator !== "undefined" && /^zh/iu.test(navigator.language ?? "");
  return zh2 ? group.titleZh ?? group.title : group.title;
}
function SkillEditor({ t, toast, state, onClose, onSaved }) {
  const isCreate = state.mode === "create";
  const readOnly = state.mode === "view";
  const [form, setForm] = import_react.default.useState({
    name: state.detail?.name ?? "",
    description: state.detail?.description ?? "",
    whenToUse: state.detail?.whenToUse ?? "",
    content: state.detail?.content ?? ""
  });
  const [root, setRoot] = import_react.default.useState("user");
  const [busy, setBusy] = import_react.default.useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      if (isCreate) {
        await api.create({ root, name: form.name, description: form.description, whenToUse: form.whenToUse, content: form.content });
      } else {
        await api.update({
          name: state.detail.name,
          path: state.detail.path,
          description: form.description,
          whenToUse: form.whenToUse,
          content: form.content
        });
      }
      onSaved();
    } catch (err) {
      toast(String(err.message ?? err), "error");
    } finally {
      setBusy(false);
    }
  };
  return h(
    Modal,
    {
      title: isCreate ? t("action.new") : `${state.detail.name}`,
      onClose,
      footer: readOnly ? [h(Button, { key: "close", onClick: onClose }, t("action.close"))] : [
        h(Button, { key: "cancel", onClick: onClose }, t("action.cancel")),
        h(Button, { key: "save", variant: "primary", disabled: busy, onClick: save }, t("action.save"))
      ]
    },
    isCreate ? h(
      Field,
      { label: t("label.name") },
      h("input", { className: "sh-input", value: form.name, onChange: set("name"), placeholder: "my-skill" })
    ) : null,
    isCreate ? h(
      Field,
      { label: t("label.installRoot") },
      h(
        "div",
        { className: "sh-radio-row" },
        h(Button, { variant: root === "user" ? "primary" : "default", onClick: () => setRoot("user") }, t("root.user")),
        h(Button, { variant: root === "project" ? "primary" : "default", onClick: () => setRoot("project") }, t("root.project"))
      )
    ) : null,
    h(
      Field,
      { label: t("label.description") },
      h("input", { className: "sh-input", value: form.description, onChange: set("description"), readOnly })
    ),
    h(
      Field,
      { label: t("label.whenToUse") },
      h("input", { className: "sh-input", value: form.whenToUse ?? "", onChange: set("whenToUse"), readOnly })
    ),
    h(
      Field,
      { label: t("label.content") },
      h("textarea", { className: "sh-input", value: form.content, onChange: set("content"), readOnly, rows: 14 })
    ),
    state.detail?.path ? h("div", { className: "sh-muted" }, `${t("label.path")}: ${state.detail.path}`) : null
  );
}
function MarketView({ t, lang, toast, sources }) {
  const [query, setQuery] = import_react.default.useState("");
  const [enabled, setEnabled] = import_react.default.useState(() => new Set(sources.map((source) => source.id)));
  const [category, setCategory] = import_react.default.useState("all");
  const [pages, setPages] = import_react.default.useState({});
  const [busy, setBusy] = import_react.default.useState(false);
  const [detail, setDetail] = import_react.default.useState(null);
  const [installing, setInstalling] = import_react.default.useState(null);
  const pagesRef = import_react.default.useRef({});
  import_react.default.useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  const load = import_react.default.useCallback(async (append) => {
    setBusy(true);
    const current = pagesRef.current;
    const results = await Promise.all(sources.map(async (source) => {
      const page = append ? current[source.id] : void 0;
      if (append && (page?.done || !page?.cursor)) return [source.id, page ?? { items: [], done: true }];
      try {
        const payload = await api.search(source.id, query.trim(), append ? page?.cursor : void 0, 12);
        return [source.id, {
          items: append ? [...page?.items ?? [], ...payload.items] : payload.items,
          cursor: payload.nextCursor,
          done: !payload.nextCursor
        }];
      } catch (error) {
        return [source.id, {
          items: page?.items ?? [],
          cursor: page?.cursor,
          done: true,
          error: String(error.message ?? error)
        }];
      }
    }));
    setPages((prev) => {
      const next = { ...prev };
      for (const [id, page] of results) next[id] = page;
      return next;
    });
    setBusy(false);
  }, [sources, query]);
  import_react.default.useEffect(() => {
    setPages({});
    const timer = setTimeout(() => load(false), 220);
    return () => clearTimeout(timer);
  }, [load]);
  const merged = import_react.default.useMemo(() => {
    const lists = sources.map((source) => pages[source.id]?.items ?? []);
    const out = [];
    for (let index = 0; ; index += 1) {
      let added = false;
      for (const list of lists) {
        if (index < list.length) {
          out.push(list[index]);
          added = true;
        }
      }
      if (!added) break;
    }
    return out;
  }, [pages, sources]);
  const visible = import_react.default.useMemo(() => merged.filter((item) => enabled.has(item.source) && (category === "all" || categoryOf(item) === category)), [merged, enabled, category]);
  const categoryCounts = import_react.default.useMemo(() => {
    const counts = /* @__PURE__ */ new Map();
    for (const item of merged) {
      if (!enabled.has(item.source)) continue;
      const key = categoryOf(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [merged, enabled]);
  const toggleSource = (id) => setEnabled((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const openDetail = async (item) => {
    setDetail({ item, loading: true });
    try {
      const payload = await api.detail(item.source, item.id, { owner: item.owner, version: item.version, uuid: item.uuid });
      setDetail({ item, loading: false, payload });
    } catch (err) {
      setDetail({ item, loading: false, error: String(err.message ?? err) });
    }
  };
  const install = async (item, root) => {
    setInstalling(item.id);
    try {
      const result = await api.install({
        source: item.source,
        id: item.id,
        owner: item.owner,
        version: item.version,
        uuid: item.uuid,
        root: root ?? "user"
      });
      toast(`${t("toast.installed")} \u2192 ${result.name}`);
    } catch (err) {
      toast(String(err.message ?? err), "error");
    } finally {
      setInstalling(null);
    }
  };
  const failedSources = sources.filter((source) => pages[source.id]?.error);
  const hasMore = sources.some((source) => {
    const page = pages[source.id];
    return page && !page.done && page.cursor;
  });
  return h(
    import_react.default.Fragment,
    null,
    h(
      "div",
      { className: "sh-chips" },
      h("span", { className: "sh-chips-label" }, t("filter.categories")),
      h(Chip, {
        label: t("filter.all"),
        on: category === "all",
        count: [...categoryCounts.values()].reduce((sum, n) => sum + n, 0),
        onClick: () => setCategory("all")
      }),
      ALL_CATEGORIES.filter((entry) => (categoryCounts.get(entry.key) ?? 0) > 0 || category === entry.key).map((entry) => h(Chip, {
        key: entry.key,
        label: categoryLabel(entry.key, lang),
        on: category === entry.key,
        count: categoryCounts.get(entry.key) ?? 0,
        onClick: () => setCategory(category === entry.key ? "all" : entry.key)
      }))
    ),
    h(
      "div",
      { className: "sh-toolbar" },
      h("input", {
        className: "sh-input sh-search-input",
        value: query,
        placeholder: t("search.market"),
        onChange: (event) => setQuery(event.target.value),
        onKeyDown: (event) => {
          if (event.key === "Enter") load(false);
        }
      }),
      h(
        "div",
        { className: "sh-chips sh-chips-inline" },
        h("span", { className: "sh-chips-label" }, t("filter.sources")),
        sources.map((source) => h(Chip, {
          key: source.id,
          label: source.label,
          on: enabled.has(source.id),
          onClick: () => toggleSource(source.id)
        }))
      ),
      h(Button, { disabled: busy, onClick: () => load(false) }, t("action.refresh"))
    ),
    h(
      "div",
      { className: "sh-content" },
      failedSources.length > 0 ? h(
        "div",
        { className: "sh-error" },
        failedSources.map((source) => `${source.label}: ${pages[source.id].error}`).join(" \xB7 ")
      ) : null,
      busy && merged.length === 0 ? h("div", { className: "sh-empty" }, t("loading")) : null,
      !busy && visible.length === 0 ? h("div", { className: "sh-empty" }, t("empty.market")) : null,
      visible.length > 0 ? h(
        "div",
        { className: "sh-grid" },
        visible.map((item) => h(MarketCard, {
          key: `${item.source}/${item.owner ?? ""}/${item.id}`,
          item,
          t,
          lang,
          installing,
          onOpen: openDetail,
          onInstall: install
        }))
      ) : null,
      hasMore ? h(
        "div",
        { className: "sh-load-more" },
        h(Button, { disabled: busy, onClick: () => load(true) }, t("action.loadMore"))
      ) : null
    ),
    detail ? h(MarketDetail, {
      t,
      lang,
      detail,
      onInstall: install,
      installing,
      onClose: () => setDetail(null)
    }) : null
  );
}
var SOURCE_LABELS = { clawhub: "ClawHub", modelscope: "ModelScope", qwenpaw: "QwenPaw" };
function sourceLabel(source) {
  return SOURCE_LABELS[source] ?? source;
}
function MarketCard({ item, t, lang, installing, onOpen, onInstall }) {
  const cat = categoryOf(item);
  return h(
    "div",
    { className: "sh-card" },
    h(Avatar, { item }),
    h(
      "div",
      { className: "sh-card-main" },
      h(
        "div",
        { className: "sh-card-title" },
        h("span", { className: "sh-card-name" }, item.displayName || item.name),
        h(Badge, { tone: "brand" }, sourceLabel(item.source)),
        item.version ? h(Badge, null, `v${item.version}`) : null,
        cat !== "other" ? h(Badge, null, categoryLabel(cat, lang)) : null
      ),
      h("div", { className: "sh-card-desc" }, item.summary),
      h(
        "div",
        { className: "sh-card-meta" },
        item.ownerName || item.owner ? h("span", null, `${t("label.owner")}: ${item.ownerName ?? item.owner}`) : null,
        item.downloads ? h("span", null, `${t("label.downloads")}: ${item.downloads}`) : null,
        item.license ? h("span", null, item.license) : null
      ),
      h(
        "div",
        { className: "sh-card-footer" },
        h(Button, { onClick: () => onOpen(item) }, t("action.view")),
        h(Button, {
          variant: "primary",
          disabled: installing === item.id || item.installable === false,
          onClick: () => onInstall(item)
        }, installing === item.id ? t("action.installing") : t("action.install"))
      )
    )
  );
}
function MarketDetail({ t, lang, detail, onInstall, installing, onClose }) {
  const [root, setRoot] = import_react.default.useState("user");
  const payload = detail.payload;
  const item = payload?.skill ?? detail.item;
  const text = payload?.skillMd ?? payload?.readme ?? "";
  const cat = categoryOf(item);
  return h(
    Modal,
    {
      title: item.displayName || item.name || item.id,
      onClose,
      footer: [
        h(Button, { key: "cancel", onClick: onClose }, t("action.close")),
        h(Button, {
          key: "install",
          variant: "primary",
          disabled: installing === detail.item.id,
          onClick: () => onInstall(detail.item, root)
        }, installing === detail.item.id ? t("action.installing") : t("action.install"))
      ]
    },
    h(
      "div",
      { className: "sh-detail-head" },
      h(Avatar, { item }),
      h(
        "div",
        { className: "sh-detail-meta" },
        h(
          "div",
          { className: "sh-card-footer", style: { marginTop: 0 } },
          h(Badge, { tone: "brand" }, sourceLabel(item.source)),
          item.version ? h(Badge, null, `${t("label.version")}: ${item.version}`) : null,
          item.downloads ? h(Badge, null, `${t("label.downloads")}: ${item.downloads}`) : null,
          cat !== "other" ? h(Badge, null, categoryLabel(cat, lang)) : null,
          item.license ? h(Badge, null, item.license) : null
        ),
        h(
          "div",
          { className: "sh-muted" },
          item.ownerName || item.owner ? `${t("label.owner")}: ${item.ownerName ?? item.owner}` : "",
          item.url ? h("a", { href: item.url, target: "_blank", rel: "noreferrer", className: "sh-muted", style: { marginLeft: 10 } }, t("action.open")) : null
        )
      )
    ),
    item.summary ? h("div", { className: "sh-card-desc", style: { WebkitLineClamp: 5, marginBottom: 10 } }, item.summary) : null,
    h(
      Field,
      { label: t("label.installRoot") },
      h(
        "div",
        { className: "sh-radio-row" },
        h(Button, { variant: root === "user" ? "primary" : "default", onClick: () => setRoot("user") }, t("root.user")),
        h(Button, { variant: root === "project" ? "primary" : "default", onClick: () => setRoot("project") }, t("root.project"))
      )
    ),
    h("div", { className: "sh-muted", style: { marginBottom: 6 } }, t("market.installHint")),
    detail.loading ? h("div", { className: "sh-empty" }, t("loading")) : null,
    detail.error ? h("div", { className: "sh-error" }, detail.error) : null,
    text ? h(
      "div",
      null,
      h("div", { className: "sh-label" }, t("detail.skillMd")),
      h("div", { className: "sh-preview" }, text)
    ) : null,
    payload?.files?.length ? h(
      "div",
      { className: "sh-filelist" },
      payload.files.slice(0, 60).map((file) => h("span", { className: "sh-file", key: file.path }, file.path))
    ) : null
  );
}
function SkillHubApp({ locale, onBack }) {
  const lang = useLang(locale);
  const t = import_react.default.useMemo(() => makeTranslator(lang), [lang]);
  const [sources, setSources] = import_react.default.useState([]);
  const [tab, setTab] = import_react.default.useState("local");
  const [toastState, setToastState] = import_react.default.useState(null);
  const [count, setCount] = import_react.default.useState(null);
  const timerRef = import_react.default.useRef(null);
  import_react.default.useEffect(() => {
    let cancelled = false;
    api.sources().then((payload) => {
      if (cancelled) return;
      setSources((payload.sources ?? []).filter((source) => source.enabled !== false));
    }).catch(() => {
      if (!cancelled) setSources([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const toast = import_react.default.useCallback((message, tone) => {
    setToastState({ message, tone: tone ?? "ok" });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToastState(null), 3200);
  }, []);
  const tabs = [
    { key: "local", label: t("tab.local") },
    { key: "market", label: t("tab.market") }
  ];
  return h(
    "div",
    { className: "dsh-skill-hub" },
    h(
      "div",
      { className: "sh-panel" },
      h(
        "div",
        { className: "sh-panel-header" },
        onBack ? h("button", {
          type: "button",
          className: "sh-back",
          onClick: onBack,
          title: t("action.back")
        }, h("span", { "aria-hidden": "true" }, "\u2190"), h("span", null, t("action.back"))) : null,
        h(
          "h2",
          { className: "sh-title" },
          h(Icon, null),
          t("entry.label"),
          count === null ? null : h(Badge, null, t("local.count", { count }))
        ),
        h(
          "div",
          { className: "sh-tabs", role: "tablist" },
          tabs.map((entry) => h("button", {
            key: entry.key,
            type: "button",
            role: "tab",
            className: "sh-tab",
            "aria-selected": tab === entry.key,
            "data-active": tab === entry.key ? "true" : "false",
            onClick: () => setTab(entry.key)
          }, entry.label))
        )
      ),
      tab === "local" ? h(LocalView, { t, toast, onCount: setCount }) : h(MarketView, { t, lang, toast, sources })
    ),
    toastState ? h("div", { className: "sh-toast", "data-tone": toastState.tone }, toastState.message) : null
  );
}
function Icon() {
  return h(
    "svg",
    {
      width: 18,
      height: 18,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.3,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    h("path", { d: "M8 3.2C6.6 2 4.5 2 3 2v10.5c1.5 0 3.6 0 5 1.3 1.4-1.3 3.5-1.3 5-1.3V2c-1.5 0-3.6 0-5 1.2z" }),
    h("path", { d: "M8 3.2v10.6" })
  );
}
function PanelIcon({ size }) {
  return h(
    "svg",
    {
      "data-dsh-panel-entry": "skill-hub",
      viewBox: "0 0 16 16",
      width: size ?? 16,
      height: size ?? 16,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.3,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    h("path", { d: "M8 3.2C6.6 2 4.5 2 3 2v10.5c1.5 0 3.6 0 5 1.3 1.4-1.3 3.5-1.3 5-1.3V2c-1.5 0-3.6 0-5 1.2z" }),
    h("path", { d: "M8 3.2v10.6" })
  );
}

// src/client/styles.js
var STYLE_ID = "dsh-skill-hub-style";
var CSS = `
.dsh-skill-hub {
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--dsw-alias-bg-base, #0e1116);
  color: var(--dsw-alias-label-primary, #e6e8eb);
  font-family: var(--dsw-font-family, inherit);
  font-size: 13px;
}
.dsh-skill-hub * { box-sizing: border-box; }
.dsh-skill-hub ::-webkit-scrollbar { width: 10px; height: 10px; }
.dsh-skill-hub ::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-border-l2, rgba(255,255,255,.16));
  border-radius: 6px;
  border: 3px solid transparent;
  background-clip: content-box;
}

.dsh-skill-hub .sh-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px 16px;
}

/* ------------------------------------------------------------ page header */
.dsh-skill-hub .sh-panel-header {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
}
.dsh-skill-hub .sh-back {
  appearance: none;
  font: inherit;
  font-size: 12.5px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px 5px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #9aa3ad);
  cursor: pointer;
  white-space: nowrap;
}
.dsh-skill-hub .sh-back:hover {
  color: var(--dsw-alias-label-primary, #e6e8eb);
  background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.07));
}
.dsh-skill-hub .sh-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* segmented control, right-aligned like the console's \u5E94\u7528/\u63D2\u4EF6/\u6280\u80FD */
.dsh-skill-hub .sh-tabs {
  flex: none;
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.07));
  border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.06));
}
.dsh-skill-hub .sh-tab {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #9aa3ad);
  font: inherit;
  font-size: 12.5px;
  padding: 5px 13px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.dsh-skill-hub .sh-tab:hover { color: var(--dsw-alias-label-primary, #e6e8eb); }
.dsh-skill-hub .sh-tab[data-active="true"] {
  color: var(--dsw-alias-label-primary, #e6e8eb);
  background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.12));
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0,0,0,.22);
}

/* ---------------------------------------------------------------- toolbar */
.dsh-skill-hub .sh-toolbar {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.dsh-skill-hub .sh-input {
  font: inherit;
  font-size: 13px;
  padding: 7px 11px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16));
  background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.05));
  color: var(--dsw-alias-label-primary, #e6e8eb);
  outline: none;
}
.dsh-skill-hub .sh-input:focus { border-color: var(--dsw-alias-brand-primary, #4c8dff); }
.dsh-skill-hub .sh-input::placeholder { color: var(--dsw-alias-label-tertiary, #7d8791); }
.dsh-skill-hub .sh-search-input { flex: 1 1 240px; min-width: 160px; }
.dsh-skill-hub textarea.sh-input { resize: vertical; min-height: 90px; line-height: 1.55; width: 100%; }
.dsh-skill-hub .sh-toolbar-spacer { flex: 1; }

.dsh-skill-hub .sh-btn {
  appearance: none;
  font: inherit;
  font-size: 12.5px;
  padding: 6px 13px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16));
  background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.06));
  color: var(--dsw-alias-label-primary, #e6e8eb);
  white-space: nowrap;
}
.dsh-skill-hub .sh-btn:hover { border-color: var(--dsw-alias-brand-primary, #4c8dff); }
.dsh-skill-hub .sh-btn[data-variant="primary"] {
  background: var(--dsw-alias-brand-primary, #4c8dff);
  border-color: transparent;
  color: var(--dsw-alias-bg-layer-3, #fff);
}
.dsh-skill-hub .sh-btn[data-variant="danger"]:hover {
  border-color: var(--dsw-alias-state-error-primary, #f2625a);
  color: var(--dsw-alias-state-error-primary, #f2625a);
}
.dsh-skill-hub .sh-btn:disabled { opacity: .55; cursor: default; }

/* ---------------------------------------------------------------- content */
.dsh-skill-hub .sh-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: 20px;
}
.dsh-skill-hub .sh-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 10px;
}
.dsh-skill-hub .sh-list { display: flex; flex-direction: column; gap: 8px; }

.dsh-skill-hub .sh-group-title {
  font-size: 11.5px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: var(--dsw-alias-label-tertiary, #7d8791);
  margin: 14px 2px 8px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.dsh-skill-hub .sh-group-title:first-child { margin-top: 2px; }
.dsh-skill-hub .sh-group-title span { font-weight: 400; text-transform: none; letter-spacing: 0; }

.dsh-skill-hub .sh-card {
  border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08));
  background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.035));
  border-radius: 12px;
  padding: 11px 13px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.dsh-skill-hub .sh-card:hover { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.18)); }
.dsh-skill-hub .sh-card-main { flex: 1; min-width: 0; }
.dsh-skill-hub .sh-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 13.5px;
  flex-wrap: wrap;
}
.dsh-skill-hub .sh-card-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.dsh-skill-hub .sh-card-desc {
  margin-top: 3px;
  color: var(--dsw-alias-label-secondary, #9aa3ad);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dsh-skill-hub .sh-card-meta {
  margin-top: 6px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  color: var(--dsw-alias-label-tertiary, #7d8791);
  font-size: 11.5px;
}
.dsh-skill-hub .sh-card-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.dsh-skill-hub .sh-card-footer {
  margin-top: 9px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.dsh-skill-hub .sh-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.10));
  color: var(--dsw-alias-label-secondary, #9aa3ad);
  background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.05));
  white-space: nowrap;
}
.dsh-skill-hub .sh-badge[data-tone="ok"] {
  color: var(--dsw-alias-state-success-primary, #41c26f);
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #41c26f) 45%, transparent);
}
.dsh-skill-hub .sh-badge[data-tone="off"] {
  color: var(--dsw-alias-state-idle-primary, #8b939c);
  border-color: color-mix(in srgb, var(--dsw-alias-state-idle-primary, #8b939c) 45%, transparent);
}
.dsh-skill-hub .sh-badge[data-tone="brand"] {
  color: var(--dsw-alias-brand-primary, #4c8dff);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #4c8dff) 45%, transparent);
}

.dsh-skill-hub .sh-empty {
  padding: 48px 16px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary, #7d8791);
}
.dsh-skill-hub .sh-error {
  margin-bottom: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #f2625a) 45%, transparent);
  color: var(--dsw-alias-state-error-primary, #f2625a);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #f2625a) 12%, transparent);
}
.dsh-skill-hub .sh-load-more { display: flex; justify-content: center; padding: 14px 0 4px; }

/* ------------------------------------------------------------ toast/modal */
.dsh-skill-hub .sh-toast {
  position: absolute;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  padding: 8px 16px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-overlay, rgba(20,24,30,.96));
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.18));
  box-shadow: 0 12px 32px rgba(0,0,0,.35);
  z-index: 30;
}
.dsh-skill-hub .sh-toast[data-tone="error"] {
  border-color: var(--dsw-alias-state-error-primary, #f2625a);
  color: var(--dsw-alias-state-error-primary, #f2625a);
}

.dsh-skill-hub .sh-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  padding: 24px;
}
.dsh-skill-hub .sh-modal {
  width: min(860px, 100%);
  max-height: min(760px, 100%);
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-1, #161b22);
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16));
  box-shadow: 0 24px 64px rgba(0,0,0,.5);
  overflow: hidden;
}
.dsh-skill-hub .sh-modal-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08));
}
.dsh-skill-hub .sh-modal-title { font-size: 14.5px; font-weight: 650; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-skill-hub .sh-modal-body { padding: 14px 16px; overflow: auto; }
.dsh-skill-hub .sh-modal-foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08));
}

.dsh-skill-hub .sh-field { margin-bottom: 12px; }
.dsh-skill-hub .sh-label {
  display: block;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, #7d8791);
  margin-bottom: 5px;
  letter-spacing: .3px;
}
.dsh-skill-hub .sh-preview {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.65;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08));
  background: var(--dsw-alias-bg-base, rgba(0,0,0,.25));
  color: var(--dsw-alias-label-secondary, #b7bec7);
  max-height: 420px;
  overflow: auto;
}
.dsh-skill-hub .sh-filelist { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.dsh-skill-hub .sh-file {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.06));
  color: var(--dsw-alias-label-secondary, #9aa3ad);
}
.dsh-skill-hub .sh-radio-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dsh-skill-hub .sh-muted { color: var(--dsw-alias-label-tertiary, #7d8791); }
.dsh-skill-hub .sh-dot { opacity: .5; }

/* ------------------------------------------------------------- avatars */
.dsh-skill-hub .sh-avatar {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.08));
  border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.10));
}
.dsh-skill-hub .sh-avatar-initial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: var(--dsw-alias-brand-primary, #4c8dff);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4c8dff) 16%, transparent);
}
.dsh-skill-hub .sh-detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.dsh-skill-hub .sh-detail-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ------------------------------------------------------- filter chips */
.dsh-skill-hub .sh-chips {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.dsh-skill-hub .sh-chips-inline { flex-wrap: nowrap; overflow: auto; max-width: 100%; }
.dsh-skill-hub .sh-chips-label {
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, #7d8791);
  white-space: nowrap;
  margin-right: 2px;
}
.dsh-skill-hub .sh-chip {
  appearance: none;
  font: inherit;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16));
  background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.05));
  color: var(--dsw-alias-label-secondary, #9aa3ad);
}
.dsh-skill-hub .sh-chip:hover { color: var(--dsw-alias-label-primary, #e6e8eb); }
.dsh-skill-hub .sh-chip[data-on="true"] {
  color: var(--dsw-alias-label-primary, #e6e8eb);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #4c8dff) 55%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4c8dff) 16%, transparent);
}
.dsh-skill-hub .sh-chip[data-on="false"] { opacity: .72; }
.dsh-skill-hub .sh-chip-count {
  font-size: 10.5px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.10));
  color: var(--dsw-alias-label-tertiary, #7d8791);
}
.dsh-skill-hub .sh-chip-toggle {
  font-size: 12px;
  line-height: 1;
  opacity: .7;
  margin-left: 1px;
}
`;
function injectStyles(doc = document) {
  if (doc.getElementById(STYLE_ID) !== null) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

// src/client/index.jsx
var PANEL_ID = "skill-hub";
var PANEL_ORDER = 20;
var inject = ["slots"];
function SkillHubPanel(props) {
  return import_react2.default.createElement(SkillHubApp, { locale: props?.locale, onBack: props?.onBack });
}
function apply(ctx) {
  injectStyles();
  const slots = ctx.slots;
  const locale = ctx.reflect?.get?.("locale");
  const onBack = () => {
    try {
      ctx.get?.("layout", false)?.selectPanel?.(null);
    } catch (error) {
      console.warn("[skill-hub] back to conversation failed:", error);
    }
  };
  const disposers = [];
  try {
    disposers.push(slots.inject("sidebar.panellist", () => slots.register({
      name: "sidebar.panellist",
      id: PANEL_ID,
      order: PANEL_ORDER,
      label: () => "Skills"
    }, PanelIcon)));
  } catch (error) {
    console.warn("[skill-hub] sidebar entry registration failed:", error);
  }
  try {
    disposers.push(slots.inject("main", () => slots.register({
      name: "main",
      key: PANEL_ID,
      inject: () => ({ locale, onBack })
    }, SkillHubPanel)));
  } catch (error) {
    console.warn("[skill-hub] page registration failed:", error);
  }
  ctx.effect(() => () => {
    for (const dispose of disposers.splice(0)) dispose();
  }, "skill-hub: ui mounts");
}

		return module.exports;
	}
});
