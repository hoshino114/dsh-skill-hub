/**
 * The Skill Hub panel: local skill management plus a merged view over the
 * ClawHub / ModelScope / QwenPaw marketplaces.
 * Plain React with a scoped stylesheet (see styles.js) — no UI framework.
 */

import React from "react";
import { api } from "./api.js";
import { makeTranslator, detectLanguage } from "./i18n.js";
import { categoryOf, categoryLabel, ALL_CATEGORIES } from "./categories.js";

const h = React.createElement;

/** Follow the harness language preference, re-rendering on every switch. */
function useLang(locale) {
  const active = React.useSyncExternalStore(
    React.useCallback((listener) => (locale ? locale.subscribe(listener) : () => {}), [locale]),
    React.useCallback(() => (locale ? locale.getSnapshot().active : null), [locale]),
    React.useCallback(() => (locale ? locale.getSnapshot().active : null), [locale]),
  );
  return detectLanguage(active === null ? null : { getSnapshot: () => ({ active }) });
}

/* ------------------------------------------------------------------ atoms */

function Button({ variant, children, ...rest }) {
  return h("button", { className: "sh-btn", "data-variant": variant ?? "default", type: "button", ...rest }, children);
}

function Badge({ tone, children }) {
  return h("span", { className: "sh-badge", "data-tone": tone ?? "default" }, children);
}

/**
 * Author avatar: the host-supplied image when there is one, a GitHub avatar as
 * a progressive fallback for ClawHub owners, else a colored initial.
 */
function Avatar({ item }) {
  const [failed, setFailed] = React.useState(false);
  const fallback = item.source === "clawhub" && item.owner ? `https://github.com/${encodeURIComponent(item.owner)}.png` : undefined;
  const src = item.avatar ?? fallback;
  const label = String(item.ownerName ?? item.owner ?? item.displayName ?? item.name ?? "?").trim();
  if (!src || failed) {
    return h("span", { className: "sh-avatar sh-avatar-initial", "aria-hidden": "true" },
      (label[0] ?? "?").toUpperCase());
  }
  return h("img", {
    className: "sh-avatar",
    src,
    alt: "",
    loading: "lazy",
    referrerPolicy: "no-referrer",
    onError: () => setFailed(true),
  });
}

function Modal({ title, onClose, children, footer }) {
  return h("div", { className: "sh-overlay", onMouseDown: (event) => {
    if (event.target === event.currentTarget) onClose();
  } },
    h("div", { className: "sh-modal", role: "dialog" },
      h("div", { className: "sh-modal-head" },
        h("div", { className: "sh-modal-title" }, title),
        h(Button, { onClick: onClose, "aria-label": "close" }, "✕")),
      h("div", { className: "sh-modal-body" }, children),
      footer ? h("div", { className: "sh-modal-foot" }, footer) : null));
}

function Field({ label, children }) {
  return h("div", { className: "sh-field" },
    h("label", { className: "sh-label" }, label),
    children);
}

/** One filter chip; `on` chips show a ✕, off chips a ＋ (console style). */
function Chip({ label, on, onClick, count }) {
  return h("button", {
    type: "button",
    className: "sh-chip",
    "data-on": on ? "true" : "false",
    onClick,
    title: label,
  }, label, count === undefined ? null : h("span", { className: "sh-chip-count" }, count),
    h("span", { className: "sh-chip-toggle", "aria-hidden": "true" }, on ? "×" : "+"));
}

/* ------------------------------------------------------------- local view */

function LocalView({ t, toast, onCount }) {
  const [query, setQuery] = React.useState("");
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(null); // {mode, skill, detail}
  const [confirmDelete, setConfirmDelete] = React.useState(null);

  const refresh = React.useCallback(async (q) => {
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

  React.useEffect(() => {
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

  return h(React.Fragment, null,
    h("div", { className: "sh-toolbar" },
      h("input", {
        className: "sh-input sh-search-input",
        value: query,
        placeholder: t("search.local"),
        onChange: (event) => setQuery(event.target.value),
      }),
      h(Button, { onClick: () => refresh(query.trim()) }, t("action.refresh")),
      h(Button, { variant: "primary", onClick: () => setEditing({ mode: "create", detail: {} }) }, t("action.new"))),
    error ? h("div", { className: "sh-error" }, error) : null,
    h("div", { className: "sh-content" },
      busy && data === null ? h("div", { className: "sh-empty" }, t("loading")) : null,
      data && data.groups.length === 0 ? h("div", { className: "sh-empty" }, t("empty.local")) : null,
      (data?.groups ?? []).map((group) => h("div", { key: group.key },
        h("div", { className: "sh-group-title" },
          (langTitle(group)),
          h("span", null, `${group.skills.length}`)),
        h("div", { className: "sh-list" },
          group.skills.map((skill) => h("div", { className: "sh-card", key: skill.path },
            h("div", { className: "sh-card-main" },
              h("div", { className: "sh-card-title" },
                h("span", { className: "sh-card-name" }, skill.name),
                h(Badge, { tone: skill.enabled ? "ok" : "off" }, skill.enabled ? t("state.enabled") : t("state.disabled")),
                skill.version ? h(Badge, { tone: "brand" }, `v${skill.version}`) : null),
              h("div", { className: "sh-card-desc" }, skill.description),
              h("div", { className: "sh-card-meta" },
                h("span", null, skill.level),
                h("span", { className: "sh-dot" }, "·"),
                h("span", null, skill.path))),
            h("div", { className: "sh-card-actions" },
              h(Button, { onClick: () => openView(skill, "view") }, t("action.view")),
              h(Button, { onClick: () => openView(skill, "edit") }, t("action.edit")),
              h(Button, { onClick: () => toggle(skill) }, skill.enabled ? t("action.disable") : t("action.enable")),
              h(Button, { onClick: () => exportSkill(skill) }, t("action.export")),
              h(Button, { variant: "danger", onClick: () => setConfirmDelete(skill) }, t("action.delete"))))))))),
    editing ? h(SkillEditor, {
      t,
      toast,
      state: editing,
      onClose: () => setEditing(null),
      onSaved: () => {
        setEditing(null);
        toast(t("toast.saved"));
        refresh(query.trim());
      },
    }) : null,
    confirmDelete ? h(Modal, {
      title: confirmDelete.name,
      onClose: () => setConfirmDelete(null),
      footer: [
        h(Button, { key: "cancel", onClick: () => setConfirmDelete(null) }, t("action.cancel")),
        h(Button, { key: "del", variant: "danger", onClick: remove }, t("action.delete")),
      ],
    }, h("div", null, t("confirm.delete"), h("div", { className: "sh-muted", style: { marginTop: 8 } }, confirmDelete.path))) : null);
}

function langTitle(group) {
  const zh = typeof navigator !== "undefined" && /^zh/iu.test(navigator.language ?? "");
  return zh ? group.titleZh ?? group.title : group.title;
}

/* ------------------------------------------------------------ skill editor */

function SkillEditor({ t, toast, state, onClose, onSaved }) {
  const isCreate = state.mode === "create";
  const readOnly = state.mode === "view";
  const [form, setForm] = React.useState({
    name: state.detail?.name ?? "",
    description: state.detail?.description ?? "",
    whenToUse: state.detail?.whenToUse ?? "",
    content: state.detail?.content ?? "",
  });
  const [root, setRoot] = React.useState("user");
  const [busy, setBusy] = React.useState(false);

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
          content: form.content,
        });
      }
      onSaved();
    } catch (err) {
      toast(String(err.message ?? err), "error");
    } finally {
      setBusy(false);
    }
  };

  return h(Modal, {
    title: isCreate ? t("action.new") : `${state.detail.name}`,
    onClose,
    footer: readOnly
      ? [h(Button, { key: "close", onClick: onClose }, t("action.close"))]
      : [
        h(Button, { key: "cancel", onClick: onClose }, t("action.cancel")),
        h(Button, { key: "save", variant: "primary", disabled: busy, onClick: save }, t("action.save")),
      ],
  },
    isCreate ? h(Field, { label: t("label.name") },
      h("input", { className: "sh-input", value: form.name, onChange: set("name"), placeholder: "my-skill" })) : null,
    isCreate ? h(Field, { label: t("label.installRoot") },
      h("div", { className: "sh-radio-row" },
        h(Button, { variant: root === "user" ? "primary" : "default", onClick: () => setRoot("user") }, t("root.user")),
        h(Button, { variant: root === "project" ? "primary" : "default", onClick: () => setRoot("project") }, t("root.project")))) : null,
    h(Field, { label: t("label.description") },
      h("input", { className: "sh-input", value: form.description, onChange: set("description"), readOnly })),
    h(Field, { label: t("label.whenToUse") },
      h("input", { className: "sh-input", value: form.whenToUse ?? "", onChange: set("whenToUse"), readOnly })),
    h(Field, { label: t("label.content") },
      h("textarea", { className: "sh-input", value: form.content, onChange: set("content"), readOnly, rows: 14 })),
    state.detail?.path ? h("div", { className: "sh-muted" }, `${t("label.path")}: ${state.detail.path}`) : null);
}

/* ------------------------------------------------------------ market view */

/**
 * The merged marketplace: every source is fetched in parallel and the results
 * are interleaved round-robin, so all three markets are visible at once.
 * Source and category chips only filter the merged list (no refetch).
 */
function MarketView({ t, lang, toast, sources }) {
  const [query, setQuery] = React.useState("");
  const [enabled, setEnabled] = React.useState(() => new Set(sources.map((source) => source.id)));
  const [category, setCategory] = React.useState("all");
  const [pages, setPages] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  const [installing, setInstalling] = React.useState(null);
  const pagesRef = React.useRef({});
  React.useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  /** Fetch one page from every source (the chips filter display only). */
  const load = React.useCallback(async (append) => {
    setBusy(true);
    const current = pagesRef.current;
    const results = await Promise.all(sources.map(async (source) => {
      const page = append ? current[source.id] : undefined;
      if (append && (page?.done || !page?.cursor)) return [source.id, page ?? { items: [], done: true }];
      try {
        const payload = await api.search(source.id, query.trim(), append ? page?.cursor : undefined, 12);
        return [source.id, {
          items: append ? [...(page?.items ?? []), ...payload.items] : payload.items,
          cursor: payload.nextCursor,
          done: !payload.nextCursor,
        }];
      } catch (error) {
        return [source.id, {
          items: page?.items ?? [],
          cursor: page?.cursor,
          done: true,
          error: String(error.message ?? error),
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

  React.useEffect(() => {
    setPages({});
    const timer = setTimeout(() => load(false), 220);
    return () => clearTimeout(timer);
  }, [load]);

  /** Interleave the per-source lists so every market shows up front. */
  const merged = React.useMemo(() => {
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

  /** What the chips filter: sources first, then category. */
  const visible = React.useMemo(() => merged.filter((item) => enabled.has(item.source)
    && (category === "all" || categoryOf(item) === category)), [merged, enabled, category]);

  /** Category counts over the source-filtered list, so chips never show empty buckets. */
  const categoryCounts = React.useMemo(() => {
    const counts = new Map();
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
        root: root ?? "user",
      });
      toast(`${t("toast.installed")} → ${result.name}`);
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

  return h(React.Fragment, null,
    h("div", { className: "sh-chips" },
      h("span", { className: "sh-chips-label" }, t("filter.categories")),
      h(Chip, {
        label: t("filter.all"),
        on: category === "all",
        count: [...categoryCounts.values()].reduce((sum, n) => sum + n, 0),
        onClick: () => setCategory("all"),
      }),
      ALL_CATEGORIES
        .filter((entry) => (categoryCounts.get(entry.key) ?? 0) > 0 || category === entry.key)
        .map((entry) => h(Chip, {
          key: entry.key,
          label: categoryLabel(entry.key, lang),
          on: category === entry.key,
          count: categoryCounts.get(entry.key) ?? 0,
          onClick: () => setCategory(category === entry.key ? "all" : entry.key),
        }))),
    h("div", { className: "sh-toolbar" },
      h("input", {
        className: "sh-input sh-search-input",
        value: query,
        placeholder: t("search.market"),
        onChange: (event) => setQuery(event.target.value),
        onKeyDown: (event) => {
          if (event.key === "Enter") load(false);
        },
      }),
      h("div", { className: "sh-chips sh-chips-inline" },
        h("span", { className: "sh-chips-label" }, t("filter.sources")),
        sources.map((source) => h(Chip, {
          key: source.id,
          label: source.label,
          on: enabled.has(source.id),
          onClick: () => toggleSource(source.id),
        }))),
      h(Button, { disabled: busy, onClick: () => load(false) }, t("action.refresh"))),
    h("div", { className: "sh-content" },
      failedSources.length > 0
        ? h("div", { className: "sh-error" },
          failedSources.map((source) => `${source.label}: ${pages[source.id].error}`).join(" · "))
        : null,
      busy && merged.length === 0 ? h("div", { className: "sh-empty" }, t("loading")) : null,
      !busy && visible.length === 0 ? h("div", { className: "sh-empty" }, t("empty.market")) : null,
      visible.length > 0 ? h("div", { className: "sh-grid" },
        visible.map((item) => h(MarketCard, {
          key: `${item.source}/${item.owner ?? ""}/${item.id}`,
          item,
          t,
          lang,
          installing,
          onOpen: openDetail,
          onInstall: install,
        }))) : null,
      hasMore ? h("div", { className: "sh-load-more" },
        h(Button, { disabled: busy, onClick: () => load(true) }, t("action.loadMore"))) : null),
    detail ? h(MarketDetail, {
      t,
      lang,
      detail,
      onInstall: install,
      installing,
      onClose: () => setDetail(null),
    }) : null);
}

const SOURCE_LABELS = { clawhub: "ClawHub", modelscope: "ModelScope", qwenpaw: "QwenPaw" };
function sourceLabel(source) {
  return SOURCE_LABELS[source] ?? source;
}

/** One marketplace card: avatar, name, badges, summary, meta and actions. */
function MarketCard({ item, t, lang, installing, onOpen, onInstall }) {
  const cat = categoryOf(item);
  return h("div", { className: "sh-card" },
    h(Avatar, { item }),
    h("div", { className: "sh-card-main" },
      h("div", { className: "sh-card-title" },
        h("span", { className: "sh-card-name" }, item.displayName || item.name),
        h(Badge, { tone: "brand" }, sourceLabel(item.source)),
        item.version ? h(Badge, null, `v${item.version}`) : null,
        cat !== "other" ? h(Badge, null, categoryLabel(cat, lang)) : null),
      h("div", { className: "sh-card-desc" }, item.summary),
      h("div", { className: "sh-card-meta" },
        item.ownerName || item.owner ? h("span", null, `${t("label.owner")}: ${item.ownerName ?? item.owner}`) : null,
        item.downloads ? h("span", null, `${t("label.downloads")}: ${item.downloads}`) : null,
        item.license ? h("span", null, item.license) : null),
      h("div", { className: "sh-card-footer" },
        h(Button, { onClick: () => onOpen(item) }, t("action.view")),
        h(Button, {
          variant: "primary",
          disabled: installing === item.id || item.installable === false,
          onClick: () => onInstall(item),
        }, installing === item.id ? t("action.installing") : t("action.install")))));
}

function MarketDetail({ t, lang, detail, onInstall, installing, onClose }) {
  const [root, setRoot] = React.useState("user");
  const payload = detail.payload;
  const item = payload?.skill ?? detail.item;
  const text = payload?.skillMd ?? payload?.readme ?? "";
  const cat = categoryOf(item);
  return h(Modal, {
    title: item.displayName || item.name || item.id,
    onClose,
    footer: [
      h(Button, { key: "cancel", onClick: onClose }, t("action.close")),
      h(Button, {
        key: "install",
        variant: "primary",
        disabled: installing === detail.item.id,
        onClick: () => onInstall(detail.item, root),
      }, installing === detail.item.id ? t("action.installing") : t("action.install")),
    ],
  },
    h("div", { className: "sh-detail-head" },
      h(Avatar, { item }),
      h("div", { className: "sh-detail-meta" },
        h("div", { className: "sh-card-footer", style: { marginTop: 0 } },
          h(Badge, { tone: "brand" }, sourceLabel(item.source)),
          item.version ? h(Badge, null, `${t("label.version")}: ${item.version}`) : null,
          item.downloads ? h(Badge, null, `${t("label.downloads")}: ${item.downloads}`) : null,
          cat !== "other" ? h(Badge, null, categoryLabel(cat, lang)) : null,
          item.license ? h(Badge, null, item.license) : null),
        h("div", { className: "sh-muted" },
          item.ownerName || item.owner ? `${t("label.owner")}: ${item.ownerName ?? item.owner}` : "",
          item.url ? h("a", { href: item.url, target: "_blank", rel: "noreferrer", className: "sh-muted", style: { marginLeft: 10 } }, t("action.open")) : null)),
    ),
    item.summary ? h("div", { className: "sh-card-desc", style: { WebkitLineClamp: 5, marginBottom: 10 } }, item.summary) : null,
    h(Field, { label: t("label.installRoot") },
      h("div", { className: "sh-radio-row" },
        h(Button, { variant: root === "user" ? "primary" : "default", onClick: () => setRoot("user") }, t("root.user")),
        h(Button, { variant: root === "project" ? "primary" : "default", onClick: () => setRoot("project") }, t("root.project")))),
    h("div", { className: "sh-muted", style: { marginBottom: 6 } }, t("market.installHint")),
    detail.loading ? h("div", { className: "sh-empty" }, t("loading")) : null,
    detail.error ? h("div", { className: "sh-error" }, detail.error) : null,
    text ? h("div", null,
      h("div", { className: "sh-label" }, t("detail.skillMd")),
      h("div", { className: "sh-preview" }, text)) : null,
    payload?.files?.length ? h("div", { className: "sh-filelist" },
      payload.files.slice(0, 60).map((file) => h("span", { className: "sh-file", key: file.path }, file.path))) : null);
}

/* ------------------------------------------------------------------- root */

export function SkillHubApp({ locale, onBack }) {
  const lang = useLang(locale);
  const t = React.useMemo(() => makeTranslator(lang), [lang]);
  const [sources, setSources] = React.useState([]);
  const [tab, setTab] = React.useState("local");
  const [toastState, setToastState] = React.useState(null);
  const [count, setCount] = React.useState(null);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    api.sources()
      .then((payload) => {
        if (cancelled) return;
        setSources((payload.sources ?? []).filter((source) => source.enabled !== false));
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toast = React.useCallback((message, tone) => {
    setToastState({ message, tone: tone ?? "ok" });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToastState(null), 3200);
  }, []);

  const tabs = [
    { key: "local", label: t("tab.local") },
    { key: "market", label: t("tab.market") },
  ];

  return h("div", { className: "dsh-skill-hub" },
    h("div", { className: "sh-panel" },
      h("div", { className: "sh-panel-header" },
        onBack ? h("button", {
          type: "button",
          className: "sh-back",
          onClick: onBack,
          title: t("action.back"),
        }, h("span", { "aria-hidden": "true" }, "←"), h("span", null, t("action.back"))) : null,
        h("h2", { className: "sh-title" },
          h(Icon, null),
          t("entry.label"),
          count === null ? null : h(Badge, null, t("local.count", { count }))),
        h("div", { className: "sh-tabs", role: "tablist" },
          tabs.map((entry) => h("button", {
            key: entry.key,
            type: "button",
            role: "tab",
            className: "sh-tab",
            "aria-selected": tab === entry.key,
            "data-active": tab === entry.key ? "true" : "false",
            onClick: () => setTab(entry.key),
          }, entry.label)))),
      tab === "local"
        ? h(LocalView, { t, toast, onCount: setCount })
        : h(MarketView, { t, lang, toast, sources })),
    toastState ? h("div", { className: "sh-toast", "data-tone": toastState.tone }, toastState.message) : null);
}

function Icon() {
  return h("svg", {
    width: 18,
    height: 18,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.3,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  },
    h("path", { d: "M8 3.2C6.6 2 4.5 2 3 2v10.5c1.5 0 3.6 0 5 1.3 1.4-1.3 3.5-1.3 5-1.3V2c-1.5 0-3.6 0-5 1.2z" }),
    h("path", { d: "M8 3.2v10.6" }));
}

/** The sidebar row glyph: the shell owns the button, we draw only the icon. */
export function PanelIcon({ size }) {
  return h("svg", {
    "data-dsh-panel-entry": "skill-hub",
    viewBox: "0 0 16 16",
    width: size ?? 16,
    height: size ?? 16,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.3,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  },
    h("path", { d: "M8 3.2C6.6 2 4.5 2 3 2v10.5c1.5 0 3.6 0 5 1.3 1.4-1.3 3.5-1.3 5-1.3V2c-1.5 0-3.6 0-5 1.2z" }),
    h("path", { d: "M8 3.2v10.6" }));
}
