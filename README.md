# Bitcoin Seed Scanner

**Client-side recovery tool** for Bitcoin seeds that modern wallets often fail to scan completely.

Scans **BIP44 · BIP49 · BIP84 · BIP86** (both receive and change chains), checks balances, and can sign & broadcast transactions.  
The seed phrase and private keys **never leave the browser** and are never written to disk.

> **Not a daily wallet.** Use only for recovery. Prefer a clean system or live USB for large amounts.

## Why this exists

Many wallets default only to the newest derivation path (usually BIP84).  
Coins that were received on older paths (especially BIP49 nested SegWit `3...` addresses) become invisible after restoring the same seed.

This tool deliberately scans all four standard paths with a configurable gap limit, including change addresses.

## Features

- BIP39 mnemonic (12/24 words) + optional passphrase
- Derivation paths (receive `/0/i` + change `/1/i`):
  - `m/44'/0'/0'/0|1/i` — Legacy (1…)
  - `m/49'/0'/0'/0|1/i` — Nested SegWit (3…)
  - `m/84'/0'/0'/0|1/i` — Native SegWit (bc1q…)
  - `m/86'/0'/0'/0|1/i` — Taproot (bc1p…)
- Configurable address gap (default 25) applied to each chain
- Live balance check via [mempool.space](https://mempool.space)
- Select any found address → prepare transaction → double confirmation → sign & broadcast
- Smart UTXO selection (largest-first) and iterative fee estimation by address type
- Fee rate hints from mempool.space
- Hard memory cleanup on clear / tab close
- Fully offline-capable after first load of libraries (CDN)

## Security model

| Aspect | Behavior |
|--------|----------|
| Seed storage | Only in RAM (DOM + JS variables) |
| Persistence | None. Cleared on unload and explicit clear |
| Network | Only mempool.space (balances, UTXOs, fees, broadcast) |
| Private keys | Derived on demand, zeroed on clear |
| Send protection | Must type last 6 characters of destination address |
| Warnings | Explicit about malware / keyloggers |

**Never** run this on a machine you do not fully trust when handling non-trivial amounts.

## How to use

1. Open `index.html` in a modern browser (Chrome, Firefox, Brave recommended).
2. Paste the seed phrase (and passphrase if used).
3. Set gap limit if needed (25 is usually enough).
4. Click **Найти монеты** / Find coins.
5. If funds appear — click **Выбрать** on the desired row.
6. Enter destination + amount → Prepare → confirm last 6 chars of address → Broadcast.

## Technical stack

- Pure client-side (single HTML file, no build step)
- Cryptography: [`@scure/bip39`](https://github.com/paulmillr/scure-bip39), [`@scure/bip32`](https://github.com/paulmillr/scure-bip32), [`@scure/btc-signer`](https://github.com/paulmillr/scure-btc-signer) via esm.sh
- Blockchain data: mempool.space REST API
- No backend, no telemetry, no analytics

## Limitations (current)

- Mainnet only
- Single-source send (one address at a time)
- Rate limits of mempool.space apply (sequential requests with small delays)

## Roadmap

- [x] Scan change paths (`/1/i`)
- [x] Better UTXO selection & fee estimation
- [ ] Testnet toggle
- [ ] Offline mode documentation / local library mirror

## Disclaimer

This is free recovery software provided as-is.  
You are solely responsible for verifying addresses, amounts, and the security of the environment you run it in.  
The authors are not liable for any loss of funds.

---

**Use responsibly. Prefer hardware wallets for long-term storage.**
