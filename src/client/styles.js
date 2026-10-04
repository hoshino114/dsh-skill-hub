/**
 * One stylesheet for the Skill Hub panel, injected once per document. Colours
 * come from the harness theme tokens (`--dsw-alias-*`) so light and dark both
 * follow the running theme; every rule is scoped under `.dsh-skill-hub`.
 *
 * The root is a plain flex column sized `height:100%` of the `main` slot host —
 * never `position:absolute; inset:0`, which escapes the slot and paints over
 * the shell's own top bar and sidebar.
 */

export const STYLE_ID = "dsh-skill-hub-style";

export const CSS = `
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

/* segmented control, right-aligned like the console's 应用/插件/技能 */
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

/** Inject the stylesheet once per document. */
export function injectStyles(doc = document) {
  if (doc.getElementById(STYLE_ID) !== null) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
