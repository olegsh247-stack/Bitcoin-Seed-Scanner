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
import { wordlist } from "@scure/bip39/wordlists/english";
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
  assert.ok(
    !/TVXzchq|0x761B5365|1GgXo15B|3B6wA2Yu|bc1qy9ht50|bc1q56kmyw|bc1p6wk0ec/.test(html),
    "no donation addresses inside the app",
  );
  assert.ok(html.includes("github.com/olegsh247-stack/Bitcoin-Seed-Scanner#gratitude"));
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

// Fill the per-word boxes (switching to 24 boxes when needed) and fire the input handler.
const fillSeed = (d, phrase) => {
  const w = phrase.split(" ");
  if (w.length === 24) click(d.querySelector('.wc-btn[data-count="24"]'));
  if (w.length === 12) click(d.querySelector('.wc-btn[data-count="12"]'));
  const boxes = [...d.querySelectorAll("#seedGrid input")];
  assert.equal(boxes.length, w.length);
  boxes.forEach((b, i) => (b.value = w[i]));
  boxes[0].dispatchEvent(new d.defaultView.Event("input"));
};

async function scan(ctx, { account = "0" } = {}) {
  const { d } = ctx;
  fillSeed(d, MN);
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
  assert.ok([...d.querySelectorAll("#seedGrid input")].every((b) => b.value === ""));
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

// ---- 6b. a temporary outage is waited out instead of aborting the scan ------
{
  let calls = 0;
  const waits = [];
  const patient = boot(async (url, init, posted) => {
    if (/\/address\/[^/]+$/.test(url) && calls++ < 40) return { status: 500, text: "boom" }; // 10 lookups x 4 tries
    return mempool(url, init, posted);
  });
  const obs = new patient.w.MutationObserver(() => {
    const t = patient.d.getElementById("status").textContent;
    if (/Waiting \d+s/.test(t) && !waits.includes(t.replace(/\d+s,/, "Ns,"))) waits.push(t.replace(/\d+s,/, "Ns,"));
  });
  obs.observe(patient.d.getElementById("status"), { childList: true, characterData: true, subtree: true });
  await scan(patient);
  assert.ok(waits.length >= 1, "showed a waiting message");
  assert.equal(patient.d.querySelectorAll("#tbody tr").length, 2, "funds found after the outage ended");
  assert.ok(!/not responding/.test(patient.d.getElementById("status").textContent));
  ok("temporary outage: scan pauses, continues and re-checks instead of aborting");
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

// ---- 7b. failed lookups are re-checked automatically; warn only if still unchecked
{
  let n = 0;
  const hiccup = boot(async (url, init, posted) => {
    // First lookup fails all 4 attempts, the automatic re-check then succeeds.
    if (url.endsWith(`/address/${LEGACY.address}`) && n++ < 4) return { status: 429, text: "slow" };
    return mempool(url, init, posted);
  });
  await scan(hiccup);
  const st = hiccup.d.getElementById("status").textContent;
  assert.ok(!/Warning/.test(st), `no warning once the re-check succeeds: ${st}`);
  assert.equal(hiccup.d.querySelectorAll("#tbody tr").length, 2, "funds found via re-check");
  const stuck = boot(async (url, init, posted) => {
    if (url.endsWith(`/address/${LEGACY.address}`)) return { status: 429, text: "slow" };
    return mempool(url, init, posted);
  });
  await scan(stuck);
  assert.match(stuck.d.getElementById("status").textContent, /Warning: 1 of \d+ address lookups could not be checked/);
  ok("failed lookups are re-checked automatically; warning only if some stay unchecked");
}

// ---- 7e. connection robustness: hangs and malformed answers -----------------
{
  // A request that never answers is cut off by the app's own time limit.
  const hang = (init) =>
    new Promise((_, reject) =>
      init.signal.addEventListener("abort", () => reject(new Error("aborted"))),
    );
  const isLegacyLookup = (u) => u.endsWith(`/address/${LEGACY.address}`);

  const hung = boot(async (url, init, posted) =>
    isLegacyLookup(url) ? hang(init) : mempool(url, init, posted),
  );
  await scan(hung);
  assert.match(hung.d.getElementById("status").textContent, /Warning: 1 of \d+ address lookups/);
  assert.equal(hung.d.querySelectorAll("#tbody tr").length, 1, "other funds are still found");

  for (const bad of [{}, { error: "busy" }, { chain_stats: {} }, [], "oops"]) {
    const odd = boot(async (url, init, posted) =>
      isLegacyLookup(url) ? { status: 200, json: bad } : mempool(url, init, posted),
    );
    await scan(odd);
    const st = odd.d.getElementById("status").textContent;
    assert.match(st, /Warning: 1 of/, `malformed 200 ${JSON.stringify(bad)} must not read as empty: ${st}`);
    assert.ok(!/No funds found/.test(st));
  }

  // address check: a hanging server ends in a clear message, not "Checking…" forever
  const hungCheck = boot(async (url, init, posted) =>
    url.endsWith(`/address/${SEGWIT.address}`) ? hang(init) : mempool(url, init, posted),
  );
  type(hungCheck.d.getElementById("addrInput"), SEGWIT.address);
  click(hungCheck.d.getElementById("addrCheckBtn"));
  await until(() => /Could not get the balance/.test(hungCheck.d.getElementById("addrResult").textContent));

  // broadcast with no answer: tell the user the tx may have gone out, offer no blind retry
  const noAns = boot(async (url, init, posted) =>
    init.method === "POST" && url.endsWith("/tx") ? hang(init) : mempool(url, init, posted),
  );
  await scan(noAns);
  const { d } = noAns;
  click([...d.querySelectorAll("#tbody button")].find((b) => b.closest("tr").textContent.includes(SEGWIT.address)));
  type(d.getElementById("toAddress"), DEST);
  type(d.getElementById("amount"), "0.001");
  d.getElementById("feeRate").value = "5";
  click(d.getElementById("prepareBtn"));
  await until(() => d.getElementById("confirmArea").style.display === "block");
  type(d.getElementById("confirmText"), DEST.slice(-6));
  click(d.getElementById("broadcastBtn"));
  await until(() => /may already have been sent/.test(d.getElementById("sendStatus").textContent));
  assert.equal(d.getElementById("confirmArea").style.display, "none", "no blind retry offered");
  assert.equal(noAns.posted.length, 0);
  ok("hung requests time out, malformed 200s are never 'no funds', unanswered broadcast is not retried");
}

// ---- 7c. address check block ----------------------------------------------
{
  const asked = [];
  const chk = boot(async (url, init, posted) => {
    asked.push(url);
    if (url.endsWith(`/address/${SEGWIT.address}`))
      return {
        status: 200,
        json: {
          chain_stats: { funded_txo_sum: 150_000, spent_txo_sum: 0, tx_count: 1 },
          mempool_stats: {},
        },
      };
    return mempool(url, init, posted);
  });
  const { d } = chk;
  const go = async (v, cond) => {
    type(d.getElementById("addrInput"), v);
    click(d.getElementById("addrCheckBtn"));
    await until(cond);
  };
  const res = () => d.getElementById("addrResult").textContent;
  await go(`  ${SEGWIT.address} `, () => /0\.00150000 BTC/.test(res()));
  assert.match(res(), /Native SegWit \(BIP84\)/);
  assert.ok(res().includes(SEGWIT.address));
  await go("bc1qinvalidaddress", () => /Invalid address/.test(res()));
  assert.ok(!/Balance/.test(res()), "no balance shown for an invalid address");
  assert.ok(!asked.some((u) => u.includes("bc1qinvalidaddress")), "invalid address is never sent");
  const dead = boot(async () => ({ status: 500, text: "boom" }));
  type(dead.d.getElementById("addrInput"), SEGWIT.address);
  click(dead.d.getElementById("addrCheckBtn"));
  await until(() => /try again/.test(dead.d.getElementById("addrResult").textContent));
  assert.match(dead.d.getElementById("addrResult").textContent, /Could not get the balance/);
  // language switch re-renders the result
  click(d.querySelector('.lang-btn[data-lang="ru"]'));
  await go(SEGWIT.address, () => /Баланс/.test(res()));
  assert.equal(d.getElementById("addrTitle").textContent, "Проверка адреса (если известен)");
  // layout: info blocks left; address check first in the left column, seed on the right
  const left = [...d.querySelectorAll(".col-left > *")].map((e) => e.id);
  const right = [...d.querySelectorAll(".col-right > *")].map((e) => e.id);
  assert.deepEqual(left, ["critBox", "saferBox", "addrCard", "donateCard"]);
  assert.deepEqual(right, ["seedCard", "resultsCard", "addrListCard", "sendCard"]);
  ok("address check: type, balance, invalid and failure messages; two-column layout");
}

// ---- 7d. address-type picker -----------------------------------------------
{
  const asked = [];
  const pick = boot(async (url, init, posted) => {
    asked.push(url);
    return mempool(url, init, posted);
  });
  const { d } = pick;
  const btns = [...d.querySelectorAll(".bip-btn")];
  assert.deepEqual(btns.map((b) => b.dataset.bip), ["BIP44", "BIP49", "BIP84", "BIP86"]);
  assert.ok(btns.every((b) => b.classList.contains("active")), "all four on by default");
  // switch BIP44 and BIP49 off: only BIP84 / BIP86 addresses may be queried
  click(btns[0]);
  click(btns[1]);
  assert.ok(!btns[0].classList.contains("active") && btns[2].classList.contains("active"));
  await scan(pick);
  const queried = new Set(asked.map((u) => u.split("/address/")[1]?.split("/")[0]).filter(Boolean));
  assert.ok(!queried.has(LEGACY.address), "BIP44 not scanned when switched off");
  assert.ok(queried.has(SEGWIT.address), "BIP84 still scanned");
  assert.equal(d.querySelectorAll("#tbody tr").length, 1, "only the BIP84 funds are found");
  // all off: nothing is requested, a clear message is shown
  btns.forEach((b) => b.classList.contains("active") && click(b));
  const before = asked.length;
  await scan(pick);
  assert.match(d.getElementById("status").textContent, /at least one address type/i);
  assert.equal(asked.length, before, "no network requests with every type off");
  // Clear all switches everything back on
  click(d.getElementById("clearBtn"));
  assert.ok(btns.every((b) => b.classList.contains("active")), "Clear all re-enables all types");
  // translated
  click(d.querySelector('.lang-btn[data-lang="ru"]'));
  assert.equal(d.getElementById("typeLabel").textContent, "Тип адреса");
  assert.equal(d.getElementById("addrCaption").textContent, "Проверьте тип адреса и баланс");
  // a fresh page always starts with all four on (nothing is remembered)
  const fresh = boot(mempool);
  assert.ok([...fresh.d.querySelectorAll(".bip-btn")].every((b) => b.classList.contains("active")));
  ok("address-type picker: subset scanned, none selected is blocked, Clear all resets, not remembered");
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
  assert.match(d.getElementById("gapHint").textContent, /По умолчанию 25/);
  assert.ok(!/подряд неиспользованных/.test(d.getElementById("gapHint").textContent));
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

// ---- 11. word boxes: colours, completion, paste, 12/24 ---------------------
{
  const L = boot(mempool);
  const { d, w } = L;
  const grid = () => [...d.querySelectorAll("#seedGrid input")];
  const fire = (el, type) =>
    el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));
  assert.equal(grid().length, 12);

  fillSeed(d, MN);
  assert.ok(
    grid().every((b) => b.classList.contains("ok")),
    "valid phrase: all boxes green",
  );
  assert.equal(d.getElementById("seedState").className, "seed-state ok");

  fillSeed(d, Array(12).fill("abandon").join(" "));
  assert.ok(
    grid().every((b) => b.classList.contains("bad")),
    "bad checksum: all boxes red",
  );
  assert.equal(d.getElementById("seedState").className, "seed-state bad");
  click(d.getElementById("scanBtn"));
  assert.match(d.getElementById("status").textContent, /Invalid seed phrase/);

  // a single unknown word is flagged on its own box after leaving it
  fillSeed(d, MN);
  const g = grid();
  g[3].value = "zzzzz";
  fire(g[3], "input");
  fire(g[3], "blur");
  assert.ok(g[3].classList.contains("bad"));
  assert.ok(!g[2].classList.contains("bad") && !g[2].classList.contains("ok"));

  // partial phrase stays neutral and shows progress
  click(d.getElementById("clearBtn"));
  const g2 = grid();
  g2[0].value = "abandon";
  g2[1].value = "ability";
  fire(g2[0], "input");
  assert.ok(g2.every((b) => !b.classList.contains("ok") && !b.classList.contains("bad")));
  assert.equal(d.getElementById("seedState").textContent, "2 / 12");

  // typing a unique prefix + space completes the word and moves on
  const g3 = grid();
  g3[2].value = "aban ";
  fire(g3[2], "input");
  assert.equal(g3[2].value, "abandon");

  // pasting 24 words into one box switches to 24 boxes and fills them
  const phrase24 = bip39.generateMnemonic(wordlist, 256);
  const paste = new w.Event("paste", { bubbles: true, cancelable: true });
  paste.clipboardData = { getData: () => phrase24.split(" ").join("\n") };
  grid()[0].dispatchEvent(paste);
  assert.equal(grid().length, 24);
  assert.equal(
    grid()
      .map((b) => b.value)
      .join(" "),
    phrase24,
  );
  assert.ok(
    grid().every((b) => b.classList.contains("ok")),
    "valid 24-word phrase is green",
  );

  // switching back to 12 keeps the first 12 words
  click(d.querySelector('.wc-btn[data-count="12"]'));
  assert.equal(grid().length, 12);
  assert.equal(
    grid()
      .map((b) => b.value)
      .join(" "),
    phrase24.split(" ").slice(0, 12).join(" "),
  );
  ok("word boxes: green/red by checksum, bad-word flag, prefix completion, paste, 12/24 switch");
}

// ---- 12. in-app help --------------------------------------------------------
{
  const { d, w } = boot(mempool);
  const card = d.getElementById("helpCard");
  assert.equal(card.style.display, "none");
  click(d.getElementById("helpBtn"));
  assert.equal(card.style.display, "block");
  assert.equal(d.getElementById("helpBtn").getAttribute("aria-expanded"), "true");
  assert.match(d.getElementById("helpBody").textContent, /What it does/);
  assert.match(
    d.getElementById("helpBody").textContent,
    /github\.com\/olegsh247-stack\/Bitcoin-Seed-Scanner/,
  );
  click(d.querySelector('.lang-btn[data-lang="ru"]'));
  assert.match(d.getElementById("helpBody").textContent, /Что делает/);
  assert.equal(d.getElementById("helpBtn").textContent, "Справка");
  click(d.querySelector('.lang-btn[data-lang="fr"]'));
  assert.match(d.getElementById("helpBody").textContent, /À quoi ça sert/);
  click(d.getElementById("helpBtn"));
  assert.equal(card.style.display, "none");
  ok("help button toggles the in-app guide, translated in all languages");
}

// ---- 13. send safety: the confirmation belongs to one exact prepared transaction ----
{
  const OTHER = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";
  const TAPROOT = "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr";
  const c = boot(mempool);
  await scan(c);
  const { d, posted } = c;
  const g = (id) => d.getElementById(id);
  const select = (address) =>
    click(
      [...d.querySelectorAll("#tbody button")].find((b) =>
        b.closest("tr").textContent.includes(address),
      ),
    );
  const prepare = async (to, amount, fee = "5") => {
    type(g("toAddress"), to);
    type(g("amount"), amount);
    type(g("feeRate"), fee);
    g("sendStatus").textContent = "";
    click(g("prepareBtn"));
    await until(
      () =>
        g("confirmArea").style.display === "block" ||
        /error|Enter|must|valid|Not enough/i.test(g("sendStatus").textContent),
    );
  };
  const shown = () => g("confirmArea").style.display === "block";

  select(SEGWIT.address);
  await prepare(DEST, "0.001");
  assert.ok(shown());

  // (a) change the recipient after preparing: confirmation is cancelled, nothing can be sent
  type(g("toAddress"), OTHER);
  assert.equal(shown(), false);
  assert.equal(g("broadcastBtn").disabled, true);
  type(g("confirmText"), OTHER.slice(-6));
  assert.equal(g("broadcastBtn").disabled, true, "typing the NEW address must not unlock sending");
  click(g("broadcastBtn"));
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(posted.length, 0, "nothing was broadcast");
  assert.match(g("sendStatus").textContent, /Prepare again/);

  // (b) change amount / fee / source after preparing: same
  await prepare(DEST, "0.001");
  assert.ok(shown());
  type(g("amount"), "0.002");
  assert.equal(shown(), false);
  await prepare(DEST, "0.001");
  type(g("feeRate"), "6");
  assert.equal(shown(), false);
  await prepare(DEST, "0.001");
  select(LEGACY.address);
  assert.equal(shown(), false);
  assert.equal(g("broadcastBtn").disabled, true);
  select(SEGWIT.address);

  // (c) the confirmation is compared with the prepared recipient: this still works normally
  await prepare(DEST, "0.001");
  type(g("confirmText"), OTHER.slice(-6));
  assert.equal(g("broadcastBtn").disabled, true, "wrong characters keep the button locked");
  type(g("confirmText"), DEST.slice(-6));
  assert.equal(g("broadcastBtn").disabled, false);
  click(g("broadcastBtn"));
  await until(() => /Sent successfully|error/i.test(g("sendStatus").textContent));
  assert.match(g("sendStatus").textContent, /Sent successfully/);
  assert.equal(posted.length, 1);
  const sent = btc.Transaction.fromRaw(hex.decode(posted[0]));
  assert.equal(btc.Address(btc.NETWORK).encode(btc.OutScript.decode(sent.getOutput(0).script)), DEST);
  ok("send safety: changing recipient, amount, fee or source after Prepare cancels the confirmation");

  // (d) strict fee rate: no silent default, decimals allowed
  select(SEGWIT.address);
  for (const bad of ["-3", "abc", "0.5", "0", "5.9999"]) {
    await prepare(DEST, "0.001", bad);
    assert.equal(shown(), false, `fee ${bad} must be refused`);
    assert.match(g("sendStatus").textContent, /fee rate|Fee rate/i);
  }
  await prepare(DEST, "0.001", "1.5");
  assert.ok(shown(), "decimal fee rate 1.5 is accepted");
  assert.match(g("confirmFee").textContent, /1\.5 sat\/vB/);
  ok("fee rate must be a positive number (decimals allowed); nothing is silently replaced");

  // (e) output size follows the recipient type: Taproot costs 12 vB more than native SegWit
  const vsOf = () => Number(g("confirmFee").textContent.match(/~(\d+) vB/)[1]);
  await prepare(OTHER, "0.001");
  const vsSegwit = vsOf();
  await prepare(TAPROOT, "0.001");
  assert.equal(vsOf() - vsSegwit, 12);
  ok("fee estimate uses the real output size of the recipient address type");

  // (f) a new scan forgets the chosen source and any prepared transaction
  await prepare(DEST, "0.001");
  assert.ok(shown());
  await scan(c);
  assert.equal(shown(), false);
  assert.equal(g("broadcastBtn").disabled, true);
  const before = posted.length;
  click(g("broadcastBtn"));
  click(g("prepareBtn"));
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(posted.length, before);
  assert.match(g("sendStatus").textContent, /Select a source address first/);
  ok("rescan clears the selected source and the prepared transaction");
}

// ---- 14. send safety: untrusted server data is checked strictly --------------
{
  const variant = (over) => async (url, init, posted) => {
    const u = url.replace("https://mempool.space/api", "");
    const m = u.match(/^\/address\/([^/]+)\/utxo$/);
    if (m && over.utxo && over.utxo[m[1]]) return { status: 200, json: over.utxo[m[1]] };
    if (over.hex && u.match(/^\/tx\/([0-9a-f]{64})\/hex$/)) return over.hex(u);
    return mempool(url, init, posted);
  };
  const tryPrepare = async (handler, address, amount = "0.0005") => {
    const c = boot(handler);
    await scan(c);
    const { d } = c;
    click(
      [...d.querySelectorAll("#tbody button")].find((b) =>
        b.closest("tr").textContent.includes(address),
      ),
    );
    type(d.getElementById("toAddress"), DEST);
    type(d.getElementById("amount"), amount);
    type(d.getElementById("feeRate"), "5");
    d.getElementById("sendStatus").textContent = "";
    click(d.getElementById("prepareBtn"));
    await until(
      () =>
        d.getElementById("confirmArea").style.display === "block" ||
        /error/i.test(d.getElementById("sendStatus").textContent),
    );
    return {
      shown: d.getElementById("confirmArea").style.display === "block",
      msg: d.getElementById("sendStatus").textContent,
    };
  };
  const good = SEGWIT_UTXO;
  const badLists = [
    [{ ...good, value: -5 }],
    [{ ...good, value: 1.5 }],
    [{ ...good, vout: -1 }],
    [{ ...good, txid: "xyz" }],
    [good, { ...good }],
    [{ txid: good.txid, vout: 1 }],
  ];
  for (const list of badLists) {
    const r = await tryPrepare(variant({ utxo: { [SEGWIT.address]: list } }), SEGWIT.address, "0.001");
    assert.equal(r.shown, false, JSON.stringify(list));
    assert.match(r.msg, /Prepare error: .*(UTXO|server)/);
  }
  ok("malformed UTXO answers (bad value, vout, txid, duplicate, missing field) stop the preparation");

  // Legacy: previous transaction that is not the one named, or whose amount differs
  const wrongTx = prevTxFor(LEGACY, 90_000n).raw;
  let r = await tryPrepare(
    variant({ hex: () => ({ status: 200, text: hex.encode(wrongTx) }) }),
    LEGACY.address,
  );
  assert.equal(r.shown, false);
  assert.match(r.msg, /Previous transaction/);
  r = await tryPrepare(
    variant({
      utxo: { [LEGACY.address]: [{ txid: LEGACY_PREV.txid, vout: 0, value: 120_000 }] },
    }),
    LEGACY.address,
  );
  assert.equal(r.shown, false);
  assert.match(r.msg, /amount or address/);
  ok("legacy: previous transaction must match txid, amount and address reported by the server");
}

// ---- 15. "Addresses of this seed phrase" block + dust note -------------------
{
  const BIP84_1 = addrAt(84, 0, 1); // used earlier, balance 0
  const BIP49_0 = addrAt(49, 0, 0);
  const variant = (failFirst49) => async (url, init, posted) => {
    const a = url.match(/\/address\/([^/]+)$/);
    if (a && a[1] === BIP84_1.address)
      return {
        status: 200,
        json: {
          chain_stats: { funded_txo_sum: 50_000, spent_txo_sum: 50_000, tx_count: 2 },
          mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: 0 },
        },
      };
    if (failFirst49 && a && a[1] === BIP49_0.address) return { status: 503, text: "down" };
    return mempool(url, init, posted);
  };
  const c = boot(variant(false));
  let clip = null;
  Object.defineProperty(c.w.navigator, "clipboard", {
    value: { writeText: async (t) => (clip = t) },
  });
  await scan(c);
  const { d } = c;
  const g = (id) => d.getElementById(id);
  assert.equal(g("addrListCard").style.display, "block");
  const rows = () => [...d.querySelectorAll("#alBody tr")].map((r) => [...r.children].map((x) => x.textContent));
  const rs = rows();
  // BIP44 #0 (funded), BIP49 #0, BIP84 #0, BIP84 #1 (used, empty), BIP84 #2 (funded), BIP86 #0
  assert.deepEqual(
    rs.map((r) => r[2]),
    [LEGACY.address, BIP49_0.address, addrAt(84, 0, 0).address, BIP84_1.address, SEGWIT.address, addrAt(86, 0, 0).address],
  );
  assert.match(rs[0][3], /^Balance 0\.00100000 BTC$/);
  assert.equal(rs[1][3], "No transactions");
  assert.equal(rs[3][3], "Had transactions, balance 0");
  assert.match(rs[4][3], /^Balance 0\.00150000 BTC$/);
  assert.match(rs[3][0], /^m\/84'\/0'\/0'\/0\/1$/);
  assert.equal(new Set(rs.map((r) => r[2])).size, rs.length, "no duplicates");
  // no private data anywhere in the block
  assert.ok(!/[KL][1-9A-HJ-NP-Za-km-z]{50,}|xprv/.test(g("addrListCard").textContent));
  ok("address block: first address of every type + used addresses, with status, no duplicates");

  let sawCopied = false; // the message fades after a moment (timers are instant in this test)
  new c.w.MutationObserver(() => {
    if (g("alCopied").textContent === "Copied") sawCopied = true;
  }).observe(g("alCopied"), { childList: true, characterData: true, subtree: true });
  click(g("alCopy"));
  await until(() => clip !== null && sawCopied);
  assert.equal(clip.split("\n").length, rs.length);
  assert.ok(clip.includes(SEGWIT.address) && clip.includes("m/84'/0'/0'/0/2"));
  ok("copy button puts the whole list on the clipboard as text");

  click(d.querySelector('.lang-btn[data-lang="ru"]'));
  assert.equal(g("alTitle").textContent, "Адреса этой seed-фразы");
  assert.equal(rows()[1][3], "Операций не было");
  assert.match(rows()[0][3], /^Баланс /);
  assert.equal(g("alCopy").textContent, "Копировать");
  click(d.querySelector('.lang-btn[data-lang="en"]'));

  click(g("clearBtn"));
  assert.equal(g("addrListCard").style.display, "none");
  assert.equal(d.querySelectorAll("#alBody tr").length, 0);
  ok("address block is translated live and wiped by Clear all");

  // a first address that could not be checked is shown honestly, never as "empty"
  const c2 = boot(variant(true));
  await scan(c2);
  const r2 = [...c2.d.querySelectorAll("#alBody tr")].map((r) => [...r.children].map((x) => x.textContent));
  const row49 = r2.find((r) => r[2] === BIP49_0.address);
  assert.equal(row49[3], "Could not be checked");
  ok("address that could not be checked is marked as such, not as empty");

  // dust leftover note in the confirmation
  const c3 = boot(mempool);
  await scan(c3);
  const d3 = c3.d;
  click([...d3.querySelectorAll("#tbody button")].find((b) => b.closest("tr").textContent.includes(SEGWIT.address)));
  type(d3.getElementById("toAddress"), DEST);
  type(d3.getElementById("feeRate"), "5");
  const prep = async (amt) => {
    type(d3.getElementById("amount"), amt);
    click(d3.getElementById("prepareBtn"));
    await until(() => d3.getElementById("confirmArea").style.display === "block");
  };
  await prep("0.001493"); // 150000 - 149300 = 700 sats left, minimum fee for 1-output tx is 550
  assert.equal(d3.getElementById("confirmDust").style.display, "block");
  assert.match(d3.getElementById("confirmDust").textContent, /150 sats/);
  await prep("0.001"); // normal case, real change output
  assert.equal(d3.getElementById("confirmDust").style.display, "none");
  ok("a sub-minimum leftover added to the fee is announced in the confirmation");
}

console.log(`\n${n} e2e checks passed`);
process.exit(0);
