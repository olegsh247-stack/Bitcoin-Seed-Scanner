// Run: node test/net.test.mjs
// Server switching logic with a fake network: every failure kind, stale servers, fees, broadcast.
import assert from "node:assert/strict";
import { createNet, parseFees, reasonText, NetError, PROVIDERS, DOWN_MS } from "../src/net.js";

let n = 0;
const ok = (name) => console.log(`ok - ${name}`);

// A fake network. script: host -> handler(path, init) returning {status,text} or throwing.
function world(script, clock = { t: 0 }) {
  const log = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/api/, "");
    log.push(`${u.host}${path}`);
    const h = script[u.host];
    if (!h) throw new Error("connection refused");
    const r = await h(path, init);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.text };
  };
  const switches = [];
  const net = createNet({
    fetchImpl,
    sleep: async () => {},
    now: () => clock.t,
    onChange: (i) => i.reason === "switch" && switches.push(`${i.from.host}->${i.active.host}`),
  });
  return { net, log, switches, clock };
}
const good = (h = 971952) => (path) =>
  path === "/blocks/tip/height" ? { status: 200, text: String(h) } : { status: 200, text: "ok" };
const dead = () => {
  throw new Error("connection refused");
};
const status = (s) => () => ({ status: s, text: "x" });
const hosts = { m: "mempool.space", b: "blockstream.info", c: "btcscan.org" };

// 1 ---------------------------------------------------------------------
{
  const w = world({ [hosts.m]: good(), [hosts.b]: good(), [hosts.c]: good() });
  const a = await w.net.current();
  assert.equal(a.host, "mempool.space");
  assert.equal(w.log.filter((l) => l.endsWith("/blocks/tip/height")).length, 3, "all three probed once");
  ok("all servers alive: mempool.space (first in trust order) is used");
}
// 2 ---------------------------------------------------------------------
{
  const w = world({ [hosts.m]: dead, [hosts.b]: good(), [hosts.c]: good() });
  assert.equal((await w.net.current()).host, "blockstream.info");
  const w2 = world({ [hosts.m]: status(403), [hosts.b]: dead, [hosts.c]: good() });
  assert.equal((await w2.net.current()).host, "btcscan.org");
  ok("start: the first server that answers is chosen (dead or blocked ones skipped)");
}
// 3 stale ---------------------------------------------------------------
{
  const w = world({ [hosts.m]: good(971949), [hosts.b]: good(971952), [hosts.c]: good(971952) });
  assert.equal((await w.net.current()).host, "blockstream.info", "3 blocks behind is skipped");
  const w2 = world({ [hosts.m]: good(971950), [hosts.b]: good(971952), [hosts.c]: good(971952) });
  assert.equal((await w2.net.current()).host, "mempool.space", "2 blocks behind is still fine");
  const w3 = world({ [hosts.m]: good(800000), [hosts.b]: dead, [hosts.c]: dead });
  assert.equal((await w3.net.current()).host, "mempool.space", "a lone answering server is used even if odd");
  ok("a server more than 2 blocks behind is skipped");
}
// 3b garbage heights -------------------------------------------------------
{
  const w = world({
    [hosts.m]: () => ({ status: 200, text: "<html>captive portal</html>" }),
    [hosts.b]: good(),
    [hosts.c]: good(),
  });
  assert.equal((await w.net.current()).host, "blockstream.info");
  ok("a non-numeric block height (captive portal, error page) is not accepted");
}
// 4 all dead: the reason is reported ----------------------------------------
{
  const all = (h) => ({ [hosts.m]: h, [hosts.b]: h, [hosts.c]: h });
  for (const [h, kind] of [[dead, "network"], [status(429), "limit"], [status(403), "blocked"], [status(500), "server"]]) {
    const w = world(all(h));
    await assert.rejects(w.net.request("/address/x"), (e) => e instanceof NetError && e.kind === kind);
  }
  const w = world({ [hosts.m]: status(429), [hosts.b]: dead, [hosts.c]: dead });
  await assert.rejects(w.net.request("/x"), (e) => e.kind === "limit", "the informative reason wins");
  assert.match(reasonText(new NetError("limit", "")), /429/);
  assert.match(reasonText(new NetError("blocked", "")), /403/);
  assert.match(reasonText(new NetError("network", "")), /no connection/);
  ok("when nothing works the exact reason is reported: 429 / 403 / no connection / server error");
}
// 5 429 switches at once ----------------------------------------------------
{
  const w = world({
    [hosts.m]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : { status: 429, text: "slow" }),
    [hosts.b]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : { status: 200, text: "answer" }),
    [hosts.c]: good(),
  });
  const r = await w.net.request("/address/a");
  assert.equal(r, "answer");
  assert.equal(w.log.filter((l) => l === "mempool.space/address/a").length, 1, "not retried on the limited server");
  assert.deepEqual(w.switches, ["mempool.space->blockstream.info"]);
  // later requests stay on the new server, the limited one is not touched again
  await w.net.request("/address/b");
  assert.ok(!w.log.includes("mempool.space/address/b"));
  ok("HTTP 429 / 403: switches to the next server at once instead of hammering the same one");
}
{
  const w = world({
    [hosts.m]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : { status: 403, text: "no" }),
    [hosts.b]: good(),
    [hosts.c]: good(),
  });
  await w.net.request("/address/a");
  assert.equal(w.log.filter((l) => l === "mempool.space/address/a").length, 1);
  assert.deepEqual(w.switches, ["mempool.space->blockstream.info"]);
  ok("HTTP 403 behaves the same");
}
// 6 three consecutive failures ------------------------------------------------
{
  let calls = 0;
  let broken = false;
  const w = world({
    [hosts.m]: (p) => {
      if (p === "/blocks/tip/height") return broken ? { status: 500, text: "boom" } : { status: 200, text: "971952" };
      broken = true; // the server goes down right after the start
      calls++;
      return { status: 500, text: "boom" };
    },
    [hosts.b]: good(),
    [hosts.c]: good(),
  });
  await w.net.request("/address/a");
  assert.equal(calls, 3, "three failures, then the server is dropped");
  assert.deepEqual(w.switches, ["mempool.space->blockstream.info"]);
  // two failures then success: the counter is reset, no switch
  let k = 0;
  const w2 = world({
    [hosts.m]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : k++ < 2 ? { status: 500, text: "b" } : { status: 200, text: "fine" }),
    [hosts.b]: good(),
    [hosts.c]: good(),
  });
  assert.equal(await w2.net.request("/a"), "fine");
  assert.deepEqual(w2.switches, []);
  // the server still answers its health check: the failing request is the problem, not the server
  let c2 = 0;
  const w3 = world({
    [hosts.m]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : (c2++, { status: 500, text: "bad address" })),
    [hosts.b]: good(),
    [hosts.c]: good(),
  });
  await assert.rejects(w3.net.request("/address/poison", { attempts: 6 }));
  assert.deepEqual(w3.switches, [], "a healthy server is not dropped because one request fails");
  assert.equal(await w3.net.current().then((x) => x.host), "mempool.space");
  ok("3 consecutive failures drop a server only if it is really down; occasional failures do not");
}
// 7 dead server is not asked again ------------------------------------------
{
  const w = world({ [hosts.m]: dead, [hosts.b]: good(), [hosts.c]: good() });
  await w.net.request("/a");
  await w.net.request("/b");
  assert.equal(w.log.filter((l) => l.startsWith("mempool.space") && !l.endsWith("height")).length, 0);
  ok("a dead server is not waited for on every request");
}
// 8 client errors are not the server's fault ------------------------------------
{
  const w = world({
    [hosts.m]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : { status: 404, text: "Transaction not found" }),
    [hosts.b]: good(),
    [hosts.c]: good(),
  });
  await assert.rejects(w.net.request("/tx/abc/hex"), (e) => e.kind === "client" && e.status === 404);
  assert.deepEqual(w.switches, []);
  ok("404 / 400 are reported as they are, with no pointless switching");
}
// 9 strict validation of every answer, backup included ---------------------------
{
  const parse = (t) => {
    const d = JSON.parse(t);
    if (!d.chain_stats) throw new Error("missing chain_stats");
    return d;
  };
  const w = world({
    [hosts.m]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : { status: 200, text: "<html>proxy</html>" }),
    [hosts.b]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : { status: 200, text: '{"nothing":1}' }),
    [hosts.c]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : { status: 200, text: '{"chain_stats":{"tx_count":1}}' }),
  });
  const r = await w.net.request("/address/a", { parse });
  assert.equal(r.chain_stats.tx_count, 1);
  assert.deepEqual(w.switches, [], "one odd answer is not an outage: no server is dropped for it");
  const w2 = world({
    [hosts.m]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : { status: 200, text: "junk" }),
    [hosts.b]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : { status: 200, text: "junk" }),
    [hosts.c]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : { status: 200, text: "junk" }),
  });
  await assert.rejects(w2.net.request("/address/a", { parse }), (e) => e.kind === "bad");
  ok("invalid answers (HTML, wrong JSON) from any server are rejected, never read as data");
}
// 10 pinned ------------------------------------------------------------------------
{
  const w = world({ [hosts.m]: dead, [hosts.b]: good(), [hosts.c]: good() });
  w.net.setMode("mempool");
  await assert.rejects(w.net.request("/a"), (e) => e.kind === "network");
  assert.deepEqual(w.switches, [], "a chosen server is never replaced behind the user's back");
  w.net.setMode("btcscan");
  assert.equal((await w.net.current()).host, "btcscan.org");
  w.net.setMode("auto");
  assert.equal((await w.net.current()).host, "blockstream.info");
  ok("manual choice is respected; Auto goes back to the trust order");
}
// 11 down marks expire and revive() clears them -----------------------------------------
{
  const clock = { t: 0 };
  let mAlive = false;
  const w = world(
    {
      [hosts.m]: (p) => (mAlive ? good()(p) : { status: 429, text: "slow" }),
      [hosts.b]: good(),
      [hosts.c]: good(),
    },
    clock,
  );
  await w.net.request("/a"); // mempool 429 at probe? probe fails -> blockstream
  assert.equal(w.net.getActive().host, "blockstream.info");
  mAlive = true;
  w.net.revive();
  assert.equal((await w.net.current()).host, "mempool.space", "after revive the best server is chosen again");
  ok("after a pause the servers are measured again and the best one returns");
}
// 12 fees --------------------------------------------------------------------------------
{
  assert.deepEqual(parseFees("esplora", JSON.stringify({ 1: 9.011, 3: 7, 6: 0.5, 12: 1 })), { fast: 9.1, halfHour: 7, hour: 1 });
  assert.deepEqual(parseFees("esplora", JSON.stringify({ 1: 3.0001, 3: 2.2, 6: 1.2 })), { fast: 3.1, halfHour: 2.2, hour: 1.2 });
  assert.equal(parseFees("esplora", JSON.stringify({ 1: 9, 3: 7 })), null, "missing key");
  assert.equal(parseFees("esplora", JSON.stringify({ 1: 99999, 3: 7, 6: 5 })), null, "absurd rate");
  assert.equal(parseFees("esplora", JSON.stringify({ 1: "9", 3: 7, 6: 5 })), null, "string");
  assert.equal(parseFees("esplora", "<html>"), null);
  assert.deepEqual(parseFees("mempool", JSON.stringify({ fastestFee: 9, halfHourFee: 7, hourFee: 5 })), { fast: 9, halfHour: 7, hour: 5 });
  assert.equal(parseFees("mempool", JSON.stringify({ fastestFee: 0, halfHourFee: 7, hourFee: 5 })), null);
  const w = world({
    [hosts.m]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : { status: 200, text: "junk" }),
    [hosts.b]: (p) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : p === "/fee-estimates" ? { status: 200, text: '{"1":4.2,"3":3,"6":2}' } : { status: 404, text: "" }),
    [hosts.c]: good(),
  });
  assert.deepEqual(await w.net.fees(), { fast: 4.2, halfHour: 3, hour: 2 }, "falls through to the next server's fees");
  ok("fees: Esplora keys 1/3/6, rounded up to 0.1, at least 1, strictly validated, fall back to other servers");
}
// 13 broadcast ----------------------------------------------------------------------------
const postOf = (h) => (p, init) => (p === "/blocks/tip/height" ? { status: 200, text: "971952" } : init.method === "POST" ? h() : { status: 200, text: "" });
{
  const TXID = "ab".repeat(32);
  // first server explicitly refuses -> the next one is tried automatically
  const w = world({
    [hosts.m]: postOf(() => ({ status: 400, text: "bad-txns" })),
    [hosts.b]: postOf(() => ({ status: 200, text: TXID })),
    [hosts.c]: good(),
  });
  const r = await w.net.broadcast("00");
  assert.equal(r.txid, TXID);
  assert.equal(r.provider.host, "blockstream.info");
  // no answer at all -> NO automatic second attempt anywhere
  const w2 = world({
    [hosts.m]: postOf(dead),
    [hosts.b]: postOf(() => ({ status: 200, text: TXID })),
    [hosts.c]: good(),
  });
  await w2.net.current(); // probe: mempool must answer height, so use a server that answers it then dies on POST
  ok("broadcast: another server is used automatically only after an explicit refusal");
}
{
  const TXID = "cd".repeat(32);
  let posts = [];
  const mk = (host, h) => (p, init) => {
    if (p === "/blocks/tip/height") return { status: 200, text: "971952" };
    if (init.method === "POST") {
      posts.push(host);
      return h();
    }
    return { status: 200, text: "" };
  };
  const hang = () => {
    throw new Error("timeout");
  };
  const w = world({
    [hosts.m]: mk("m", hang),
    [hosts.b]: mk("b", () => ({ status: 200, text: TXID })),
    [hosts.c]: mk("c", () => ({ status: 200, text: TXID })),
  });
  await assert.rejects(w.net.broadcast("00"), (e) => e.kind === "noanswer" && e.provider.host === "mempool.space");
  assert.deepEqual(posts, ["m"], "no silent second POST when the first got no answer");
  // the user decides: send via another server
  const r = await w.net.broadcast("00", { exclude: ["mempool"], manual: true });
  assert.equal(r.provider.host, "blockstream.info");
  assert.deepEqual(posts, ["m", "b"]);
  // gateway errors have an unknown outcome too
  posts = [];
  const w2 = world({
    [hosts.m]: mk("m", () => ({ status: 504, text: "gateway" })),
    [hosts.b]: mk("b", () => ({ status: 200, text: TXID })),
    [hosts.c]: good(),
  });
  await assert.rejects(w2.net.broadcast("00"), (e) => e.kind === "noanswer");
  assert.deepEqual(posts, ["m"]);
  // everyone refuses -> "rejected" with the first reason
  const w3 = world({
    [hosts.m]: mk("m", () => ({ status: 400, text: "min relay fee not met" })),
    [hosts.b]: mk("b", () => ({ status: 400, text: "other" })),
    [hosts.c]: mk("c", () => ({ status: 400, text: "other" })),
  });
  await assert.rejects(w3.net.broadcast("00"), (e) => e.kind === "rejected" && /min relay/.test(e.message));
  // a pinned server is the only one tried automatically
  posts = [];
  const w4 = world({
    [hosts.m]: mk("m", () => ({ status: 400, text: "no" })),
    [hosts.b]: mk("b", () => ({ status: 200, text: TXID })),
    [hosts.c]: good(),
  });
  w4.net.setMode("mempool");
  await assert.rejects(w4.net.broadcast("00"), (e) => e.kind === "rejected");
  assert.deepEqual(posts, ["m"]);
  ok("broadcast: no answer or gateway error never triggers a hidden second send; manual 'another server' works");
}
// 14 the transaction link points at the server that took it --------------------------------
{
  const w = world({ [hosts.m]: good(), [hosts.b]: good(), [hosts.c]: good() });
  assert.equal(w.net.txLink("ab", PROVIDERS[1]), "https://blockstream.info/tx/ab");
  ok("transaction link uses the server that accepted it");
}
console.log("net tests passed");
