// Pure logic (no DOM, no network) so it can be unit-tested in Node.
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import { sha256 } from "@noble/hashes/sha256";

export const DUST = 546n;

export const PATHS = [
  { name: "BIP44", type: "Legacy", purpose: 44, makePayment: (pub) => btc.p2pkh(pub) },
  {
    name: "BIP49",
    type: "Nested SegWit",
    purpose: 49,
    makePayment: (pub) => btc.p2sh(btc.p2wpkh(pub)),
  },
  { name: "BIP84", type: "Native SegWit", purpose: 84, makePayment: (pub) => btc.p2wpkh(pub) },
  {
    name: "BIP86",
    type: "Taproot",
    purpose: 86,
    makePayment: (pub) => {
      const xOnly = pub.length === 33 ? pub.slice(1) : pub;
      return btc.p2tr(xOnly);
    },
  },
];
export const CHAINS = [0, 1]; // 0 = receive, 1 = change

export function inputVSize(name) {
  switch (name) {
    case "BIP86":
      return 58;
    case "BIP84":
      return 68;
    case "BIP49":
      return 91;
    default:
      return 148; // BIP44 (legacy) and anything unknown: be conservative
  }
}
export const outputVSize = () => 31; // default (P2WPKH); real sizes depend on the address type
export const baseVSize = () => 11;

// Size of an output paying to a given address type (vbytes). Unknown types: the largest.
const OUT_VSIZE = { pkh: 34, sh: 32, wpkh: 31, wsh: 43, tr: 43 };
export function outputVSizeFor(addr) {
  try {
    const d = btc.Address(btc.NETWORK).decode(String(addr).trim());
    return OUT_VSIZE[d.type] || 43;
  } catch (_) {
    return 43;
  }
}
// The change goes back to the source address, so it has the source's type.
export function changeVSize(name) {
  switch (name) {
    case "BIP44":
      return 34;
    case "BIP49":
      return 32;
    case "BIP86":
      return 43;
    default:
      return 31;
  }
}

// Fee in sats for a size and a rate (sat/vB, may have decimals), rounded up. BigInt-exact.
export function feeFor(vs, rate) {
  const milli = BigInt(Math.round(Number(rate) * 1000));
  return (BigInt(Math.ceil(vs)) * milli + 999n) / 1000n;
}

export const MIN_FEE_RATE = 1; // sat/vB
// Strict fee-rate input: a positive number with up to 3 decimals, within the allowed range.
// Returns { ok: true, rate } or { ok: false, error }.
export function parseFeeRate(str) {
  const s = String(str ?? "").trim();
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return { ok: false, error: "Enter the fee rate as a number, for example 5 or 1.5" };
  const rate = Number(s);
  if (rate < MIN_FEE_RATE) return { ok: false, error: `Fee rate must be at least ${MIN_FEE_RATE} sat/vB` };
  if (rate > MAX_FEE_RATE)
    return { ok: false, error: `Fee rate above ${MAX_FEE_RATE} sat/vB looks like a typo` };
  return { ok: true, rate };
}

// Strict check of the UTXO list returned by the server. Any bad entry stops the whole
// preparation: we never silently skip or "repair" data that will decide what we sign.
export function validateUtxos(list) {
  if (!Array.isArray(list)) throw new Error("Unexpected UTXO response from the server");
  const seen = new Set();
  const out = [];
  for (const u of list) {
    if (!u || typeof u !== "object") throw new Error("Invalid UTXO entry from the server");
    const { txid, vout, value } = u;
    if (typeof txid !== "string" || !/^[0-9a-f]{64}$/i.test(txid))
      throw new Error("Invalid UTXO txid from the server");
    if (!Number.isSafeInteger(vout) || vout < 0 || vout > 0xffffffff)
      throw new Error("Invalid UTXO output index from the server");
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2100000000000000)
      throw new Error("Invalid UTXO amount from the server");
    const key = `${txid.toLowerCase()}:${vout}`;
    if (seen.has(key)) throw new Error("Duplicate UTXO in the server response");
    seen.add(key);
    out.push({ txid: txid.toLowerCase(), vout, value });
  }
  return out;
}

const sameBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Legacy: the full previous transaction must be the one named by the input, and the
// output it spends must have exactly the amount and script we believe it has.
export function verifyPrevOutput(raw, txid, vout, value, script) {
  let t, out;
  try {
    t = btc.Transaction.fromRaw(raw, {
      allowUnknownOutputs: true,
      disableScriptCheck: true,
      allowUnknownInputs: true,
    });
    // The id is the double SHA-256 of the transaction without witness data. Computed here
    // (not via t.id, which refuses transactions whose inputs are not finalized).
    const id = hex.encode(sha256(sha256(t.toBytes(true, false))).reverse());
    if (id !== String(txid).toLowerCase()) throw new Error("txid");
    out = t.getOutput(vout);
  } catch (_) {
    throw new Error("Previous transaction does not match the UTXO reported by the server");
  }
  if (!out || out.amount !== BigInt(value) || !sameBytes(out.script, script))
    throw new Error("Previous transaction output does not match the amount or address reported by the server");
}

// Independent check of the finished (not yet signed) transaction against what the user
// confirmed: inputs, recipient, amount, change and fee. Throws on any mismatch.
export function auditTransaction(tx, p) {
  const bad = (m) => {
    throw new Error("Transaction check failed: " + m);
  };
  if (tx.inputsLength !== p.inputs.length) bad("unexpected number of inputs");
  let inSum = 0n;
  for (let i = 0; i < tx.inputsLength; i++) {
    const inp = tx.getInput(i);
    const want = p.inputs[i];
    if (hex.encode(inp.txid) !== want.txid || inp.index !== want.vout) bad("input differs from the selected coin");
    const amt = inp.witnessUtxo
      ? inp.witnessUtxo.amount
      : inp.nonWitnessUtxo && inp.nonWitnessUtxo.outputs[inp.index]
        ? inp.nonWitnessUtxo.outputs[inp.index].amount
        : null;
    if (amt === null || amt !== BigInt(want.value)) bad("input amount differs from the selected coin");
    inSum += amt;
  }
  const hasChange = p.changeSats > 0n;
  if (tx.outputsLength !== (hasChange ? 2 : 1)) bad("unexpected number of outputs");
  const toScript = btc.OutScript.encode(btc.Address(btc.NETWORK).decode(p.to));
  const o0 = tx.getOutput(0);
  if (!sameBytes(o0.script, toScript)) bad("recipient address differs from the confirmed one");
  if (o0.amount !== p.amountSats) bad("amount differs from the confirmed one");
  let outSum = o0.amount;
  if (hasChange) {
    const o1 = tx.getOutput(1);
    if (!sameBytes(o1.script, p.sourceScript)) bad("change does not return to the source address");
    if (o1.amount !== p.changeSats) bad("change amount is unexpected");
    outSum += o1.amount;
  }
  const fee = inSum - outSum;
  if (fee < 0n) bad("outputs exceed inputs");
  if (fee !== p.feeSats) bad("fee differs from the one shown");
  if (fee < p.minFee || fee > p.minFee + DUST) bad("fee is outside the expected range");
}

// After signing: the real size is known, so the real fee rate can be checked too.
export function checkFinalFeeRate(feeSats, vsize, rate) {
  const real = Number(feeSats) / vsize;
  if (!(real >= rate * 0.9)) throw new Error("Transaction check failed: fee rate is lower than selected");
  if (real > MAX_FEE_RATE) throw new Error("Transaction check failed: fee rate is far too high");
}

export function selectUtxos(utxos, targetSats, feeRate, addrType, toVs = 31, changeVs = 31) {
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  const selected = [];
  let sum = 0n;
  const target = BigInt(targetSats);
  for (const u of sorted) {
    selected.push(u);
    sum += BigInt(u.value);
    const vs = baseVSize() + selected.length * inputVSize(addrType) + toVs + changeVs;
    const fee = feeFor(vs, feeRate);
    if (sum >= target + fee) break;
  }
  return { selected, sum };
}

export function calcFeeAndChange(
  inputSum,
  amountSats,
  numInputs,
  feeRate,
  addrType,
  toVs = 31,
  changeVs = 31,
) {
  const amount = BigInt(amountSats);
  const inVs = numInputs * inputVSize(addrType);
  // Try with a change output first.
  let vs = baseVSize() + inVs + toVs + changeVs;
  let fee = feeFor(vs, feeRate);
  let change = inputSum - amount - fee;
  if (change > DUST) return { fee, change, ok: true, vsize: vs, minFee: fee };
  // Change would be dust or negative: try without a change output.
  vs = baseVSize() + inVs + toVs;
  fee = feeFor(vs, feeRate);
  if (inputSum - amount < fee)
    return { fee, change: inputSum - amount - fee, ok: false, vsize: vs };
  // Whatever is left (dust) goes to the miners; fee is exactly input - amount.
  return { fee: inputSum - amount, change: 0n, ok: true, vsize: vs, minFee: fee };
}

export const satsToBtc = (sats) => {
  const s = BigInt(sats);
  const whole = s / 100000000n;
  const frac = (s % 100000000n).toString().padStart(8, "0");
  return `${whole}.${frac}`;
};

// Exact decimal string -> satoshis (BigInt-safe, no float rounding).
// Returns null for anything that is not a plain decimal with <= 8 fractional digits.
export function btcToSats(str) {
  if (typeof str !== "string" || !/^\d+(\.\d{1,8})?$/.test(str)) return null;
  const [whole, frac = ""] = str.split(".");
  return BigInt(whole) * 100000000n + BigInt(frac.padEnd(8, "0"));
}

// Strict mainnet address check (checksum / bech32 / witness version).
export function isValidMainnetAddress(addr) {
  try {
    btc.Address(btc.NETWORK).decode(addr);
    return true;
  } catch (_) {
    return false;
  }
}

export const MAX_FEE_RATE = 1000; // sat/vB — refuse anything above (almost certainly a typo)

// Returns a human-readable warning if the fee looks excessive, otherwise null.
export function feeWarning(feeSats, amountSats) {
  const fee = BigInt(feeSats),
    amount = BigInt(amountSats);
  if (amount > 0n && fee * 10n > amount && fee > 5000n) {
    const pct = Number((fee * 1000n) / amount) / 10;
    return `Fee is ${pct}% of the amount sent`;
  }
  return null;
}

// Human-readable kind of a mainnet address, or null if it is not a valid mainnet address.
export function describeAddress(addr) {
  let d;
  try {
    d = btc.Address(btc.NETWORK).decode(String(addr).trim());
  } catch (_) {
    return null;
  }
  switch (d.type) {
    case "pkh":
      return "Legacy / P2PKH (BIP44)";
    case "sh":
      return "Nested SegWit / P2SH (BIP49)";
    case "wpkh":
      return "Native SegWit (BIP84)";
    case "wsh":
      return "Native SegWit script / P2WSH";
    case "tr":
      return "Taproot (BIP86)";
    default:
      return String(d.type);
  }
}
