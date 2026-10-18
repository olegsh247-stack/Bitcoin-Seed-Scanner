// Data providers and the switching logic between them.
// All three servers speak the same Esplora API; the app talks to one at a time and moves
// to the next when the current one stops answering. Pure logic: fetch and sleep are
// injected so every failure kind can be tested without a network.
import { MAX_FEE_RATE } from "./lib.js";

export const PROVIDERS = [
  {
    id: "mempool",
    host: "mempool.space",
    base: "https://mempool.space/api",
    tx: "https://mempool.space/tx/",
    fees: "mempool",
  },
  {
    id: "blockstream",
    host: "blockstream.info",
    base: "https://blockstream.info/api",
    tx: "https://blockstream.info/tx/",
    fees: "esplora",
  },
  {
    id: "btcscan",
    host: "btcscan.org",
    base: "https://btcscan.org/api",
    tx: "https://btcscan.org/tx/",
    fees: "esplora",
  },
];

export const PROBE_TIMEOUT_MS = 5000;
export const REQUEST_TIMEOUT_MS = 20000;
export const BROADCAST_TIMEOUT_MS = 30000;
export const STALE_BLOCKS = 2; // a server this many blocks behind the best one is skipped
export const SWITCH_AFTER_FAILURES = 3; // consecutive failures before a server is dropped
export const DOWN_MS = 120000; // a dropped server is not used again for this long

// kind: limit (429) | blocked (403) | network | server (5xx) | client (other 4xx)
//       | bad (answer failed validation) | noanswer (broadcast got no answer)
//       | rejected (broadcast refused) | none (no server could be reached)
export class NetError extends Error {
  constructor(kind, message, provider, status) {
    super(message);
    this.name = "NetError";
    this.kind = kind;
    this.provider = provider || null;
    this.status = status || 0;
  }
}

export const kindOfStatus = (s) =>
  s === 429 ? "limit" : s === 403 ? "blocked" : s >= 500 ? "server" : "client";

const isHeight = (t) => /^\d{5,8}$/.test(t);

// Fee estimates -> { fast, halfHour, hour } in sat/vB, or null when the answer is not usable.
export function parseFees(style, text) {
  let d;
  try {
    d = JSON.parse(text);
  } catch (_) {
    return null;
  }
  if (!d || typeof d !== "object") return null;
  let fast, halfHour, hour;
  if (style === "mempool") {
    ({ fastestFee: fast, halfHourFee: halfHour, hourFee: hour } = d);
  } else {
    // Esplora: { "<blocks>": sat/vB }. 1 block = fast, 3 = half hour, 6 = hour.
    const up = (x) => (typeof x === "number" && Number.isFinite(x) ? Math.max(1, Math.ceil(x * 10) / 10) : NaN);
    fast = up(d["1"]);
    halfHour = up(d["3"]);
    hour = up(d["6"]);
  }
  const ok = (x) => typeof x === "number" && Number.isFinite(x) && x >= 1 && x <= MAX_FEE_RATE;
  return ok(fast) && ok(halfHour) && ok(hour) ? { fast, halfHour, hour } : null;
}

export function createNet({
  fetchImpl = (...a) => fetch(...a),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
  providers = PROVIDERS,
  onChange = () => {},
} = {}) {
  let mode = "auto"; // "auto" or a provider id (pinned: never switches by itself)
  let active = null;
  let bestHeight = 0;
  let penalty = 0; // extra pause between lookups while a server complains
  let probing = null;
  let gen = 0; // bumped when the mode changes or servers are re-measured: stale probes are dropped
  const down = new Map(); // id -> time until which the server is not used
  const fails = new Map(); // id -> consecutive failures
  let lastErr = null;

  const byId = (id) => providers.find((p) => p.id === id) || null;
  const isDown = (p) => (down.get(p.id) || 0) > now();
  const pinned = () => mode !== "auto";
  const emit = (info) => onChange({ active, mode, ...info });

  async function timed(url, init, ms) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetchImpl(url, { ...init, signal: ctl.signal });
      const text = await res.text(); // body is read inside the same time limit
      return { ok: res.ok, status: res.status, text };
    } finally {
      clearTimeout(timer);
    }
  }

  const failureOf = (p, e) =>
    e instanceof NetError ? e : new NetError("network", String((e && e.message) || e), p);

  async function height(p) {
    const res = await timed(`${p.base}/blocks/tip/height`, {}, PROBE_TIMEOUT_MS);
    if (!res.ok) throw new NetError(kindOfStatus(res.status), `HTTP ${res.status}`, p, res.status);
    const t = res.text.trim();
    if (!isHeight(t)) throw new NetError("bad", "bad block height", p);
    return Number(t);
  }

  // Ask every candidate for the block height at once; take the first (in trust order) that
  // answers and is not behind the others.
  function probe() {
    if (probing) return probing;
    const g = gen;
    probing = (async () => {
      const cands = pinned() ? [byId(mode)] : providers;
      const out = await Promise.all(
        cands.map((p) =>
          height(p).then(
            (h) => ({ p, h }),
            (e) => ({ p, e: failureOf(p, e) }),
          ),
        ),
      );
      if (g !== gen) {
        probing = null;
        return probe(); // the choice changed while we were measuring: measure again
      }
      const good = out.filter((r) => r.h !== undefined);
      if (!good.length) {
        // Prefer the most informative reason: a rate limit or block over a plain outage.
        const errs = out.map((r) => r.e);
        lastErr =
          errs.find((e) => e.kind === "blocked") ||
          errs.find((e) => e.kind === "limit") ||
          errs[0];
        throw new NetError(lastErr.kind, lastErr.message, lastErr.provider, lastErr.status);
      }
      bestHeight = Math.max(bestHeight, ...good.map((r) => r.h));
      const pick = good.find((r) => r.h >= bestHeight - STALE_BLOCKS) || good[0];
      active = pick.p;
      down.clear();
      fails.clear();
      penalty = 0;
      emit({ reason: "probe" });
      return active;
    })();
    const done = () => (probing = null);
    probing.then(done, done);
    return probing;
  }

  // The next server in trust order that is not down and is not stale.
  async function pickNext(exceptId) {
    for (const p of providers) {
      if (p.id === exceptId || isDown(p)) continue;
      try {
        const h = await height(p);
        if (h < bestHeight - STALE_BLOCKS) {
          down.set(p.id, now() + DOWN_MS); // stale: answers, but behind the chain
          continue;
        }
        bestHeight = Math.max(bestHeight, h);
        return p;
      } catch (e) {
        down.set(p.id, now() + DOWN_MS);
        lastErr = failureOf(p, e);
      }
    }
    return null;
  }

  async function current(avoid) {
    const a = await currentActive();
    if (!avoid || !avoid.has(a.id)) return a;
    // This server gave an unusable answer to this very request: ask another one, but do not
    // drop it (one odd answer is not an outage).
    const alt = pinned() ? null : providers.find((p) => !avoid.has(p.id) && !isDown(p));
    if (!alt) throw new NetError("bad", "no server gave a usable answer");
    return alt;
  }

  async function currentActive() {
    if (!active) await probe();
    if (pinned() || !isDown(active)) return active;
    const from = active;
    const next = await pickNext(from.id);
    if (!next) {
      const e = lastErr || new NetError("network", "no server answers", from);
      throw new NetError(e.kind, e.message, e.provider, e.status);
    }
    active = next;
    penalty = 0;
    emit({ reason: "switch", from });
    return active;
  }

  async function noteFailure(p, err) {
    lastErr = err;
    if (pinned()) {
      penalty = Math.min(8000, Math.max(500, penalty * 2));
      return;
    }
    const n = (fails.get(p.id) || 0) + 1;
    fails.set(p.id, n);
    if (err.kind === "limit" || err.kind === "blocked") down.set(p.id, now() + DOWN_MS);
    else if (n >= SWITCH_AFTER_FAILURES) {
      // Is the server really down, or is it only this request (e.g. one address) that fails?
      try {
        await height(p);
        fails.set(p.id, 0);
        penalty = Math.min(8000, Math.max(500, penalty * 2));
      } catch (_) {
        down.set(p.id, now() + DOWN_MS);
      }
    } else penalty = Math.min(8000, Math.max(500, penalty * 2));
  }

  // GET/POST a path on the active server. `parse` validates the answer; a bad answer counts
  // as a failure of that server. Returns parse(text).
  async function request(path, { method = "GET", body, timeout = REQUEST_TIMEOUT_MS, parse = (t) => t, attempts = 9 } = {}) {
    let err = null;
    const avoid = new Set(); // servers that answered this request with unusable data
    for (let i = 0; i < attempts; i++) {
      let p;
      try {
        p = await current(avoid);
      } catch (e) {
        throw err && e.kind === "bad" ? err : e;
      }
      try {
        const res = await timed(p.base + path, { method, body }, timeout);
        if (res.ok) {
          try {
            const value = parse(res.text);
            fails.set(p.id, 0);
            penalty = penalty < 200 ? 0 : Math.floor(penalty / 2);
            return value;
          } catch (e) {
            err = new NetError("bad", String(e.message || e), p);
          }
        } else {
          err = new NetError(kindOfStatus(res.status), `HTTP ${res.status}`, p, res.status);
        }
      } catch (e) {
        err = failureOf(p, e);
      }
      if (err.kind === "client") throw err; // e.g. 404 for an unknown item: not the server's fault
      if (err.kind === "bad") {
        avoid.add(p.id);
        if (pinned()) await sleep(Math.min(8000, 500 * 2 ** i));
        continue;
      }
      await noteFailure(p, err);
      // A dropped server is replaced at once by current(); otherwise wait before retrying.
      if (pinned() || !isDown(p)) await sleep(Math.min(8000, 500 * 2 ** i) + (pinned() ? penalty : 0));
    }
    throw err;
  }

  async function fees() {
    try {
      await current();
    } catch (_) {
      return null;
    }
    const order = pinned() ? [active] : [active, ...providers.filter((p) => p !== active && !isDown(p))];
    for (const p of order) {
      try {
        const path = p.fees === "mempool" ? "/v1/fees/recommended" : "/fee-estimates";
        const res = await timed(p.base + path, {}, 10000);
        if (!res.ok) continue;
        const f = parseFees(p.fees, res.text);
        if (f) return f;
      } catch (_) {}
    }
    return null;
  }

  // Send a signed transaction. Never retried blindly: with no answer we cannot know whether
  // it went through (kind "noanswer"). Another server is tried only after an explicit refusal.
  async function broadcast(txHex, { exclude = [], manual = false } = {}) {
    let order;
    if (manual) order = providers.filter((p) => !exclude.includes(p.id));
    else {
      const a = await current();
      order = pinned() ? [a] : [a, ...providers.filter((p) => p !== a)];
      order = order.filter((p) => !exclude.includes(p.id));
    }
    let first = null;
    for (const p of order) {
      let res;
      try {
        res = await timed(`${p.base}/tx`, { method: "POST", body: txHex }, BROADCAST_TIMEOUT_MS);
      } catch (e) {
        throw new NetError("noanswer", String((e && e.message) || e), p);
      }
      if (res.ok) return { txid: res.text.trim(), provider: p };
      if (res.status === 502 || res.status === 503 || res.status === 504)
        throw new NetError("noanswer", `HTTP ${res.status}`, p, res.status); // gateway: unknown outcome
      first = first || new NetError("rejected", res.text.slice(0, 300) || `HTTP ${res.status}`, p, res.status);
    }
    throw first || new NetError("none", "no server left to try");
  }

  return {
    providers,
    request,
    fees,
    broadcast,
    probe,
    current,
    getActive: () => active,
    getMode: () => mode,
    getPenalty: () => penalty,
    setMode(m) {
      mode = m === "auto" || byId(m) ? m : "auto";
      gen++;
      active = null;
      down.clear();
      fails.clear();
      penalty = 0;
      emit({ reason: "mode" });
    },
    // After a long pause: forget "down" marks and measure again.
    revive() {
      gen++;
      active = null;
      down.clear();
      fails.clear();
      penalty = 0;
    },
    txLink: (txid, p) => (p || active || providers[0]).tx + txid,
  };
}

// Plain-language reason for a failure, for status lines.
export function reasonText(e) {
  switch (e && e.kind) {
    case "limit":
      return "request limit reached (HTTP 429)";
    case "blocked":
      return "access blocked (HTTP 403)";
    case "server":
      return "server error (HTTP " + (e.status || "5xx") + ")";
    case "bad":
      return "unexpected answer";
    default:
      return "no connection";
  }
}
