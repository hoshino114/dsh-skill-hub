/**
 * Skill Hub API client (browser half). Same-origin fetch against the host
 * route family; paths are document-relative on purpose (the harness serves the
 * GUI with `<base href="./">`, so a root-absolute `/api/...` would escape a
 * sub-path deployment).
 */

export const API = {
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
  install: "api/dsh-skill-hub/market/install",
};

class ApiError extends Error {}

async function request(path, options = {}) {
  const init = { method: options.method ?? "GET", headers: {} };
  if (options.body !== undefined) {
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
  if (!response.ok || (payload && payload.ok === false)) {
    throw new ApiError(payload?.error ?? `${response.status} ${response.statusText}`);
  }
  return payload;
}

const qs = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text === "" ? "" : `?${text}`;
};

export const api = {
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
      } catch { /* keep the status text */ }
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
  },
};

export { ApiError };
