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

console.log(`\n${n} logic tests passed`);
