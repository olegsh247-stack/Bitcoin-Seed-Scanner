// Run: node test/e2e.test.mjs   (after `npm run build`)
// Loads the REAL built index.html in jsdom with a mocked mempool.space API and
// drives the UI: scan -> select -> prepare -> sign -> broadcast. No network, no real funds.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import * as bip39 from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import { PATHS } from "../src/lib.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const MN =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const DEST = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const FAKE_TXID = "ab".repeat(32);

let n = 0;
const ok = (name) => console.log("ok -", ++n, name);

// ---- static checks on the built file ---------------------------------------
{
  assert.ok(!/<script[^>]+src=/i.test(html), "no external <script src>");
  assert.ok(!/esm\.sh|unpkg|jsdelivr|cdnjs/i.test(html), "no CDN references");
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, "inline script present");
  const hash = createHash("sha256").update(m[1]).digest("base64");
  assert.ok(html.includes(`script-src 'sha256-${hash}'`), "CSP hash matches the inline script");
  assert.ok(
    html.includes("connect-src https://mempool.space"),
    "CSP limits network to mempool.space",
  );
  ok("built file: no CDN, CSP hash matches the inline script");
}

// ---- helpers ---------------------------------------------------------------
const root0 = HDKey.fromMasterSeed(bip39.mnemonicToSeedSync(MN, ""));
const addrAt = (purpose, chain, i) => {
  const p = PATHS.find((x) => x.purpose === purpose);
  return p.makePayment(root0.derive(`m/${purpose}'/0'/0'/${chain}/${i}`).publicKey);
};

function prevTxFor(payment, amount) {
  const raw = btc.RawTx.encode({
    version: 2,
    inputs: [
      {
        txid: new Uint8Array(32).fill(1),
        index: 0,
        finalScriptSig: new Uint8Array(),
        sequence: 0xffffffff,
      },
    ],
    outputs: [{ amount, script: payment.script }],
    lockTime: 0,
  });
  const d = createHash("sha256").update(createHash("sha256").update(raw).digest()).digest();
  return { raw, txid: Buffer.from(d).reverse().toString("hex") };
}

function boot(handler) {
  const posted = [];
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "https://localhost/",
    beforeParse(w) {
      w.crypto ??= webcrypto;
      w.TextEncoder ??= TextEncoder;
      w.TextDecoder ??= TextDecoder;
      w.setTimeout = (fn) => setImmediate(fn); // make backoff/pauses instant
      w.confirm = () => true;
      w.fetch = async (url, init = {}) => {
        const r = await handler(String(url), init, posted);
        return {
          ok: r.status >= 200 && r.status < 300,
          status: r.status,
          statusText: String(r.status),
          json: async () => r.json,
          text: async () => (r.text !== undefined ? r.text : JSON.stringify(r.json)),
        };
      };
    },
  });
  return { dom, w: dom.window, d: dom.window.document, posted };
}
const until = async (cond, ms = 15000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 5));
  }
};
const click = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.Event("click"));
const type = (el, v) => {
  el.value = v;
  el.dispatchEvent(new el.ownerDocument.defaultView.Event("input"));
};

// Funded wallet: one legacy and one native-segwit address, both "used".
const LEGACY = addrAt(44, 0, 0);
const SEGWIT = addrAt(84, 0, 2);
const LEGACY_PREV = prevTxFor(LEGACY, 100_000n);
const SEGWIT_UTXO = { txid: "cd".repeat(32), vout: 1, value: 150_000 };

const mempool = async (url, init, posted) => {
  const u = url.replace("https://mempool.space/api", "");
  if (u.startsWith("/v1/fees/recommended"))
    return { status: 200, json: { fastestFee: 9, halfHourFee: 7, hourFee: 5 } };
  if (init.method === "POST" && u === "/tx") {
    posted.push(init.body);
    return { status: 200, text: FAKE_TXID };
  }
  let m;
  if ((m = u.match(/^\/address\/([^/]+)\/utxo$/))) {
    if (m[1] === LEGACY.address)
      return { status: 200, json: [{ txid: LEGACY_PREV.txid, vout: 0, value: 100_000 }] };
    if (m[1] === SEGWIT.address) return { status: 200, json: [SEGWIT_UTXO] };
    return { status: 200, json: [] };
  }
  if ((m = u.match(/^\/address\/([^/]+)$/))) {
    const stat = (funded, spent, txs) => ({
      chain_stats: { funded_txo_sum: funded, spent_txo_sum: spent, tx_count: txs },
      mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: 0 },
    });
    if (m[1] === LEGACY.address) return { status: 200, json: stat(100_000, 0, 1) };
    if (m[1] === SEGWIT.address) return { status: 200, json: stat(150_000, 0, 1) };
    return { status: 200, json: stat(0, 0, 0) };
  }
  if ((m = u.match(/^\/tx\/([0-9a-f]{64})\/hex$/)) && m[1] === LEGACY_PREV.txid)
    return { status: 200, text: hex.encode(LEGACY_PREV.raw) };
  return { status: 404, text: "not found" };
};

async function scan(ctx, { account = "0" } = {}) {
  const { d } = ctx;
  type(d.getElementById("mnemonic"), MN);
  d.getElementById("gap").value = "5";
  d.getElementById("account").value = account;
  click(d.getElementById("scanBtn"));
  await until(() => !d.getElementById("scanBtn").disabled);
}

// ---- 1. scan finds funds across address types, past used addresses ---------
const ctx = boot(mempool);
await scan(ctx);
{
  const { d } = ctx;
  const rows = [...d.querySelectorAll("#tbody tr")];
  assert.equal(rows.length, 2, "two funded addresses found");
  const text = rows.map((r) => r.textContent).join("|");
  assert.ok(text.includes(LEGACY.address) && text.includes(SEGWIT.address));
  // SEGWIT is at index 2 and is *used*, so the scan must continue 5 more addresses past it.
  assert.match(d.getElementById("status").textContent, /Found 2 address/);
  assert.equal(d.getElementById("status").className, "status ok");
  ok("scan finds legacy + native segwit funds, gap limit continues past used addresses");
}

// ---- 2. send from native segwit -------------------------------------------
async function send(ctx, address, amount, expectInputs) {
  const { d, posted } = ctx;
  const btn = [...d.querySelectorAll("#tbody button")].find((b) =>
    b.closest("tr").textContent.includes(address),
  );
  click(btn);
  type(d.getElementById("toAddress"), DEST);
  type(d.getElementById("amount"), amount);
  d.getElementById("feeRate").value = "5";
  click(d.getElementById("prepareBtn"));
  await until(
    () =>
      d.getElementById("confirmArea").style.display === "block" ||
      /error/i.test(d.getElementById("sendStatus").textContent),
  );
  assert.equal(
    d.getElementById("confirmArea").style.display,
    "block",
    d.getElementById("sendStatus").textContent,
  );
  type(d.getElementById("confirmText"), DEST.slice(-6));
  assert.equal(d.getElementById("broadcastBtn").disabled, false);
  click(d.getElementById("broadcastBtn"));
  await until(() => /Sent successfully|error/i.test(d.getElementById("sendStatus").textContent));
  assert.match(d.getElementById("sendStatus").textContent, /Sent successfully/);
  assert.ok(d.querySelector("#sendStatus a").href.endsWith(FAKE_TXID));
  const raw = posted[posted.length - 1];
  const tx = btc.Transaction.fromRaw(hex.decode(raw));
  assert.equal(tx.inputsLength, expectInputs);
  assert.equal(tx.getOutput(0).amount, BigInt(Math.round(parseFloat(amount) * 1e8)));
  assert.equal(btc.Address(btc.NETWORK).encode(btc.OutScript.decode(tx.getOutput(0).script)), DEST);
  return tx;
}

await send(ctx, SEGWIT.address, "0.001", 1);
ok("native segwit: prepare -> sign -> broadcast, output matches request");

// ---- 3. send from LEGACY (this path was broken before) ---------------------
{
  const tx = await send(ctx, LEGACY.address, "0.0005", 1);
  assert.ok(tx.getOutput(1), "change output present");
  ok("legacy BIP44: prepare -> sign -> broadcast works (fetches previous tx)");
}

// ---- 4. input validation ----------------------------------------------------
{
  const { d } = ctx;
  const btn = d.querySelector("#tbody button");
  click(btn);
  const tryPrepare = async (to, amount, fee = "5") => {
    type(d.getElementById("toAddress"), to);
    type(d.getElementById("amount"), amount);
    d.getElementById("feeRate").value = fee;
    d.getElementById("sendStatus").textContent = "";
    click(d.getElementById("prepareBtn"));
    await until(
      () =>
        !/^(|Fetching.*)$/.test(d.getElementById("sendStatus").textContent) ||
        d.getElementById("confirmArea").style.display === "block",
    );
    return d.getElementById("sendStatus").textContent;
  };
  d.getElementById("confirmArea").style.display = "none";
  assert.match(await tryPrepare(DEST.slice(0, -1) + "p", "0.001"), /valid Bitcoin mainnet address/);
  assert.match(await tryPrepare(DEST, "0.0000000001"), /up to 8 decimals/);
  assert.match(await tryPrepare(DEST, "abc"), /up to 8 decimals/);
  assert.match(await tryPrepare(DEST, "0"), /greater than zero/);
  assert.match(await tryPrepare(DEST, "0.00000300"), /dust/);
  assert.match(await tryPrepare(DEST, "0.001", "5000"), /typo/);
  assert.match(await tryPrepare(DEST, "5"), /Not enough funds/);
  ok("bad address, bad amounts, dust, absurd fee and overspend are all rejected");
}

// ---- 5. Clear wipes everything ---------------------------------------------
{
  const { d } = ctx;
  click(d.getElementById("clearBtn"));
  assert.equal(d.getElementById("mnemonic").value, "");
  assert.equal(d.querySelectorAll("#tbody tr").length, 0);
  assert.equal(d.getElementById("resultsCard").style.display, "none");
  ok("Clear all wipes seed, results and form");
}

// ---- 6. API outage must NOT look like "no funds" ---------------------------
{
  const dead = boot(async (url) =>
    url.includes("/v1/fees") ? { status: 500, text: "" } : { status: 500, text: "boom" },
  );
  await scan(dead);
  const s = dead.d.getElementById("status");
  assert.match(s.textContent, /not responding/i);
  assert.equal(s.className, "status err");
  assert.ok(!/No funds found/.test(s.textContent), "must not claim 'No funds found'");
  assert.notEqual(dead.d.getElementById("resultsCard").style.display, "block");
  ok("total API outage is reported as an error, not as 'No funds found'");
}

// ---- 7. transient 429s are retried and partial failures are flagged --------
{
  let hits = 0;
  const flaky = boot(async (url, init, posted) => {
    if (url.includes(`/address/${LEGACY.address}`) && !url.endsWith("/utxo") && hits++ < 2)
      return { status: 429, text: "slow down" };
    return mempool(url, init, posted);
  });
  await scan(flaky);
  assert.equal(flaky.d.querySelectorAll("#tbody tr").length, 2, "funds still found after retries");
  assert.match(flaky.d.getElementById("status").textContent, /Found 2 address/);
  ok("HTTP 429 is retried and the funded address is still found");
}

// ---- 8. account number is honoured -----------------------------------------
{
  const asked = new Set();
  const acct = boot(async (url, init, posted) => {
    asked.add(url);
    return mempool(url, init, posted);
  });
  await scan(acct, { account: "1" });
  const acc1 = PATHS.map(
    (p) => p.makePayment(root0.derive(`m/${p.purpose}'/0'/1'/0/0`).publicKey).address,
  );
  for (const a of acc1)
    assert.ok(
      asked.has(`https://mempool.space/api/address/${a}`),
      `queried account 1 address ${a}`,
    );
  assert.ok(
    !asked.has(`https://mempool.space/api/address/${LEGACY.address}`),
    "did not query account 0",
  );
  ok("account number selects the right derivation path");
}

// ---- 9. language switching (upstream i18n) keeps working ------------------
{
  const L = boot(mempool);
  const { d } = L;
  const pick = (code) => click(d.querySelector(`.lang-btn[data-lang="${code}"]`));
  pick("ru");
  assert.match(d.getElementById("critBox").textContent, /Компьютер может быть заражён/);
  assert.equal(d.getElementById("accountLabel").textContent, "Номер аккаунта");
  assert.match(d.getElementById("gapHint").textContent, /подряд неиспользованных/);
  assert.equal(d.documentElement.lang, "ru");
  await scan(L);
  assert.equal(d.querySelector("#tbody button").textContent, "Выбрать");
  pick("fr");
  assert.match(d.getElementById("accountLabel").textContent, /compte/);
  pick("es");
  assert.match(d.getElementById("accountLabel").textContent, /cuenta/);
  pick("en");
  assert.equal(d.getElementById("accountLabel").textContent, "Account number");
  assert.equal(d.getElementById("seedLabel").textContent, "Seed (12 or 24 words)");
  ok("EN/RU/ES/FR switching translates critical box, labels, gap hint and Select button");
}

console.log(`\n${n} e2e checks passed`);
process.exit(0);
