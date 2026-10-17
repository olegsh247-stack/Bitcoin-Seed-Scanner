// Run: node test/logic.test.mjs
// Uses only the public BIP39 test mnemonic. No real funds, no network.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import {
  PATHS,
  DUST,
  btcToSats,
  satsToBtc,
  calcFeeAndChange,
  selectUtxos,
  isValidMainnetAddress,
  feeWarning,
  describeAddress,
  parseFeeRate,
  feeFor,
  outputVSizeFor,
  changeVSize,
  validateUtxos,
  verifyPrevOutput,
  auditTransaction,
  checkFinalFeeRate,
} from "../src/lib.js";

let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log("ok -", name);
};

const MN =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const DEST = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const VECTORS = {
  BIP44: "1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA",
  BIP49: "37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf",
  BIP84: "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu",
  BIP86: "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
};

t("mnemonic validates", () => assert.equal(bip39.validateMnemonic(MN, wordlist), true));

const root = HDKey.fromMasterSeed(bip39.mnemonicToSeedSync(MN, ""));

for (const p of PATHS) {
  t(`${p.name}: address matches published test vector`, () => {
    const child = root.derive(`m/${p.purpose}'/0'/0'/0/0`);
    assert.equal(p.makePayment(child.publicKey).address, VECTORS[p.name]);
  });

  t(`${p.name}: builds, signs and serialises a spend exactly as the app does`, () => {
    const child = root.derive(`m/${p.purpose}'/0'/0'/0/0`);
    const payment = p.makePayment(child.publicKey);
    const input = { ...payment };
    if (p.name === "BIP44") {
      // Legacy: the app supplies the full previous transaction.
      const prevRaw = btc.RawTx.encode({
        version: 2,
        inputs: [
          {
            txid: new Uint8Array(32).fill(1),
            index: 0,
            finalScriptSig: new Uint8Array(),
            sequence: 0xffffffff,
          },
        ],
        outputs: [{ amount: 100000n, script: payment.script }],
        lockTime: 0,
      });
      input.nonWitnessUtxo = prevRaw;
      const d = createHash("sha256").update(createHash("sha256").update(prevRaw).digest()).digest();
      input.txid = Buffer.from(d).reverse().toString("hex");
      input.index = 0;
    } else {
      input.txid = "aa".repeat(32);
      input.index = 0;
      input.witnessUtxo = { script: payment.script, amount: 100000n };
    }
    const tx = new btc.Transaction();
    tx.addInput(input);
    tx.addOutputAddress(DEST, 50000n);
    tx.addOutputAddress(payment.address, 49000n);
    tx.sign(child.privateKey);
    tx.finalize();
    const raw = tx.extract();
    assert.ok(hex.encode(raw).length > 100);
  });

  if (p.name === "BIP44")
    t("BIP44: a witnessUtxo-only input (the old behaviour) cannot be signed", () => {
      const child = root.derive(`m/${p.purpose}'/0'/0'/0/0`);
      const payment = p.makePayment(child.publicKey);
      const tx = new btc.Transaction();
      tx.addInput({
        ...payment,
        txid: "aa".repeat(32),
        index: 0,
        witnessUtxo: { script: payment.script, amount: 100000n },
      });
      tx.addOutputAddress(DEST, 50000n);
      assert.throws(() => tx.sign(child.privateKey));
    });
}

t("btcToSats: exact decimal parsing", () => {
  assert.equal(btcToSats("1"), 100000000n);
  assert.equal(btcToSats("0.00000001"), 1n);
  assert.equal(btcToSats("0.001"), 100000n);
  assert.equal(btcToSats("21000000"), 2100000000000000n);
  assert.equal(btcToSats("0.29999999"), 29999999n); // float math would round this wrongly
});
t("btcToSats: rejects junk", () => {
  for (const bad of [
    "",
    "abc",
    "-1",
    "1e-3",
    "0.000000001",
    "1,5",
    " 1",
    "1.",
    ".5",
    "0x10",
    "1 BTC",
  ])
    assert.equal(btcToSats(bad), null, `should reject ${JSON.stringify(bad)}`);
});
t("satsToBtc", () => {
  assert.equal(satsToBtc(0n), "0.00000000");
  assert.equal(satsToBtc(1n), "0.00000001");
  assert.equal(satsToBtc(123456789n), "1.23456789");
  assert.equal(satsToBtc(2100000000000000n), "21000000.00000000");
});

t("isValidMainnetAddress", () => {
  for (const a of Object.values(VECTORS)) assert.equal(isValidMainnetAddress(a), true, a);
  assert.equal(isValidMainnetAddress(DEST), true);
  assert.equal(isValidMainnetAddress(VECTORS.BIP84.slice(0, -1) + "q"), false); // bad checksum
  assert.equal(isValidMainnetAddress("1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabB"), false);
  assert.equal(isValidMainnetAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"), false); // testnet
  assert.equal(isValidMainnetAddress("not an address"), false);
  assert.equal(isValidMainnetAddress(""), false);
});

t("calcFeeAndChange: normal case keeps change and balances exactly", () => {
  const r = calcFeeAndChange(1_000_000n, 400_000n, 1, 5, "BIP84");
  assert.equal(r.ok, true);
  assert.ok(r.change > DUST);
  assert.equal(r.change + r.fee + 400_000n, 1_000_000n);
});
t("calcFeeAndChange: dust change is added to the fee, never lost or negative", () => {
  const r = calcFeeAndChange(100_300n, 100_000n, 1, 1, "BIP84");
  assert.equal(r.ok, true);
  assert.equal(r.change, 0n);
  assert.equal(r.fee, 300n);
});
t("calcFeeAndChange: insufficient funds is reported", () => {
  assert.equal(calcFeeAndChange(100_000n, 100_000n, 1, 5, "BIP84").ok, false);
  assert.equal(calcFeeAndChange(50_000n, 100_000n, 1, 5, "BIP44").ok, false);
});
t("calcFeeAndChange: send-everything leaves exactly the fee", () => {
  const r = calcFeeAndChange(500_000n, 500_000n - 1_000n, 1, 5, "BIP86");
  assert.equal(r.ok, true);
  assert.equal(r.change, 0n);
  assert.equal(r.fee, 1_000n);
});
t("selectUtxos: picks largest first until covered", () => {
  const utxos = [
    { txid: "a", vout: 0, value: 1000 },
    { txid: "b", vout: 0, value: 900_000 },
    { txid: "c", vout: 0, value: 50_000 },
  ];
  const { selected, sum } = selectUtxos(utxos, 100_000n, 5, "BIP84");
  assert.equal(selected.length, 1);
  assert.equal(sum, 900_000n);
});

t("feeWarning", () => {
  assert.equal(feeWarning(1_000n, 1_000_000n), null);
  assert.equal(feeWarning(200_000n, 1_000_000n), "Fee is 20% of the amount sent");
  assert.equal(feeWarning(600n, 3_000n), null); // tiny absolute fee: no nagging
});

t("describeAddress: type per address kind, null for invalid", () => {
  assert.equal(describeAddress(VECTORS.BIP44), "Legacy / P2PKH (BIP44)");
  assert.equal(describeAddress(VECTORS.BIP49), "Nested SegWit / P2SH (BIP49)");
  assert.equal(describeAddress(VECTORS.BIP84), "Native SegWit (BIP84)");
  assert.equal(describeAddress(VECTORS.BIP86), "Taproot (BIP86)");
  assert.equal(describeAddress("  " + VECTORS.BIP84 + "\n"), "Native SegWit (BIP84)"); // trims
  assert.equal(describeAddress(VECTORS.BIP84.slice(0, -1) + "q"), null);
  assert.equal(describeAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"), null);
  assert.equal(describeAddress(""), null);
});

// ---- send safety ------------------------------------------------------------
t("parseFeeRate: strict positive number, decimals allowed, no silent default", () => {
  assert.deepEqual(parseFeeRate("5"), { ok: true, rate: 5 });
  assert.deepEqual(parseFeeRate(" 1.5 "), { ok: true, rate: 1.5 });
  for (const bad of ["", "abc", "-3", "0", "0.5", "5.9999", "1e2", "1,5", "1001", "NaN"])
    assert.equal(parseFeeRate(bad).ok, false, `should reject ${JSON.stringify(bad)}`);
  assert.match(parseFeeRate("5000").error, /typo/);
});

t("feeFor: exact BigInt rounding up, decimals work", () => {
  assert.equal(feeFor(141, 5), 705n);
  assert.equal(feeFor(141, 1.5), 212n); // 211.5 -> 212
  assert.equal(feeFor(100, 1), 100n);
  assert.equal(feeFor(110, 1), 110n);
  assert.equal(feeFor(1, 1.001), 2n);
});

t("output sizes follow the address type (Legacy 34, P2SH 32, P2WPKH 31, Taproot 43)", () => {
  assert.equal(outputVSizeFor(VECTORS.BIP44), 34);
  assert.equal(outputVSizeFor(VECTORS.BIP49), 32);
  assert.equal(outputVSizeFor(VECTORS.BIP84), 31);
  assert.equal(outputVSizeFor(VECTORS.BIP86), 43);
  assert.equal(outputVSizeFor("garbage"), 43);
  assert.deepEqual(["BIP44", "BIP49", "BIP84", "BIP86"].map(changeVSize), [34, 32, 31, 43]);
  // paying a Taproot address costs more than paying a native SegWit one
  const a = calcFeeAndChange(1_000_000n, 100_000n, 1, 10, "BIP84", 31, 31);
  const b = calcFeeAndChange(1_000_000n, 100_000n, 1, 10, "BIP84", 43, 31);
  assert.equal(b.fee - a.fee, 120n);
});

t("validateUtxos: accepts good data, rejects every kind of bad entry", () => {
  const good = { txid: "AB".repeat(32), vout: 0, value: 1000 };
  assert.deepEqual(validateUtxos([good]), [{ txid: "ab".repeat(32), vout: 0, value: 1000 }]);
  assert.deepEqual(validateUtxos([]), []);
  const bads = [
    null,
    "x",
    {},
    { ...good, txid: "zz".repeat(32) },
    { ...good, txid: "ab".repeat(31) },
    { ...good, txid: 5 },
    { ...good, vout: -1 },
    { ...good, vout: 1.5 },
    { ...good, vout: "0" },
    { ...good, vout: 2 ** 32 },
    { ...good, value: 0 },
    { ...good, value: -5 },
    { ...good, value: 10.5 },
    { ...good, value: "1000" },
    { ...good, value: 2100000000000001 },
    { txid: good.txid, vout: 0 },
  ];
  for (const b of bads) assert.throws(() => validateUtxos([good, b]), /UTXO|server/);
  assert.throws(() => validateUtxos({}), /Unexpected/);
  assert.throws(() => validateUtxos([good, { ...good }]), /Duplicate/);
});

const legacy = root.derive("m/44'/0'/0'/0/0");
const legacyPay = PATHS[0].makePayment(legacy.publicKey);
const prevRaw = btc.RawTx.encode({
  version: 2,
  inputs: [
    {
      txid: new Uint8Array(32).fill(1),
      index: 0,
      finalScriptSig: new Uint8Array(),
      sequence: 0xffffffff,
    },
  ],
  outputs: [
    { amount: 5000n, script: new Uint8Array([0x6a]) },
    { amount: 100000n, script: legacyPay.script },
  ],
  lockTime: 0,
});
const prevTxid = Buffer.from(
  createHash("sha256").update(createHash("sha256").update(prevRaw).digest()).digest(),
)
  .reverse()
  .toString("hex");

t("verifyPrevOutput: previous tx must match txid, output index, amount and script", () => {
  verifyPrevOutput(prevRaw, prevTxid, 1, 100000, legacyPay.script); // genuine: no throw
  assert.throws(() => verifyPrevOutput(prevRaw, "aa".repeat(32), 1, 100000, legacyPay.script), /does not match/);
  assert.throws(() => verifyPrevOutput(prevRaw, prevTxid, 1, 99999, legacyPay.script), /amount or address/);
  assert.throws(() => verifyPrevOutput(prevRaw, prevTxid, 1, 100001, legacyPay.script), /amount or address/);
  assert.throws(() => verifyPrevOutput(prevRaw, prevTxid, 0, 5000, legacyPay.script), /amount or address/);
  assert.throws(() => verifyPrevOutput(prevRaw, prevTxid, 7, 100000, legacyPay.script), /does not match/);
  assert.throws(() => verifyPrevOutput(prevRaw.slice(0, 20), prevTxid, 1, 100000, legacyPay.script), /does not match/);
});

// Build a transaction the way the app does, to audit it.
function buildLegacySpend({ amount = 40_000n, change = 59_000n, to = DEST } = {}) {
  const tx = new btc.Transaction();
  tx.addInput({ ...legacyPay, txid: prevTxid, index: 1, nonWitnessUtxo: prevRaw });
  tx.addOutputAddress(to, amount);
  if (change > 0n) tx.addOutputAddress(legacyPay.address, change);
  return tx;
}
const auditArgs = (over = {}) => ({
  to: DEST,
  amountSats: 40_000n,
  changeSats: 59_000n,
  sourceScript: legacyPay.script,
  feeSats: 1_000n,
  minFee: 1_000n,
  inputs: [{ txid: prevTxid, vout: 1, value: 100000 }],
  ...over,
});

t("auditTransaction: passes a correct transaction, stops every mismatch", () => {
  auditTransaction(buildLegacySpend(), auditArgs());
  const fails = (tx, args, re) => assert.throws(() => auditTransaction(tx, args), re);
  fails(buildLegacySpend({ to: VECTORS.BIP84 }), auditArgs(), /recipient/);
  fails(buildLegacySpend({ amount: 40_001n, change: 58_999n }), auditArgs(), /amount differs/);
  fails(buildLegacySpend({ change: 58_000n }), auditArgs(), /change amount|fee differs/);
  fails(buildLegacySpend({ change: 0n }), auditArgs(), /number of outputs/);
  fails(buildLegacySpend(), auditArgs({ feeSats: 1_001n }), /fee differs/);
  fails(buildLegacySpend(), auditArgs({ minFee: 2_000n }), /outside the expected range/);
  fails(buildLegacySpend(), auditArgs({ inputs: [{ txid: "aa".repeat(32), vout: 1, value: 100000 }] }), /input differs/);
  fails(buildLegacySpend(), auditArgs({ inputs: [{ txid: prevTxid, vout: 1, value: 99999 }] }), /input amount/);
  fails(buildLegacySpend({ amount: 99_999n, change: 5n }), auditArgs({ amountSats: 99_999n, changeSats: 5n }), /exceed|fee/);
  fails(buildLegacySpend(), auditArgs({ sourceScript: new Uint8Array([1, 2, 3]) }), /change does not return/);
  // dust left to the miners (no change output): fee may exceed the minimum by at most DUST
  const noChange = buildLegacySpend({ amount: 99_500n, change: 0n });
  auditTransaction(noChange, auditArgs({ amountSats: 99_500n, changeSats: 0n, feeSats: 500n, minFee: 400n }));
  const bigLeftover = buildLegacySpend({ amount: 98_000n, change: 0n }); // 2000 sats vanish into the fee
  fails(bigLeftover, auditArgs({ amountSats: 98_000n, changeSats: 0n, feeSats: 2_000n, minFee: 400n }), /outside the expected range/);
});

t("checkFinalFeeRate: real size vs selected rate", () => {
  checkFinalFeeRate(705n, 141, 5);
  checkFinalFeeRate(705n, 150, 5); // slightly under: estimates are conservative, 0.9x allowed
  assert.throws(() => checkFinalFeeRate(300n, 141, 5), /lower than selected/);
  assert.throws(() => checkFinalFeeRate(500_000n, 100, 5), /far too high/);
});

console.log(`\n${n} logic tests passed`);
