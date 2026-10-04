/**
 * Host route plumbing shared by every `/api/dsh-skill-hub/*` handler:
 * method guarding, bounded JSON bodies, JSON responses and the loopback trust
 * fence (the write routes touch real skill files on disk).
 */

/** Family-default JSON response headers. */
export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

/** Write a JSON response (never throws: a failed header write still ends the body). */
export function writeJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body ?? null);
  try {
    res.writeHead(status, { ...JSON_HEADERS, ...headers });
    res.end(payload);
  } catch {
    try {
      res.end(payload);
    } catch { /* the connection is already gone */ }
  }
}

/** Write a binary response (zip export). */
export function writeBytes(res, status, bytes, contentType, filename) {
  try {
    res.writeHead(status, {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
    });
    res.end(Buffer.from(bytes));
  } catch {
    try {
      res.end();
    } catch { /* the connection is already gone */ }
  }
}

/** Parse a bounded JSON body; null when empty/invalid/oversized. */
export async function readJsonBody(req, { maxBytes = 8 * 1024 * 1024, objectOnly = true } = {}) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk;
    size += buffer.length;
    if (size > maxBytes) {
      req.destroy();
      return null;
    }
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (text === "") return null;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (objectOnly && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))) return null;
  return parsed;
}

/** First query-parameter value. */
export function queryParam(url, name) {
  const value = url.searchParams.get(name);
  return value === null ? undefined : value;
}

/**
 * The trust fence: Host-header loopback (or a configured trusted authority)
 * plus same-origin browser markers, mirroring the /api gateway's own fence
 * (see dsh-better-sidebar's trust-fence.ts, BSD-3-Clause). This is a
 * DNS-rebinding / cross-site defense, not authentication; a live paired-device
 * cookie (`remoteWebUiPairing`) is an extra allow path for remote web UIs.
 *
 * Only `req.headers` is read: the request object the harness hands to route
 * handlers is a structural subset of IncomingMessage, and reaching for
 * `req.socket` is not part of that contract.
 */
function header(req, name) {
  const value = req?.headers?.[name];
  return typeof value === "string" ? value : undefined;
}

function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`);
  } catch {
    return undefined;
  }
}

function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return parts.length === 4
    && parts[0] === "127"
    && parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) <= 255);
}

function canonicalAuthority(entry, entryUrl) {
  const port = entryUrl.port !== "" ? entryUrl.port : parseAuthority(entry)?.port ?? "";
  return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}

function isTrustedAuthority(hostUrl, trustedHosts) {
  return (trustedHosts ?? []).some((entry) => {
    if (typeof entry !== "string") return false;
    const entryUrl = parseAuthority(entry);
    if (entryUrl === undefined) return false;
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host;
  });
}

/** Non-loopback authorities this deployment serves (bind-derived + --trusted-host). */
function trustedHosts(ctx) {
  try {
    const runtime = typeof ctx?.get === "function" ? ctx.get("webRuntime", false) : ctx?.webRuntime;
    return runtime?.trustedHosts ?? [];
  } catch {
    return [];
  }
}

/** Paired-device cookie check for remote web UIs (absent on plain loopback). */
function isPairedDevice(ctx, req) {
  try {
    const pairing = typeof ctx?.get === "function" ? ctx.get("remoteWebUiPairing", false) : ctx?.remoteWebUiPairing;
    return typeof pairing?.isPairedDevice === "function" && pairing.isPairedDevice(req) === true;
  } catch {
    return false;
  }
}

/** Last internal error the trust fence swallowed (surfaced on refused requests). */
let lastFenceError = undefined;

/** Diagnostic detail for a refused request, when the fence itself failed. */
export function fenceDiagnostics() {
  return lastFenceError;
}

/**
 * Whether this request may reach the plugin's routes.
 * @param {object} ctx host context (optional webRuntime / remoteWebUiPairing)
 * @param {object} req incoming request (headers only)
 * @returns {boolean} true when the authority is ours and markers are same-origin
 */
export function isAllowed(ctx, req) {
  try {
    const host = header(req, "host");
    if (host === undefined) return isPairedDevice(ctx, req);
    const hostUrl = parseAuthority(host);
    if (hostUrl === undefined) return false;
    if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts(ctx))) {
      return isPairedDevice(ctx, req);
    }
    if (header(req, "sec-fetch-site") === "cross-site") return false;
    const origin = header(req, "origin");
    if (origin === undefined) return true;
    try {
      return new URL(origin).hostname === hostUrl.hostname;
    } catch {
      return false;
    }
  } catch (error) {
    lastFenceError = String(error?.stack ?? error);
    return false;
  }
}

/** Guard helper: trust fence + method check. */
export function guard(ctx, req, res, method) {
  if (!isAllowed(ctx, req)) {
    writeJson(res, 403, { error: "forbidden: loopback-only", detail: fenceDiagnostics() });
    return false;
  }
  if (req.method !== method && !(method === "GET" && req.method === "HEAD")) {
    writeJson(res, 405, { error: `method not allowed: ${req.method}` });
    return false;
  }
  return true;
}

/** Uniform error → status mapping for route handlers. */
export function errorStatus(error) {
  const code = Number(error?.code);
  if (Number.isFinite(code) && code >= 400 && code < 600) return code;
  return 500;
}
