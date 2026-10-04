/**
 * Tiny HTTP client shared by the marketplace adapters (Node 20+ global fetch).
 */

/** Default request timeout for marketplace calls. */
export const DEFAULT_TIMEOUT_MS = 20000;

/** Errors carrying an HTTP status so routes can answer 502/404 correctly. */
export class HttpError extends Error {
  constructor(message, status, url) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

const USER_AGENT = "dsh-skill-hub/1.0 (+https://deepseek.com)";

/**
 * Fetch a URL with timeout and JSON decoding.
 * @param {string} url request URL
 * @param {{ timeoutMs?: number, headers?: Record<string,string>, signal?: AbortSignal }} options request options
 * @returns {Promise<any>} parsed JSON body
 */
export async function fetchJson(url, options = {}) {
  const response = await request(url, options);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(`response is not JSON (${url})`, 502, url);
  }
}

/**
 * Fetch a URL with timeout, returning raw bytes.
 * @param {string} url request URL
 * @param {{ timeoutMs?: number, headers?: Record<string,string>, signal?: AbortSignal }} options request options
 * @returns {Promise<Uint8Array>} response body bytes
 */
export async function fetchBytes(url, options = {}) {
  const response = await request(url, options);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Fetch a URL as text.
 * @param {string} url request URL
 * @param {object} options request options
 * @returns {Promise<string>} response body text
 */
export async function fetchText(url, options = {}) {
  const response = await request(url, options);
  return response.text();
}

async function request(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  if (options.signal) {
    if (options.signal.aborted) controller.abort(options.signal.reason);
    else options.signal.addEventListener("abort", () => controller.abort(options.signal.reason), { once: true });
  }
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json, text/plain, */*", "user-agent": USER_AGENT, ...(options.headers ?? {}) },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).slice(0, 300);
      } catch { /* ignore */ }
      throw new HttpError(`${response.status} ${response.statusText} for ${url}${detail ? `: ${detail}` : ""}`, response.status, url);
    }
    return response;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(`request failed for ${url}: ${error instanceof Error ? error.message : String(error)}`, 0, url);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build a query string, skipping empty values.
 * @param {Record<string, string | number | undefined | null>} params query parameters
 * @returns {string} `?a=1&b=2` or an empty string
 */
export function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text === "" ? "" : `?${text}`;
}

/** Encode a slash-separated identifier as a URL path (keeps literal `@`). */
export function encodePathId(id) {
  return String(id)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
    .replace(/%40/gu, "@");
}
