// Pure logic (no DOM, no network) so it can be unit-tested in Node.
import * as btc from "@scure/btc-signer";

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
export const outputVSize = () => 31;
export const baseVSize = () => 11;

export function selectUtxos(utxos, targetSats, feeRate, addrType) {
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  const selected = [];
  let sum = 0n;
  const target = BigInt(targetSats);
  for (const u of sorted) {
    selected.push(u);
    sum += BigInt(u.value);
    const vs = baseVSize() + selected.length * inputVSize(addrType) + 2 * outputVSize();
    const fee = BigInt(Math.ceil(vs * feeRate));
    if (sum >= target + fee) break;
  }
  return { selected, sum };
}

export function calcFeeAndChange(inputSum, amountSats, numInputs, feeRate, addrType) {
  const amount = BigInt(amountSats);
  const inVs = numInputs * inputVSize(addrType);
  // Try with a change output first.
  let vs = baseVSize() + inVs + 2 * outputVSize();
  let fee = BigInt(Math.ceil(vs * feeRate));
  let change = inputSum - amount - fee;
  if (change > DUST) return { fee, change, ok: true, vsize: vs };
  // Change would be dust or negative: try without a change output.
  vs = baseVSize() + inVs + outputVSize();
  fee = BigInt(Math.ceil(vs * feeRate));
  if (inputSum - amount < fee)
    return { fee, change: inputSum - amount - fee, ok: false, vsize: vs };
  // Whatever is left (dust) goes to the miners; fee is exactly input - amount.
  return { fee: inputSum - amount, change: 0n, ok: true, vsize: vs };
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
