// lib/config.js
import Schema from "@deepseek-ai/schemastery";
var SOURCE_CHOICES = ["clawhub", "modelscope", "qwenpaw"];
var configFields = () => ({
  enabled: Schema.boolean().default(true).description("Enable the Skill Hub routes and tools. \u5173\u95ED\u540E\u63D2\u4EF6\u5B8C\u5168\u4E0D\u6302\u8F7D\u3002"),
  installRoot: Schema.union(["user", "project"]).default("user").description("Default install target: `user` (~/.dsh/skills, global) or `project` (workspace .dsh/skills). \u9ED8\u8BA4\u5B89\u88C5\u4F4D\u7F6E\u3002"),
  defaultSource: Schema.union(SOURCE_CHOICES).default("clawhub").description("Marketplace selected by default in the panel and by the tools. \u9ED8\u8BA4\u6280\u80FD\u5E02\u573A\u3002"),
  disabledSources: Schema.array(Schema.union(SOURCE_CHOICES)).default([]).description("Marketplaces to hide. \u9690\u85CF\u7684\u6280\u80FD\u5E02\u573A\u3002"),
  customSkillDirs: Schema.array(Schema.string()).default([]).description("Extra skill roots to list/manage alongside the standard ones. \u989D\u5916\u7684\u672C\u5730\u6280\u80FD\u76EE\u5F55\u3002"),
  dshHome: Schema.string().description("Override the dsh home directory (default: $DSH_HOME or ~/.dsh)."),
  agentsHome: Schema.string().description("Override the shared ~/.agents directory (default: $DSH_AGENTS_HOME or ~/.agents)."),
  requestTimeoutMs: Schema.number().default(2e4).min(3e3).max(12e4).description("HTTP timeout for marketplace calls in milliseconds. \u5E02\u573A\u8BF7\u6C42\u8D85\u65F6\u3002"),
  enableTools: Schema.boolean().default(true).description("Expose the `skill_hub` tool to the model. \u662F\u5426\u7ED9\u6A21\u578B\u66B4\u9732 skill_hub \u5DE5\u5177\u3002")
});
var Config = Schema.object((() => {
  const marked = {};
  for (const [key, schema] of Object.entries(configFields())) marked[key] = schema.volatile();
  return marked;
})());
function readLive(value) {
  return value !== null && typeof value === "object" && typeof value.get === "function" ? value.get() : value;
}
function liveConfig(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw ?? {})) out[key] = readLive(value);
  return out;
}

// lib/core/local.js
import { homedir } from "node:os";
import { join, dirname, basename, sep } from "node:path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  statSync
} from "node:fs";
import { randomBytes } from "node:crypto";
import {
  readdir,
  stat,
  mkdir,
  writeFile,
  rename,
  rm,
  copyFile,
  readFile
} from "node:fs/promises";

// lib/core/frontmatter.js
var FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
function unquote(raw) {
  const text = raw.trim();
  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(1, -1);
    }
  }
  return text;
}
function quoteScalar(value) {
  const text = String(value ?? "").replace(/[\r\n]+/gu, " ").trim();
  return `'${text.replace(/'/g, "''")}'`;
}
function parseFrontmatter(content) {
  const text = String(content ?? "");
  const match = FRONTMATTER_RE.exec(text);
  const raw = /* @__PURE__ */ Object.create(null);
  const fields = /* @__PURE__ */ Object.create(null);
  if (match === null) {
    return { raw, fields, body: text, hasFrontmatter: false };
  }
  const lines = match[1].split(/\r?\n/);
  for (let i2 = 0; i2 < lines.length; i2 += 1) {
    const line = lines[i2];
    const pair = /^([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(line);
    if (pair === null) continue;
    const key = pair[1];
    let value = pair[2];
    const block = /^[|>][+-]?$/.test(value.trim());
    while (block && i2 + 1 < lines.length && /^\s+/.test(lines[i2 + 1])) {
      i2 += 1;
      value += `
${lines[i2]}`;
    }
    raw[key] = value;
    if (!block) fields[key] = unquote(value);
  }
  return { raw, fields, body: match[2].replace(/^\r?\n/u, ""), hasFrontmatter: true };
}
function rewriteFrontmatter(content, updates) {
  const text = String(content ?? "");
  const match = FRONTMATTER_RE.exec(text);
  const body = match === null ? text : match[2];
  const lines = match === null ? [] : match[1].split(/\r?\n/);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (let i2 = 0; i2 < lines.length; i2 += 1) {
    const line = lines[i2];
    const pair = /^([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(line);
    if (pair === null) {
      out.push(line);
      continue;
    }
    const key = pair[1];
    let value = pair[2];
    const block2 = /^[|>][+-]?$/.test(value.trim());
    const consumed = [line];
    while (block2 && i2 + 1 < lines.length && /^\s+/.test(lines[i2 + 1])) {
      i2 += 1;
      consumed.push(lines[i2]);
    }
    if (!Object.prototype.hasOwnProperty.call(updates, key) || updates[key] === void 0) {
      out.push(...consumed);
      continue;
    }
    seen.add(key);
    if (updates[key] !== null) out.push(`${key}: ${formatValue(updates[key])}`);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === void 0 || value === null || seen.has(key)) continue;
    out.push(`${key}: ${formatValue(value)}`);
  }
  const block = out.length > 0 ? `---
${out.join("\n")}
---` : "";
  const rest = body.startsWith("\n") ? body : `
${body}`;
  return `${block}${rest}`;
}
function formatValue(value) {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return quoteScalar(String(value));
}

// node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs
import { createRequire } from "module";
var require2 = createRequire("/");
var _a;
var Worker;
var isMarkedAsUntransferable;
try {
  _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
} catch (e) {
}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i2 = 1; i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0; i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0; i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b = fleb[i2];
          add = bits(dat, pos, (1 << b) - 1) + fl[i2];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i2 = 0; i2 < d.length; ++i2) {
    if (d[i2])
      t.push({ s: i2, f: d[i2] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i22 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i22].f ? i0++ : i22++];
    r = t[i0 != i1 && t[i0].f < t[i22].f ? i0++ : i22++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i2 = 1; i2 < s; ++i2) {
    if (t2[i2].s > maxSym)
      maxSym = t2[i2].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i2 = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (; i2 < s; ++i2) {
      var i2_1 = t2[i2].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i2].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i2;
    }
    for (; i2 >= 0 && dt; --i2) {
      var i2_3 = t2[i2].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln = function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i2 = 1; i2 <= s; ++i2) {
    if (c[i2] == cln && i2 != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (; cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (; cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i2];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i2 = 0; i2 < cl.length; ++i2)
    l += cf[i2] * cl[i2];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i2 = 0; i2 < s; ++i2)
    out[o + i2 + 4] = dat[i2];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i2 = 0; i2 < lclt.length; ++i2)
    ++lcfreq[lclt[i2] & 31];
  for (var i2 = 0; i2 < lcdt.length; ++i2)
    ++lcfreq[lcdt[i2] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i2 = 0; i2 < nlcc; ++i2)
      wbits(out, p + 3 * i2, lct[clim[i2]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i2 = 0; i2 < clct.length; ++i2) {
        var len = clct[i2] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i2] >> 5 & 127), p += clct[i2] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i2 = 0; i2 < li; ++i2) {
    var sym = syms[i2];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i3) {
      return (dat[i3] ^ dat[i3 + 1] << bs1_1 ^ dat[i3 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25e3);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i2 = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (; i2 + 2 < s; ++i2) {
      var hv = hsh(i2);
      var imod = i2 & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i2) {
        var rem = s - i2;
        if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i2 - bs, pos);
          li = lc_1 = eb = 0, bs = i2;
          for (var j = 0; j < 286; ++j)
            lf[j] = 0;
          for (var j = 0; j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i2 - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i2);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i2 + l] == dat[i2 + l - dif]) {
              var nl = 0;
              for (; nl < ml && dat[i2 + nl] == dat[i2 + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0; j < mmd; ++j) {
                  var ti = i2 - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i2 + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i2];
          ++lf[dat[i2]];
        }
      }
    }
    for (i2 = Math.max(i2, wi); i2 < s; ++i2) {
      syms[li++] = dat[i2];
      ++lf[dat[i2]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i2 - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i2, st.w = wi;
    }
  } else {
    for (var i2 = st.w || 0; i2 < s + lst; i2 += 65535) {
      var e = i2 + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i2, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
};
var crct = /* @__PURE__ */ (function() {
  var t = new Int32Array(256);
  for (var i2 = 0; i2 < 256; ++i2) {
    var c = i2, k = 9;
    while (--k)
      c = (c & 1 && -306674912) ^ c >>> 1;
    t[i2] = c;
  }
  return t;
})();
var crc = function() {
  var c = -1;
  return {
    p: function(d) {
      var cr = c;
      for (var i2 = 0; i2 < d.length; ++i2)
        cr = crct[cr & 255 ^ d[i2]] ^ cr >>> 8;
      c = cr;
    },
    d: function() {
      return ~c;
    }
  };
};
var dopt = function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
};
var mrg = function(a, b) {
  var o = {};
  for (var k in a)
    o[k] = a[k];
  for (var k in b)
    o[k] = b[k];
  return o;
};
var b2 = function(d, b) {
  return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
};
var wbytes = function(d, b, v) {
  for (; v; ++b)
    d[b] = v, v >>>= 8;
};
function deflateSync(data, opts) {
  return dopt(data, opts || {}, 0, 0);
}
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var fltn = function(d, p, t, o) {
  for (var k in d) {
    var val = d[k], n = p + k, op = o;
    if (Array.isArray(val))
      op = mrg(o, val[1]), val = val[0];
    if (ArrayBuffer.isView(val))
      t[n] = [val, op];
    else {
      t[n += "/"] = [new u8(0), op];
      fltn(val, n, t, o);
    }
  }
};
var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
var dutf8 = function(d) {
  for (var r = "", i2 = 0; ; ) {
    var c = d[i2++];
    var eb = (c > 127) + (c > 223) + (c > 239);
    if (i2 + eb > d.length)
      return { s: r, r: slc(d, i2 - 1) };
    if (!eb)
      r += String.fromCharCode(c);
    else if (eb == 3) {
      c = ((c & 15) << 18 | (d[i2++] & 63) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c & 31) << 6 | d[i2++] & 63);
    else
      r += String.fromCharCode((c & 15) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63);
  }
};
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i2 = 0; i2 < str.length; ++i2)
      ar_1[i2] = str.charCodeAt(i2);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = function(v) {
    ar[ai++] = v;
  };
  for (var i2 = 0; i2 < l; ++i2) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i2 << 1));
      n.set(ar);
      ar = n;
    }
    var c = str.charCodeAt(i2);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
    else
      w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
  }
  return slc(ar, 0, ai);
}
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i2 = 0; i2 < dat.length; i2 += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i2, i2 + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
var slzh = function(d, b) {
  return b + 30 + b2(d, b + 26) + b2(d, b + 28);
};
var zh = function(d, b, z) {
  var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
  var _a2 = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a2[0], su = _a2[1], off = _a2[2];
  return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
};
var z64hs = function(d, b, l, z, sc, su, off) {
  var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
  var nf = nsc + nsu + noff;
  if (z && nf) {
    for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
      if (b2(d, b) == 1) {
        return [
          nsc ? b8(d, b + 4 + 8 * nsu) : sc,
          nsu ? b8(d, b + 4) : su,
          noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
          1
        ];
      }
    }
    if (z < 2)
      err(13);
  }
  return [sc, su, off, 0];
};
var exfl = function(ex) {
  var le = 0;
  if (ex) {
    for (var k in ex) {
      var l = ex[k].length;
      if (l > 65535)
        err(9);
      le += l + 4;
    }
  }
  return le;
};
var wzh = function(d, b, f, fn, u, c, ce, co) {
  var fl2 = fn.length, ex = f.extra, col = co && co.length;
  var exl = exfl(ex);
  wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
  if (ce != null)
    d[b++] = 20, d[b++] = f.os;
  d[b] = 20, b += 2;
  d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
  d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
  var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
  if (y < 0 || y > 119)
    err(10);
  wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
  if (c != -1) {
    wbytes(d, b, f.crc);
    wbytes(d, b + 4, c < 0 ? -c - 2 : c);
    wbytes(d, b + 8, f.size);
  }
  wbytes(d, b + 12, fl2);
  wbytes(d, b + 14, exl), b += 16;
  if (ce != null) {
    wbytes(d, b, col);
    wbytes(d, b + 6, f.attrs);
    wbytes(d, b + 10, ce), b += 14;
  }
  d.set(fn, b);
  b += fl2;
  if (exl) {
    for (var k in ex) {
      var exf = ex[k], l = exf.length;
      wbytes(d, b, +k);
      wbytes(d, b + 2, l);
      d.set(exf, b + 4), b += 4 + l;
    }
  }
  if (col)
    d.set(co, b), b += col;
  return b;
};
var wzf = function(o, b, c, d, e) {
  wbytes(o, b, 101010256);
  wbytes(o, b + 8, c);
  wbytes(o, b + 10, c);
  wbytes(o, b + 12, d);
  wbytes(o, b + 16, e);
};
function zipSync(data, opts) {
  if (!opts)
    opts = {};
  var r = {};
  var files = [];
  fltn(data, "", r, opts);
  var o = 0;
  var tot = 0;
  for (var fn in r) {
    var _a2 = r[fn], file = _a2[0], p = _a2[1];
    var compression = p.level == 0 ? 0 : 8;
    var f = strToU8(fn), s = f.length;
    var com = p.comment, m = com && strToU8(com), ms = m && m.length;
    var exl = exfl(p.extra);
    if (s > 65535)
      err(11);
    var d = compression ? deflateSync(file, p) : file, l = d.length;
    var c = crc();
    c.p(file);
    files.push(mrg(p, {
      size: file.length,
      crc: c.d(),
      c: d,
      f,
      m,
      u: s != fn.length || m && com.length != ms,
      o,
      compression
    }));
    o += 30 + s + exl + l;
    tot += 76 + 2 * (s + exl) + (ms || 0) + l;
  }
  var out = new u8(tot + 22), oe = o, cdl = tot - o;
  for (var i2 = 0; i2 < files.length; ++i2) {
    var f = files[i2];
    wzh(out, f.o, f, f.f, f.u, f.c.length);
    var badd = 30 + f.f.length + exfl(f.extra);
    out.set(f.c, f.o + badd);
    wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
  }
  wzf(out, o, files.length, cdl, oe);
  return out;
}
function unzipSync(data, opts) {
  var files = {};
  var e = data.length - 22;
  for (; b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558)
      err(13);
  }
  ;
  var c = b2(data, e + 8);
  if (!c)
    return {};
  var o = b4(data, e + 16);
  var z = b4(data, e - 20) == 117853008;
  if (z) {
    var ze = b4(data, e - 12);
    z = b4(data, ze) == 101075792;
    if (z) {
      c = b4(data, ze + 32);
      o = b4(data, ze + 48);
    }
  }
  var fltr = opts && opts.filter;
  for (var i2 = 0; i2 < c; ++i2) {
    var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
    o = no;
    if (!fltr || fltr({
      name: fn,
      size: sc,
      originalSize: su,
      compression: c_2
    })) {
      if (!c_2)
        files[fn] = slc(data, b, b + sc);
      else if (c_2 == 8)
        files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
      else
        err(14, "unknown compression type " + c_2);
    }
  }
  return files;
}

// lib/core/zip.js
var ARCHIVE_LIMITS = {
  maxEntries: 800,
  maxTotalBytes: 64 * 1024 * 1024,
  maxEntryBytes: 16 * 1024 * 1024
};
function safeEntryPath(name2) {
  if (typeof name2 !== "string" || name2.trim() === "") return null;
  let path = name2.replace(/\\/gu, "/").replace(/^\.\//u, "");
  if (path.startsWith("/")) return null;
  if (/^[A-Za-z]:/u.test(path)) return null;
  const segments = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") return null;
    segments.push(segment);
  }
  if (segments.length === 0) return null;
  return segments.join("/");
}
function readZipEntries(bytes) {
  const files = unzipSync(bytes, { filter: () => true });
  const entries = [];
  let total = 0;
  for (const [rawName, data] of Object.entries(files)) {
    if (rawName.endsWith("/")) continue;
    const path = safeEntryPath(rawName);
    if (path === null) continue;
    total += data.length;
    if (data.length > ARCHIVE_LIMITS.maxEntryBytes) {
      throw new Error(`archive entry too large: ${path}`);
    }
    entries.push({ path, data });
    if (entries.length > ARCHIVE_LIMITS.maxEntries) {
      throw new Error(`archive has more than ${ARCHIVE_LIMITS.maxEntries} files`);
    }
    if (total > ARCHIVE_LIMITS.maxTotalBytes) {
      throw new Error(`archive is larger than ${ARCHIVE_LIMITS.maxTotalBytes} bytes`);
    }
  }
  return entries;
}
function stripCommonRoot(entries) {
  if (entries.length === 0) return entries;
  const roots = new Set(entries.map((entry) => entry.path.split("/")[0]));
  if (roots.size !== 1) return entries;
  const root = [...roots][0];
  const nested = entries.filter((entry) => entry.path.includes("/"));
  if (nested.length === 0) return entries;
  return entries.map((entry) => ({ path: entry.path.slice(root.length + 1), data: entry.data }));
}
function rebaseToSkillRoot(entries) {
  const stripped = stripCommonRoot(entries);
  const withSkill = stripped.filter((entry) => /(^|\/)SKILL\.md$/iu.test(entry.path));
  if (withSkill.length === 0) return stripped;
  const target = withSkill.slice().sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0];
  const dir = target.path.includes("/") ? target.path.slice(0, target.path.lastIndexOf("/")) : "";
  if (dir === "") return stripped;
  const prefix = `${dir}/`;
  return stripped.filter((entry) => entry.path.startsWith(prefix) || entry.path === dir).map((entry) => ({ path: entry.path.slice(prefix.length), data: entry.data }));
}
function buildZip(entries) {
  const files = /* @__PURE__ */ Object.create(null);
  for (const entry of entries) {
    const path = safeEntryPath(entry.path);
    if (path === null) continue;
    files[path] = typeof entry.data === "string" ? strToU8(entry.data) : entry.data;
  }
  return zipSync(files, { level: 6 });
}
var toText = (data) => strFromU8(data);

// lib/core/local.js
var SOURCE_GROUPS = [
  { key: "user", title: "User skills (~/.dsh/skills)", titleZh: "\u7528\u6237\u6280\u80FD\uFF08~/.dsh/skills\uFF09", hint: "Global skills shared by every project on this machine" },
  { key: "project", title: "Project skills", titleZh: "\u9879\u76EE\u6280\u80FD", hint: "Inside the current workspace (.dsh/skills or .agents/skills)" },
  { key: "custom", title: "Custom directories", titleZh: "\u81EA\u5B9A\u4E49\u76EE\u5F55", hint: "Extra roots from the plugin's customSkillDirs config" },
  { key: "agents", title: "Agent skills (~/.agents/skills)", titleZh: "Agent \u6280\u80FD\uFF08~/.agents/skills\uFF09", hint: "Shared with other agent harnesses" },
  { key: "other", title: "Other", titleZh: "\u5176\u4ED6", hint: "Bundled / runtime-registered skills" }
];
var LEVEL_GROUP = /* @__PURE__ */ new Map([
  ["user-dsh", "user"],
  ["user-agents", "agents"],
  ["project-dsh", "project"],
  ["project-agents", "project"],
  ["custom", "custom"]
]);
var LEVEL_RANK = /* @__PURE__ */ new Map([
  ["project-dsh", 0],
  ["project-agents", 1],
  ["custom", 2],
  ["user-dsh", 3],
  ["user-agents", 4]
]);
var NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
function dshHomeDir(env = process.env) {
  return env.DSH_HOME?.trim() || join(homedir(), ".dsh");
}
function agentsHomeDir(env = process.env) {
  return env.DSH_AGENTS_HOME?.trim() || join(homedir(), ".agents");
}
function findProjectRoot(cwd) {
  let current = cwd;
  for (; ; ) {
    if (existsSync(join(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return cwd;
    current = parent;
  }
}
function skillRoots(options = {}) {
  const dshHome = options.dshHome ?? dshHomeDir();
  const agentsHome = options.agentsHome ?? agentsHomeDir();
  const cwd = options.cwd ?? process.cwd();
  const roots = [];
  const projectRoots = [.../* @__PURE__ */ new Set([findProjectRoot(cwd), ...options.projectRoots ?? []])];
  for (const root of projectRoots) {
    roots.push({ level: "project-dsh", dir: join(root, ".dsh", "skills"), projectRoot: root });
    roots.push({ level: "project-agents", dir: join(root, ".agents", "skills"), projectRoot: root });
  }
  for (const dir of options.customSkillDirs ?? []) roots.push({ level: "custom", dir });
  roots.push({ level: "user-dsh", dir: join(dshHome, "skills"), userRoot: true });
  roots.push({ level: "user-agents", dir: join(agentsHome, "skills") });
  return roots;
}
function userSkillRoot(dshHome = dshHomeDir()) {
  return join(dshHome, "skills");
}
function projectSkillRoot(cwd) {
  return join(findProjectRoot(cwd), ".dsh", "skills");
}
function makeSkill(file, dir, level, parsed) {
  const fields = parsed.fields;
  let size = 0;
  let updatedAt = 0;
  try {
    const info = statSync(file);
    size = info.size;
    updatedAt = info.mtimeMs;
  } catch {
  }
  const modelInvocable = fields["disable-model-invocation"] !== "true";
  return {
    name: fields.name ?? basename(file, ".md"),
    description: fields.description ?? "(no description)",
    whenToUse: fields.whenToUse,
    version: fields.version,
    level,
    group: LEVEL_GROUP.get(level) ?? "other",
    path: file,
    dir,
    linked: false,
    enabled: modelInvocable,
    modelInvocable,
    userInvocable: fields["user-invocable"] !== "false",
    bytes: size,
    updatedAt
  };
}
async function scanRoot(root, level, into) {
  if (!existsSync(root)) return;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    let file = null;
    let dir = null;
    let linked = false;
    if (entry.isDirectory()) {
      dir = join(root, entry.name);
      file = join(dir, "SKILL.md");
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      file = join(root, entry.name);
      dir = root;
    } else if (entry.isSymbolicLink()) {
      linked = true;
      try {
        const target = await stat(join(root, entry.name));
        if (target.isDirectory()) {
          dir = join(root, entry.name);
          file = join(dir, "SKILL.md");
        } else if (target.isFile() && entry.name.toLowerCase().endsWith(".md")) {
          file = join(root, entry.name);
          dir = root;
        } else {
          continue;
        }
      } catch {
        continue;
      }
    } else {
      continue;
    }
    if (!existsSync(file)) continue;
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const skill = makeSkill(file, dir, level, parseFrontmatter(content));
    skill.linked = linked;
    if (!NAME_PATTERN.test(skill.name)) continue;
    const existing = into.get(skill.name);
    if (existing !== void 0 && (LEVEL_RANK.get(existing.level) ?? 99) <= (LEVEL_RANK.get(level) ?? 99)) continue;
    into.set(skill.name, skill);
  }
}
async function scanSkills(options = {}) {
  const roots = skillRoots(options);
  const byName = /* @__PURE__ */ new Map();
  await Promise.all(roots.map((root) => scanRoot(root.dir, root.level, byName)));
  const skills = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  const grouped = /* @__PURE__ */ new Map();
  for (const skill of skills) {
    const list = grouped.get(skill.group) ?? [];
    list.push(skill);
    grouped.set(skill.group, list);
  }
  const groups = SOURCE_GROUPS.filter((group) => (grouped.get(group.key) ?? []).length > 0).map((group) => ({ ...group, skills: grouped.get(group.key) }));
  return {
    skills,
    groups,
    roots: roots.map((root) => ({ level: root.level, dir: root.dir, exists: existsSync(root.dir) }))
  };
}
function readSkill(file) {
  const content = readFileSync(file, "utf8");
  const parsed = parseFrontmatter(content);
  return {
    path: file,
    name: parsed.fields.name ?? basename(file, ".md"),
    description: parsed.fields.description ?? "",
    whenToUse: parsed.fields.whenToUse,
    version: parsed.fields.version,
    frontmatter: parsed.raw,
    content: parsed.body.trim(),
    raw: content
  };
}
function rawScalar(value) {
  const text = String(value ?? "").trim();
  return /^['"]|^[[{]/.test(text) ? text : quoteScalar(text);
}
function buildSkillContent({ name: name2, description, whenToUse, content, extra, disabled }) {
  const lines = ["---", `name: ${quoteScalar(name2)}`, `description: ${quoteScalar(description)}`];
  if (whenToUse !== void 0 && String(whenToUse).trim() !== "") {
    lines.push(`whenToUse: ${quoteScalar(whenToUse)}`);
  }
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value === void 0 || value === null || String(value).trim() === "") continue;
    lines.push(`${key}: ${rawScalar(value)}`);
  }
  if (disabled === true) lines.push("disable-model-invocation: true");
  lines.push("---", "", String(content ?? "").trim(), "");
  return lines.join("\n");
}
function atomicWrite(file, text) {
  const tmp = `${file}.${Date.now().toString(36)}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    writeFileSync(tmp, text, { encoding: "utf8", flag: "wx" });
    renameSync(tmp, file);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
    }
    throw error;
  }
}
async function createSkill(baseDir, { name: name2, description, whenToUse, content, extra }) {
  const skillName = String(name2 ?? "").trim();
  if (!NAME_PATTERN.test(skillName)) {
    throw Object.assign(new Error("skill name must use letters, digits, dot, dash or underscore"), { code: 400 });
  }
  const dir = join(baseDir, skillName);
  const target = join(dir, "SKILL.md");
  if (existsSync(target)) {
    throw Object.assign(new Error(`skill ${skillName} already exists at ${target}`), { code: 409 });
  }
  await mkdir(dir, { recursive: true });
  await writeFile(target, buildSkillContent({ name: skillName, description, whenToUse, content, extra }), "utf8");
  return target;
}
var KNOWN_KEYS = /* @__PURE__ */ new Set(["name", "description", "whenToUse", "disable-model-invocation"]);
async function updateSkill(file, { name: name2, description, whenToUse, content, extra }) {
  const current = readSkill(file);
  const mergedExtra = { ...extra ?? {} };
  for (const [key, value] of Object.entries(current.frontmatter)) {
    if (KNOWN_KEYS.has(key) || key in mergedExtra) continue;
    mergedExtra[key] = String(value).trim();
  }
  const disabled = current.frontmatter["disable-model-invocation"] === "true";
  atomicWrite(file, buildSkillContent({
    name: name2 ?? current.name,
    description: description ?? current.description,
    whenToUse: whenToUse ?? current.whenToUse,
    content: content ?? current.content,
    extra: mergedExtra,
    disabled
  }));
  return file;
}
async function setSkillEnabled(file, enabled) {
  atomicWrite(file, rewriteFrontmatter(readFileSync(file, "utf8"), {
    "disable-model-invocation": enabled ? null : true
  }));
  return enabled;
}
async function trashSkill(file) {
  const trashDir = join(dirname(file), ".trash");
  await mkdir(trashDir, { recursive: true });
  const target = join(trashDir, `${Date.now()}-${basename(file)}`);
  await rename(file, target);
  return target;
}
async function exportSkillZip(file) {
  const skill = readSkill(file);
  const dir = dirname(file);
  const entries = [];
  if (basename(file) === "SKILL.md") {
    const stack = [dir];
    while (stack.length > 0 && entries.length < 800) {
      const current = stack.pop();
      const items = await readdir(current, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith(".") || item.name === "node_modules") continue;
        const full = join(current, item.name);
        if (item.isDirectory()) {
          stack.push(full);
        } else if (item.isFile()) {
          const rel = full.slice(dir.length + 1).split(sep).join("/");
          entries.push({ path: rel, data: await readFile(full) });
        }
      }
    }
  } else {
    entries.push({ path: `${skill.name}.md`, data: await readFile(file) });
  }
  return { name: skill.name, bytes: buildZip(entries) };
}
async function installSkillArchive(bytes, baseDir, options = {}) {
  const entries = rebaseToSkillRoot(readZipEntries(bytes));
  const skillFile = entries.find((entry) => entry.path.toLowerCase() === "skill.md");
  if (skillFile === void 0) {
    throw Object.assign(new Error("archive has no SKILL.md at its skill root"), { code: 400 });
  }
  const parsed = parseFrontmatter(toText(skillFile.data));
  const name2 = String(options.name ?? parsed.fields.name ?? "imported-skill").trim();
  if (!NAME_PATTERN.test(name2)) {
    throw Object.assign(new Error(`invalid skill name ${JSON.stringify(name2)}`), { code: 400 });
  }
  const dir = join(baseDir, name2);
  const target = join(dir, "SKILL.md");
  if (existsSync(target) && options.overwrite !== true) {
    throw Object.assign(new Error(`skill ${name2} already exists at ${target}`), { code: 409 });
  }
  await mkdir(dir, { recursive: true });
  const files = [];
  for (const entry of entries) {
    const dest = join(dir, ...entry.path.split("/"));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, entry.data);
    files.push(entry.path);
  }
  if (parsed.fields.name !== name2) {
    atomicWrite(target, rewriteFrontmatter(readFileSync(target, "utf8"), { name: name2 }));
  }
  return { name: name2, path: target, files };
}

// lib/core/http.js
var DEFAULT_TIMEOUT_MS = 2e4;
var HttpError = class extends Error {
  constructor(message, status, url) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
};
var USER_AGENT = "dsh-skill-hub/1.0 (+https://deepseek.com)";
async function fetchJson(url, options = {}) {
  const response = await request(url, options);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(`response is not JSON (${url})`, 502, url);
  }
}
async function fetchBytes(url, options = {}) {
  const response = await request(url, options);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
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
      headers: { accept: "application/json, text/plain, */*", "user-agent": USER_AGENT, ...options.headers ?? {} },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).slice(0, 300);
      } catch {
      }
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
function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === void 0 || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text === "" ? "" : `?${text}`;
}
function encodePathId(id) {
  return String(id).split("/").map((segment) => encodeURIComponent(segment)).join("/").replace(/%40/gu, "@");
}

// lib/core/sources/clawhub.js
var SOURCE_ID = "clawhub";
var BASE_URL = "https://clawhub.ai";
var SOURCE_URL = "https://clawhub.com";
function normalizeSearchResult(item) {
  const stats = item.native?.skill?.stats ?? {};
  return {
    source: SOURCE_ID,
    id: item.slug ?? item.id,
    owner: item.ownerHandle ?? item.owner?.handle ?? item.install?.reference?.split("/")[0],
    ownerName: item.owner?.displayName ?? item.publisher?.displayName,
    avatar: item.owner?.image ?? item.publisher?.image,
    name: item.slug ?? item.id,
    displayName: item.displayName ?? item.slug,
    summary: item.summary ?? "",
    version: item.version ?? item.native?.skill?.tags?.latest,
    downloads: stats.downloads ?? item.downloads ?? 0,
    installs: stats.installs ?? item.metrics?.rolling60DayInstalls ?? 0,
    stars: stats.stars ?? 0,
    license: item.latestVersion?.license,
    topics: item.native?.skill?.topics ?? item.topics ?? [],
    categories: item.native?.skill?.categories ?? [],
    category: item.native?.skill?.categories?.[0],
    url: item.canonicalUrl ? `${BASE_URL}${item.canonicalUrl}` : `${SOURCE_URL}/${item.slug}`,
    updatedAt: item.updatedAt,
    installable: (item.install?.kind ?? "clawhub") === "clawhub" || item.source === "clawhub"
  };
}
function normalizeBrowseItem(item) {
  return {
    source: SOURCE_ID,
    id: item.slug,
    owner: item.ownerHandle,
    ownerName: item.owner?.displayName ?? item.ownerHandle,
    avatar: item.owner?.image,
    name: item.slug,
    displayName: item.displayName ?? item.slug,
    summary: item.summary ?? "",
    version: item.tags?.latest ?? item.latestVersion?.version,
    downloads: item.stats?.downloads ?? 0,
    installs: item.stats?.installs ?? 0,
    stars: item.stats?.stars ?? 0,
    license: item.latestVersion?.license ?? null,
    topics: item.topics ?? [],
    categories: item.categories ?? [],
    category: item.categories?.[0],
    url: `${SOURCE_URL}/${item.ownerHandle}/${item.slug}`,
    updatedAt: item.updatedAt,
    installable: true
  };
}
var clawhub = {
  id: SOURCE_ID,
  label: "ClawHub",
  baseUrl: BASE_URL,
  homeUrl: SOURCE_URL,
  capabilities: { search: true, browse: true, detail: true, download: true },
  async search({ q, limit = 24, cursor, timeoutMs, signal }) {
    const trimmed = String(q ?? "").trim();
    if (trimmed === "") {
      const body2 = await fetchJson(`${BASE_URL}/api/v1/skills${query({ limit: Math.min(limit, 200), sort: "downloads", cursor })}`, { timeoutMs, signal });
      return {
        source: SOURCE_ID,
        items: (body2.items ?? []).map(normalizeBrowseItem),
        nextCursor: body2.nextCursor ?? void 0
      };
    }
    const body = await fetchJson(`${BASE_URL}/api/v1/search${query({ q: trimmed, limit: Math.min(limit, 100) })}`, { timeoutMs, signal });
    return {
      source: SOURCE_ID,
      items: (body.results ?? []).map(normalizeSearchResult),
      nextCursor: void 0
    };
  },
  async detail({ id, owner, timeoutMs, signal }) {
    let body;
    try {
      body = await fetchJson(`${BASE_URL}/api/v1/skills/${encodeURIComponent(id)}${query({ ownerHandle: owner })}`, { timeoutMs, signal });
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        throw Object.assign(new Error(`${id} is ambiguous on ClawHub; pass the owner handle (e.g. owner=${owner ?? "?"})`), { code: 409 });
      }
      throw error;
    }
    const skill = body.skill ?? {};
    const ownerInfo = body.owner ?? {};
    return {
      skill: normalizeBrowseItem({ ...skill, ownerHandle: ownerInfo.handle ?? owner, latestVersion: body.latestVersion }),
      skillMd: typeof skill.description === "string" && skill.description.startsWith("---") ? skill.description : void 0,
      readme: typeof skill.description === "string" && !skill.description.startsWith("---") ? skill.description : void 0,
      versions: body.latestVersion ? [{ version: body.latestVersion.version, createdAt: body.latestVersion.createdAt, changelog: body.latestVersion.changelog }] : [],
      meta: {
        license: body.latestVersion?.license,
        moderation: body.moderation?.verdict,
        changelog: body.latestVersion?.changelog,
        ownerName: ownerInfo.displayName,
        ownerImage: ownerInfo.image
      }
    };
  },
  async download({ id, owner, version, timeoutMs, signal }) {
    if (version) {
      const bytes2 = await fetchBytes(`${BASE_URL}/api/v1/download${query({ slug: id, ownerHandle: owner, version })}`, { timeoutMs });
      return { bytes: bytes2, filename: `${id}-${version}.zip` };
    }
    const plan = await fetchJson(`${BASE_URL}/api/v1/skills/${encodeURIComponent(id)}/install${query({ ownerHandle: owner })}`, { timeoutMs, signal });
    const url = plan.archive?.downloadUrl;
    if (typeof url !== "string" || url === "") {
      throw new Error(`ClawHub returned no archive for ${id}`);
    }
    const bytes = await fetchBytes(url, { timeoutMs });
    return { bytes, filename: `${id}-${plan.archive?.version ?? "latest"}.zip` };
  }
};

// lib/core/sources/modelscope.js
var SOURCE_ID2 = "modelscope";
var BASE_URL2 = "https://modelscope.cn";
function splitId(id) {
  const text = String(id ?? "");
  const cut = text.lastIndexOf("/");
  if (cut <= 0) return { path: "", name: text };
  return { path: text.slice(0, cut), name: text.slice(cut + 1) };
}
function normalize(item) {
  return {
    source: SOURCE_ID2,
    id: item.id ?? `${item.Path ?? item.path ?? ""}/${item.Name ?? item.name ?? ""}`,
    owner: item.owner ?? item.Owner,
    name: splitId(item.id ?? item.Name ?? item.name).name,
    displayName: item.display_name ?? item.DisplayName ?? splitId(item.id).name,
    summary: item.description ?? item.Description ?? "",
    version: item.version ?? item.Version,
    downloads: item.downloads ?? item.DownloadCount ?? 0,
    installs: item.installs ?? 0,
    stars: item.likes ?? item.Likes ?? 0,
    license: item.license ?? item.License,
    category: item.category ?? item.L1?.Name,
    categories: [
      item.category ?? item.L1?.Name,
      ...(item.tags ?? item.Tags ?? []).filter((tag) => String(tag).startsWith("category:")).map((tag) => String(tag).slice("category:".length))
    ].filter(Boolean),
    avatar: item.logo_url ?? item.LogoURL,
    ownerName: item.developer ?? item.Developer ?? item.owner ?? item.Owner,
    topics: item.tags ?? item.Tags ?? [],
    url: `${BASE_URL2}/skills/${encodePathId(item.id ?? "")}`,
    updatedAt: Date.parse(item.last_modified ?? item.GmtModify ?? "") || void 0,
    installable: true
  };
}
var modelscope = {
  id: SOURCE_ID2,
  label: "ModelScope",
  baseUrl: BASE_URL2,
  homeUrl: `${BASE_URL2}/skills`,
  capabilities: { search: true, browse: true, detail: true, download: true },
  async search({ q, limit = 24, cursor, timeoutMs, signal }) {
    const page = Math.max(1, Number.parseInt(cursor ?? "1", 10) || 1);
    const size = Math.min(Math.max(1, limit), 50);
    const body = await fetchJson(`${BASE_URL2}/openapi/v1/skills${query({
      search: String(q ?? "").trim(),
      page_number: page,
      page_size: size
    })}`, { timeoutMs, signal });
    const data = body.data ?? {};
    const items = (data.skills ?? []).map(normalize);
    const total = Number(data.total ?? 0);
    return {
      source: SOURCE_ID2,
      items,
      nextCursor: page * size < total ? String(page + 1) : void 0
    };
  },
  async detail({ id, timeoutMs, signal }) {
    const { path, name: name2 } = splitId(id);
    let body;
    try {
      body = await fetchJson(`${BASE_URL2}/api/v1/skills/${encodePathId(path)}/${encodeURIComponent(name2)}`, { timeoutMs, signal });
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        throw Object.assign(new Error(`ModelScope skill ${id} was not found`), { code: 404 });
      }
      throw error;
    }
    const data = body.Data ?? body.data ?? {};
    const skill = normalize({ ...data, id, name: name2 });
    let files;
    try {
      const tree = await fetchJson(`${BASE_URL2}/api/v1/skills/${encodePathId(path)}/${encodeURIComponent(name2)}/repo/files${query({ Revision: "master" })}`, { timeoutMs, signal });
      const list = tree.Data?.Files ?? tree.data?.Files ?? [];
      files = list.map((entry) => ({ path: entry.Path ?? entry.path, size: entry.Size ?? entry.size, type: entry.Type ?? entry.type }));
    } catch {
    }
    const readme = data.ReadMeContent ?? data.readMeContent ?? "";
    return {
      skill,
      skillMd: readme.startsWith("---") ? readme : void 0,
      readme: readme.startsWith("---") ? void 0 : readme,
      files,
      meta: {
        developer: data.Developer ?? data.developer,
        sourceUrl: data.SourceURL ?? data.source_url,
        syncStatus: data.SyncStatus ?? data.sync_status,
        category: data.Category ?? data.category
      }
    };
  },
  async download({ id, version, timeoutMs, signal }) {
    const { path, name: name2 } = splitId(id);
    const revision = version ?? "master";
    const url = `${BASE_URL2}/api/v1/skills/${encodePathId(path)}/${encodeURIComponent(name2)}/archive/zip/${encodeURIComponent(revision)}`;
    try {
      const bytes = await fetchBytes(url, { timeoutMs, signal });
      return { bytes, filename: `${name2}-${revision}.zip` };
    } catch (error) {
      if (error instanceof HttpError && error.status === 404 && version === void 0) {
        const bytes = await fetchBytes(`${BASE_URL2}/api/v1/skills/${encodePathId(path)}/${encodeURIComponent(name2)}/archive/zip/main`, { timeoutMs, signal });
        return { bytes, filename: `${name2}-main.zip` };
      }
      throw error;
    }
  }
};

// lib/core/sources/qwenpaw.js
var SOURCE_ID3 = "qwenpaw";
var BASE_URL3 = "https://platform.agentscope.io";
var detailCache = /* @__PURE__ */ new Map();
var DETAIL_TTL_MS = 5 * 60 * 1e3;
var DETAIL_CACHE_MAX = 24;
function remember(key, value) {
  detailCache.set(key, { at: Date.now(), value });
  if (detailCache.size > DETAIL_CACHE_MAX) {
    const oldest = detailCache.keys().next().value;
    detailCache.delete(oldest);
  }
}
function recall(key) {
  const hit = detailCache.get(key);
  if (hit === void 0) return void 0;
  if (Date.now() - hit.at > DETAIL_TTL_MS) {
    detailCache.delete(key);
    return void 0;
  }
  return hit.value;
}
function normalize2(item) {
  const locale = item.locales?.zh ?? item.locales?.en ?? {};
  return {
    source: SOURCE_ID3,
    id: item.id,
    owner: item.owner ?? String(item.id ?? "").split("/")[0]?.replace(/^@/u, ""),
    ownerName: item.owner ?? item.developer,
    avatar: item.logo_url ?? item.avatar,
    name: String(item.id ?? "").split("/").slice(1).join("/") || item.id,
    displayName: item.display_name ?? locale.display_name ?? String(item.id ?? "").split("/").slice(1).join("/"),
    summary: locale.description ?? item.description ?? "",
    version: item.version,
    downloads: item.downloads ?? 0,
    installs: 0,
    stars: 0,
    license: item.license,
    category: locale.category,
    categories: [item.locales?.zh?.category, item.locales?.en?.category].filter(Boolean),
    topics: [],
    url: item.details_url ?? `${BASE_URL3}/skills/${encodePathId(item.id ?? "")}`,
    uuid: item.details_url?.split("/").pop(),
    installable: true
  };
}
var qwenpaw = {
  id: SOURCE_ID3,
  label: "QwenPaw",
  baseUrl: BASE_URL3,
  homeUrl: `${BASE_URL3}/skills`,
  capabilities: { search: true, browse: true, detail: true, download: true },
  async search({ q, limit = 24, cursor, timeoutMs, signal }) {
    const page = Math.max(1, Number.parseInt(cursor ?? "1", 10) || 1);
    const size = Math.min(Math.max(1, limit), 100);
    const body = await fetchJson(`${BASE_URL3}/openapi/v1/skills${query({
      search: String(q ?? "").trim(),
      page_number: page,
      page_size: size
    })}`, { timeoutMs, signal });
    const data = body.data ?? {};
    const items = (data.skills ?? []).map(normalize2);
    const total = Number(data.total ?? 0);
    return {
      source: SOURCE_ID3,
      items,
      nextCursor: page * size < total ? String(page + 1) : void 0
    };
  },
  async detail({ id, version, timeoutMs, signal }) {
    const key = `${id}@${version ?? ""}`;
    const cached = recall(key);
    if (cached !== void 0) return cached;
    const { bytes } = await this.download({ id, version, timeoutMs, signal });
    const entries = rebaseToSkillRoot(readZipEntries(bytes));
    const skillFile = entries.find((entry) => entry.path.toLowerCase() === "skill.md");
    const skillMd = skillFile === void 0 ? void 0 : toText(skillFile.data);
    const value = {
      skill: {
        source: SOURCE_ID3,
        id,
        owner: String(id).split("/")[0]?.replace(/^@/u, ""),
        name: String(id).split("/").slice(1).join("/"),
        displayName: String(id).split("/").slice(1).join("/"),
        summary: "",
        version,
        downloads: 0,
        installs: 0,
        stars: 0,
        url: `${BASE_URL3}/skills/${encodePathId(id)}`,
        installable: true
      },
      skillMd,
      files: entries.map((entry) => ({ path: entry.path, size: entry.data.length, type: "blob" })),
      meta: { downloaded: true }
    };
    remember(key, value);
    return value;
  },
  async download({ id, version, uuid, timeoutMs, signal }) {
    const attempts = [];
    if (uuid) attempts.push({ url: `${BASE_URL3}/api/v1/skills/${encodeURIComponent(uuid)}/download`, label: uuid.slice(0, 8) });
    if (version) attempts.push({ url: `${BASE_URL3}/skills/${encodePathId(id)}/archive/zip/${encodeURIComponent(version)}`, label: version });
    attempts.push({ url: `${BASE_URL3}/skills/${encodePathId(id)}/archive/zip/main`, label: "main" });
    let lastError = null;
    for (const attempt of attempts) {
      try {
        const bytes = await fetchBytes(attempt.url, { timeoutMs, signal });
        return { bytes, filename: `${String(id).split("/").slice(1).join("-")}-${attempt.label}.zip` };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error(`QwenPaw archive unavailable for ${id}`);
  }
};

// lib/core/sources/index.js
var SOURCES = [clawhub, modelscope, qwenpaw];
var SOURCE_IDS = SOURCES.map((source) => source.id);
function getSource(id) {
  return SOURCES.find((source) => source.id === String(id ?? "").toLowerCase());
}
function describeSources() {
  return SOURCES.map((source) => ({
    id: source.id,
    label: source.label,
    baseUrl: source.baseUrl,
    homeUrl: source.homeUrl,
    capabilities: source.capabilities
  }));
}

// lib/core/install.js
async function installFromSource(request2) {
  const adapter = getSource(request2.source);
  if (adapter === void 0) {
    throw Object.assign(new Error(`unknown source ${JSON.stringify(request2.source)}`), { code: 400 });
  }
  const { bytes, filename } = await adapter.download({
    id: request2.id,
    owner: request2.owner,
    version: request2.version,
    uuid: request2.uuid,
    timeoutMs: request2.timeoutMs,
    signal: request2.signal
  });
  const targetRoot = request2.root === "project" ? projectSkillRoot(request2.cwd ?? process.cwd()) : userSkillRoot(request2.dshHome ?? dshHomeDir());
  const installed = await installSkillArchive(bytes, targetRoot, {
    name: request2.name,
    overwrite: request2.overwrite === true
  });
  return {
    ok: true,
    source: adapter.id,
    id: request2.id,
    name: installed.name,
    path: installed.path,
    files: installed.files,
    filename,
    targetRoot
  };
}
async function detailFromSource(request2) {
  const adapter = getSource(request2.source);
  if (adapter === void 0) {
    throw Object.assign(new Error(`unknown source ${JSON.stringify(request2.source)}`), { code: 400 });
  }
  return adapter.detail({
    id: request2.id,
    owner: request2.owner,
    version: request2.version,
    uuid: request2.uuid,
    timeoutMs: request2.timeoutMs,
    signal: request2.signal
  });
}
async function searchSource(request2) {
  const adapter = getSource(request2.source);
  if (adapter === void 0) {
    throw Object.assign(new Error(`unknown source ${JSON.stringify(request2.source)}`), { code: 400 });
  }
  return adapter.search({
    q: request2.q,
    limit: request2.limit,
    cursor: request2.cursor,
    timeoutMs: request2.timeoutMs,
    signal: request2.signal
  });
}

// lib/web.js
var JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};
function writeJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body ?? null);
  try {
    res.writeHead(status, { ...JSON_HEADERS, ...headers });
    res.end(payload);
  } catch {
    try {
      res.end(payload);
    } catch {
    }
  }
}
function writeBytes(res, status, bytes, contentType, filename) {
  try {
    res.writeHead(status, {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`
    });
    res.end(Buffer.from(bytes));
  } catch {
    try {
      res.end();
    } catch {
    }
  }
}
async function readJsonBody(req, { maxBytes = 8 * 1024 * 1024, objectOnly = true } = {}) {
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
function queryParam(url, name2) {
  const value = url.searchParams.get(name2);
  return value === null ? void 0 : value;
}
function header(req, name2) {
  const value = req?.headers?.[name2];
  return typeof value === "string" ? value : void 0;
}
function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`);
  } catch {
    return void 0;
  }
}
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) <= 255);
}
function canonicalAuthority(entry, entryUrl) {
  const port = entryUrl.port !== "" ? entryUrl.port : parseAuthority(entry)?.port ?? "";
  return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}
function isTrustedAuthority(hostUrl, trustedHosts2) {
  return (trustedHosts2 ?? []).some((entry) => {
    if (typeof entry !== "string") return false;
    const entryUrl = parseAuthority(entry);
    if (entryUrl === void 0) return false;
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname ? entryUrl.hostname === hostUrl.hostname : entryUrl.host === hostUrl.host;
  });
}
function trustedHosts(ctx) {
  try {
    const runtime = typeof ctx?.get === "function" ? ctx.get("webRuntime", false) : ctx?.webRuntime;
    return runtime?.trustedHosts ?? [];
  } catch {
    return [];
  }
}
function isPairedDevice(ctx, req) {
  try {
    const pairing = typeof ctx?.get === "function" ? ctx.get("remoteWebUiPairing", false) : ctx?.remoteWebUiPairing;
    return typeof pairing?.isPairedDevice === "function" && pairing.isPairedDevice(req) === true;
  } catch {
    return false;
  }
}
var lastFenceError = void 0;
function fenceDiagnostics() {
  return lastFenceError;
}
function isAllowed(ctx, req) {
  try {
    const host = header(req, "host");
    if (host === void 0) return isPairedDevice(ctx, req);
    const hostUrl = parseAuthority(host);
    if (hostUrl === void 0) return false;
    if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts(ctx))) {
      return isPairedDevice(ctx, req);
    }
    if (header(req, "sec-fetch-site") === "cross-site") return false;
    const origin = header(req, "origin");
    if (origin === void 0) return true;
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
function guard(ctx, req, res, method) {
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
function errorStatus(error) {
  const code = Number(error?.code);
  if (Number.isFinite(code) && code >= 400 && code < 600) return code;
  return 500;
}

// lib/routes.js
var ROUTES = {
  health: "/api/dsh-skill-hub/health",
  sources: "/api/dsh-skill-hub/sources",
  list: "/api/dsh-skill-hub/local/list",
  read: "/api/dsh-skill-hub/local/read",
  create: "/api/dsh-skill-hub/local/create",
  update: "/api/dsh-skill-hub/local/update",
  setEnabled: "/api/dsh-skill-hub/local/set-enabled",
  delete: "/api/dsh-skill-hub/local/delete",
  export: "/api/dsh-skill-hub/local/export",
  import: "/api/dsh-skill-hub/local/import",
  search: "/api/dsh-skill-hub/market/search",
  detail: "/api/dsh-skill-hub/market/detail",
  install: "/api/dsh-skill-hub/market/install"
};
var BUILD = "2026-10-04.3-merged-market";
function makeRoutes(ctx, deps) {
  const { config: readRawConfig, logger, sessionCwds } = deps;
  const config = () => {
    try {
      return readRawConfig() ?? {};
    } catch (error) {
      logger?.warn?.(error);
      return {};
    }
  };
  const roots = () => ({
    dshHome: config().dshHome ?? dshHomeDir(),
    agentsHome: config().agentsHome ?? agentsHomeDir(),
    customSkillDirs: config().customSkillDirs ?? [],
    cwd: sessionCwds()[0] ?? process.cwd(),
    projectRoots: sessionCwds().map((cwd) => cwd)
  });
  const scanOptions = (cwd) => ({
    ...roots(),
    ...cwd ? { cwd } : {},
    projectRoots: sessionCwds()
  });
  const resolveSkill = async (name2, expectedPath, cwd) => {
    const { skills } = await scanSkills(scanOptions(cwd));
    const skill = skills.find((candidate) => candidate.name === name2);
    if (skill === void 0) {
      throw Object.assign(new Error(`skill ${name2} not found`), { code: 404 });
    }
    if (skill.path !== expectedPath) {
      throw Object.assign(new Error(`skill ${name2} changed since the panel loaded; refresh and retry`), { code: 409 });
    }
    return skill;
  };
  const handle = (method, handler) => async (req, res) => {
    try {
      if (!guard(ctx, req, res, method)) return;
      await handler(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : void 0;
      logger?.warn?.(error);
      try {
        const status = errorStatus(error);
        writeJson(res, status, { error: message, detail: stack });
      } catch {
      }
    }
  };
  return [
    {
      kind: "exact",
      path: ROUTES.health,
      handler: handle("GET", async (req, res) => {
        const { skills } = await scanSkills(scanOptions());
        writeJson(res, 200, { ok: true, plugin: "skill-hub", build: BUILD, skills: skills.length, sources: SOURCE_IDS });
      })
    },
    {
      kind: "exact",
      path: ROUTES.sources,
      handler: handle("GET", async (req, res) => {
        const conf = config();
        writeJson(res, 200, {
          sources: describeSources().map((source) => ({
            ...source,
            enabled: (conf.disabledSources ?? []).includes(source.id) === false
          })),
          defaultSource: conf.defaultSource ?? SOURCE_IDS[0],
          installRoot: conf.installRoot ?? "user"
        });
      })
    },
    {
      kind: "exact",
      path: ROUTES.list,
      handler: handle("GET", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const q = (queryParam(url, "q") ?? "").trim().toLowerCase();
        const payload = await scanSkills(scanOptions(queryParam(url, "cwd")));
        const groups = payload.groups.map((group) => ({
          ...group,
          skills: q === "" ? group.skills : group.skills.filter((skill) => `${skill.name} ${skill.description}`.toLowerCase().includes(q))
        })).filter((group) => group.skills.length > 0);
        writeJson(res, 200, { ...payload, groups, total: payload.skills.length });
      })
    },
    {
      kind: "exact",
      path: ROUTES.read,
      handler: handle("GET", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const name2 = queryParam(url, "name");
        const path = queryParam(url, "path");
        if (name2 === void 0 || path === void 0 || path.trim() === "") {
          writeJson(res, 400, { error: "expected ?name=<skill>&path=<absolute SKILL.md>" });
          return;
        }
        const skill = await resolveSkill(name2, path);
        writeJson(res, 200, readSkill(skill.path));
      })
    },
    {
      kind: "exact",
      path: ROUTES.create,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 4 * 1024 * 1024 });
        if (body === null) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        const { root, name: name2, description, whenToUse, content, cwd } = body;
        if (typeof description !== "string" || description.trim() === "") {
          writeJson(res, 400, { error: "description is required" });
          return;
        }
        if (typeof content !== "string" || content.trim() === "") {
          writeJson(res, 400, { error: "content is required" });
          return;
        }
        const base = root === "project" ? projectSkillRoot(cwd ?? roots().cwd) : userSkillRoot(roots().dshHome);
        writeJson(res, 200, {
          ok: true,
          name: name2,
          path: await createSkill(base, { name: name2, description, whenToUse, content })
        });
      })
    },
    {
      kind: "exact",
      path: ROUTES.update,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 4 * 1024 * 1024 });
        if (body === null) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        const { name: name2, path, description, whenToUse, content } = body;
        if (typeof name2 !== "string" || typeof path !== "string") {
          writeJson(res, 400, { error: "expected { name, path, description, content }" });
          return;
        }
        const skill = await resolveSkill(name2, path);
        if (skill.linked === true) {
          writeJson(res, 400, { error: `skill ${name2} is a symlink and cannot be edited here` });
          return;
        }
        writeJson(res, 200, {
          ok: true,
          name: name2,
          path: await updateSkill(skill.path, { name: name2, description, whenToUse, content })
        });
      })
    },
    {
      kind: "exact",
      path: ROUTES.setEnabled,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 256 * 1024 });
        if (body === null) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        const { name: name2, path, enabled } = body;
        if (typeof name2 !== "string" || typeof path !== "string" || typeof enabled !== "boolean") {
          writeJson(res, 400, { error: "expected { name, path, enabled }" });
          return;
        }
        const skill = await resolveSkill(name2, path);
        await setSkillEnabled(skill.path, enabled);
        writeJson(res, 200, { ok: true, name: name2, enabled, path: skill.path });
      })
    },
    {
      kind: "exact",
      path: ROUTES.delete,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 256 * 1024 });
        if (body === null) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        const { name: name2, path } = body;
        if (typeof name2 !== "string" || typeof path !== "string") {
          writeJson(res, 400, { error: "expected { name, path }" });
          return;
        }
        const skill = await resolveSkill(name2, path);
        if (skill.linked === true) {
          writeJson(res, 400, { error: `skill ${name2} is a symlink and cannot be deleted here` });
          return;
        }
        writeJson(res, 200, { ok: true, name: name2, moved: await trashSkill(skill.path) });
      })
    },
    {
      kind: "exact",
      path: ROUTES.export,
      handler: handle("GET", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const name2 = queryParam(url, "name");
        const path = queryParam(url, "path");
        if (name2 === void 0 || path === void 0) {
          writeJson(res, 400, { error: "expected ?name=<skill>&path=<absolute SKILL.md>" });
          return;
        }
        const skill = await resolveSkill(name2, path);
        const { bytes } = await exportSkillZip(skill.path);
        writeBytes(res, 200, bytes, "application/zip", `${skill.name}.zip`);
      })
    },
    {
      kind: "exact",
      path: ROUTES.import,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 24 * 1024 * 1024 });
        if (body === null || typeof body.zip !== "string") {
          writeJson(res, 400, { error: "expected { zip: <base64> }" });
          return;
        }
        const bytes = new Uint8Array(Buffer.from(body.zip, "base64"));
        const base = body.root === "project" ? projectSkillRoot(body.cwd ?? roots().cwd) : userSkillRoot(roots().dshHome);
        writeJson(res, 200, {
          ok: true,
          ...await installSkillArchive(bytes, base, { name: body.name, overwrite: body.overwrite === true })
        });
      })
    },
    {
      kind: "exact",
      path: ROUTES.search,
      handler: handle("GET", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const source = queryParam(url, "source");
        if (source === void 0 || !SOURCE_IDS.includes(source)) {
          writeJson(res, 400, { error: `source must be one of ${SOURCE_IDS.join(", ")}` });
          return;
        }
        const limit = Number.parseInt(queryParam(url, "limit") ?? "24", 10);
        writeJson(res, 200, await searchSource({
          source,
          q: queryParam(url, "q"),
          cursor: queryParam(url, "cursor"),
          limit: Number.isFinite(limit) ? limit : 24,
          timeoutMs: config().requestTimeoutMs
        }));
      })
    },
    {
      kind: "exact",
      path: ROUTES.detail,
      handler: handle("GET", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const source = queryParam(url, "source");
        const id = queryParam(url, "id");
        if (source === void 0 || id === void 0 || !SOURCE_IDS.includes(source)) {
          writeJson(res, 400, { error: "expected ?source=<clawhub|modelscope|qwenpaw>&id=<skill>" });
          return;
        }
        writeJson(res, 200, await detailFromSource({
          source,
          id,
          owner: queryParam(url, "owner"),
          version: queryParam(url, "version"),
          uuid: queryParam(url, "uuid"),
          timeoutMs: config().requestTimeoutMs
        }));
      })
    },
    {
      kind: "exact",
      path: ROUTES.install,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 256 * 1024 });
        if (body === null) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        const { source, id, owner, version, uuid, name: name2, root, overwrite, cwd } = body;
        if (typeof source !== "string" || typeof id !== "string" || !SOURCE_IDS.includes(source)) {
          writeJson(res, 400, { error: "expected { source, id, owner?, version?, name?, root?, overwrite? }" });
          return;
        }
        writeJson(res, 200, await installFromSource({
          source,
          id,
          owner,
          version,
          uuid,
          name: name2,
          root: root === "project" ? "project" : "user",
          cwd: cwd ?? roots().cwd,
          overwrite: overwrite === true,
          dshHome: roots().dshHome,
          timeoutMs: Math.max(config().requestTimeoutMs ?? 2e4, 6e4)
        }));
      })
    }
  ];
}

// lib/tools.js
import { defineTool } from "@deepseek-ai/dsh-tools";
var ACTIONS = [
  "local_list",
  "local_read",
  "local_create",
  "local_update",
  "local_set_enabled",
  "local_delete",
  "market_search",
  "market_detail",
  "market_install",
  "sources"
];
function clamp(text, max2 = 8e3) {
  const value = String(text ?? "");
  return value.length <= max2 ? value : `${value.slice(0, max2)}
\u2026 (truncated, ${value.length} chars total)`;
}
function registerTools(ctx, config) {
  const scanOptions = () => ({
    dshHome: config().dshHome ?? void 0,
    agentsHome: config().agentsHome ?? void 0,
    customSkillDirs: config().customSkillDirs ?? [],
    cwd: process.cwd()
  });
  const resolve = async (name2) => {
    const { skills } = await scanSkills(scanOptions());
    const skill = skills.find((candidate) => candidate.name === name2);
    if (skill === void 0) throw new Error(`skill ${name2} not found locally`);
    return skill;
  };
  return ctx.tools.register(defineTool({
    name: "skill_hub",
    description: "Manage local Agent Skills and browse/download skills from the ClawHub, ModelScope and QwenPaw marketplaces. Actions: sources (list marketplaces), local_list (list installed skills), local_read, local_create, local_update, local_set_enabled, local_delete, market_search (search one marketplace), market_detail (read a marketplace skill's SKILL.md before installing), market_install (download a skill into ~/.dsh/skills). Use market_detail before market_install when the user has not asked for a specific skill.",
    parameters: {
      action: {
        type: "string",
        enum: ACTIONS,
        required: true,
        description: "Which operation to perform."
      },
      name: {
        type: "string",
        description: "Local skill name (local_read / local_update / local_set_enabled / local_delete / local_create)."
      },
      q: {
        type: "string",
        description: "Search query for local_list / market_search."
      },
      source: {
        type: "string",
        enum: SOURCE_IDS,
        description: "Marketplace id for market_search / market_detail / market_install."
      },
      id: {
        type: "string",
        description: "Marketplace skill id (ClawHub slug, ModelScope `path/name`, QwenPaw `@owner/name`)."
      },
      owner: {
        type: "string",
        description: "Owner handle; required by ClawHub when a slug is ambiguous."
      },
      version: {
        type: "string",
        description: "Version / revision to install (defaults to the latest)."
      },
      description: {
        type: "string",
        description: "Skill description (local_create / local_update)."
      },
      whenToUse: {
        type: "string",
        description: "Optional whenToUse hint (local_create / local_update)."
      },
      content: {
        type: "string",
        description: "Markdown body of SKILL.md (local_create / local_update)."
      },
      enabled: {
        type: "boolean",
        description: "Enable or disable model invocation (local_set_enabled)."
      },
      root: {
        type: "string",
        enum: ["user", "project"],
        description: "Install target: `user` = ~/.dsh/skills (global), `project` = workspace .dsh/skills."
      },
      limit: {
        type: "integer",
        description: "Result cap for market_search (default 15, max 50)."
      },
      overwrite: {
        type: "boolean",
        description: "Replace an existing skill of the same name when installing."
      }
    },
    output: {
      schema: { type: "json" },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }]
    },
    async execute(args, exec) {
      const limit = Math.min(Math.max(Number(args.limit ?? 15) || 15, 1), 50);
      switch (args.action) {
        case "sources":
          return { sources: describeSources() };
        case "local_list": {
          const { groups, roots } = await scanSkills(scanOptions());
          const q = String(args.q ?? "").trim().toLowerCase();
          return {
            groups: groups.map((group) => ({
              key: group.key,
              title: group.title,
              skills: group.skills.filter((skill) => q === "" || `${skill.name} ${skill.description}`.toLowerCase().includes(q)).map((skill) => ({
                name: skill.name,
                description: skill.description,
                enabled: skill.enabled,
                level: skill.level,
                path: skill.path
              }))
            })).filter((group) => group.skills.length > 0),
            roots: roots.filter((root) => root.exists)
          };
        }
        case "local_read": {
          const skill = await resolve(args.name);
          const detail = readSkill(skill.path);
          return {
            name: detail.name,
            description: detail.description,
            whenToUse: detail.whenToUse,
            path: detail.path,
            content: clamp(detail.content, 16e3)
          };
        }
        case "local_create": {
          if (typeof args.name !== "string" || typeof args.description !== "string" || typeof args.content !== "string") {
            throw new Error("local_create needs name, description and content");
          }
          const base = args.root === "project" ? projectSkillRoot(exec?.agent?.session?.header?.cwd ?? process.cwd()) : userSkillRoot(config().dshHome ?? void 0);
          const path = await createSkill(base, {
            name: args.name,
            description: args.description,
            whenToUse: args.whenToUse,
            content: args.content
          });
          return { ok: true, name: args.name, path };
        }
        case "local_update": {
          const skill = await resolve(args.name);
          const path = await updateSkill(skill.path, {
            description: args.description,
            whenToUse: args.whenToUse,
            content: args.content
          });
          return { ok: true, name: args.name, path };
        }
        case "local_set_enabled": {
          const skill = await resolve(args.name);
          await setSkillEnabled(skill.path, args.enabled !== false);
          return { ok: true, name: args.name, enabled: args.enabled !== false };
        }
        case "local_delete": {
          const skill = await resolve(args.name);
          return { ok: true, name: args.name, moved: await trashSkill(skill.path) };
        }
        case "market_search": {
          if (!SOURCE_IDS.includes(args.source)) throw new Error(`source must be one of ${SOURCE_IDS.join(", ")}`);
          const result = await searchSource({ source: args.source, q: args.q, limit });
          return {
            source: args.source,
            count: result.items.length,
            items: result.items.map((item) => ({
              id: item.id,
              owner: item.owner,
              displayName: item.displayName,
              summary: clamp(item.summary, 400),
              version: item.version,
              downloads: item.downloads,
              url: item.url
            })),
            nextCursor: result.nextCursor
          };
        }
        case "market_detail": {
          if (!SOURCE_IDS.includes(args.source)) throw new Error(`source must be one of ${SOURCE_IDS.join(", ")}`);
          if (typeof args.id !== "string") throw new Error("market_detail needs id");
          const detail = await detailFromSource({ source: args.source, id: args.id, owner: args.owner, version: args.version });
          return {
            skill: detail.skill,
            meta: detail.meta,
            files: (detail.files ?? []).slice(0, 40),
            skillMd: clamp(detail.skillMd ?? detail.readme ?? "", 12e3)
          };
        }
        case "market_install": {
          if (!SOURCE_IDS.includes(args.source)) throw new Error(`source must be one of ${SOURCE_IDS.join(", ")}`);
          if (typeof args.id !== "string") throw new Error("market_install needs id");
          return installFromSource({
            source: args.source,
            id: args.id,
            owner: args.owner,
            version: args.version,
            name: args.name,
            root: args.root === "project" ? "project" : "user",
            cwd: exec?.agent?.session?.header?.cwd ?? process.cwd(),
            overwrite: args.overwrite === true,
            dshHome: config().dshHome ?? void 0,
            timeoutMs: 6e4
          });
        }
        default:
          throw new Error(`unknown action ${JSON.stringify(args.action)}`);
      }
    }
  }));
}

// lib/index.js
var name = "skill-hub";
var inject = ["webServer", "sessions", "tools"];
function apply(ctx, config) {
  const conf = () => liveConfig(config);
  if (conf().enabled === false) return;
  const logger = ctx.logger?.("skill-hub") ?? console;
  const sessionCwds = () => {
    try {
      return (ctx.sessions?.list?.() ?? []).map((session) => session.header?.cwd).filter((cwd) => typeof cwd === "string" && cwd !== "");
    } catch {
      return [];
    }
  };
  ctx.effect(() => {
    const disposers = makeRoutes(ctx, { config: conf, logger, sessionCwds }).map((route) => ctx.webServer.register(route));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, "skill-hub: routes");
  if (conf().enableTools !== false) {
    ctx.effect(() => registerTools(ctx, conf), "skill-hub: tools");
  }
  logger.info?.("skill-hub ready: local skills + ClawHub / ModelScope / QwenPaw");
}
export {
  Config,
  apply,
  inject,
  name
};
