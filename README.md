**Language / Язык / Idioma / Langue:** [English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Français](README.fr.md)

---

# Bitcoin Seed Scanner

Modern wallets often fail to show the **balance** after a seed phrase is restored. A simple program that **finds your bitcoin** and lets you **send it**.

Many wallets only look at the newest address type. Older coins (especially addresses starting with `3...`) can become invisible even though they are still on the blockchain.  
This tool checks **all common address types at once**.

> ⚠️ **Not a daily wallet.** Use only for recovery. For large amounts prefer a clean computer or live USB.

The app itself supports **English · Русский · Español · Français** (switch in the top-right of the page).

---

## Official source only

Download **only** from this repository:

**https://github.com/olegsh247-stack/Bitcoin-Seed-Scanner**

Copies from other sites or messengers may be modified to steal your seed.

---

## How to download and run

1. **Right-click** this link → **Save link as…** and save the file `index.html` (for example, to your desktop):
   **https://raw.githubusercontent.com/olegsh247-stack/Bitcoin-Seed-Scanner/main/index.html**
2. **Double-click** the saved file. It opens in your browser. If it opened in Notepad instead: right-click the file → **Open with** → your browser.
3. The internet is needed only to check balances and send a transaction. Your seed phrase never leaves your browser.

Download only from this GitHub page. Do not use a file received by email or in a chat.

---

## How to use

1. Enter your **seed phrase**, one word per box (12 or 24 — switch above the boxes). You can paste the whole phrase into any box. The boxes turn **green** when the phrase is valid and **red** when it is not.
2. Enter **passphrase** if you used one
3. Click **Find coins**
4. Wait while all address types are checked
5. Click **Select** on an address with balance
6. Enter destination and amount → **Prepare**
7. Type the **last 6 characters** of the destination address
8. **Sign and send**

Then close the browser tab. Nothing is stored on disk.

The **Help** button (top right of the app) shows this guide inside the app itself.

---

## What it scans

| Address type | Looks like | Path |
|--------------|------------|------|
| Legacy | starts with **1** | BIP44 |
| Nested SegWit | starts with **3** | BIP49 |
| Native SegWit | starts with **bc1q** | BIP84 |
| Taproot | starts with **bc1p** | BIP86 |

Receive and change addresses are both scanned. Each address list is checked until the program sees **25 unused addresses in a row** (the "gap limit" — the standard value, enough for almost all wallets; **default 25, nothing to set**).

**Account number** (default **0**): the wallet's first account. Enter 1, 2… only if your wallet had several accounts and the coins were not found in the first one.

---

## Security

- Seed and keys stay **only in browser memory**
- Cleared when you close the tab or click Clear
- Network calls go only to mempool.space (balances, fees, sending). **Nothing is loaded from the internet**: the whole program is inside the one file.
- **Privacy:** to check balances the page sends every derived address to mempool.space, so that service (and anyone watching your connection) can link those addresses together and see your IP. Use Tor/VPN, or your own node, if that matters.
- If a balance lookup fails (network, rate limit), the tool says so instead of reporting "no funds". Re-run the scan if you see that warning.
- Send requires typing the last 6 characters of the destination
- **Never enter a seed on a computer you do not trust**

---

## Gratitude

If this program helped you recover your funds — we would gladly accept your voluntary thank-you. It is never required, and it will surely be counted by the Almighty. 🙏

| Asset | Network | Address |
|-------|---------|--------|
| BTC | Legacy (P2PKH) | `1GgXo15BHD2CJorJaVhhhB8AvTszr1Nrpc` |
| BTC | Nested SegWit (P2SH) | `3B6wA2Yu5nH9FYXAakkHd79ijnQ16RoD5G` |
| BTC | Native SegWit (P2WPKH) | `bc1qy9ht50kfehlxynwew20eh47c8x9pyvq7pc2umq` |
| BTC | SegWit (P2WSH) | `bc1q56kmywwmlvt6xp04zr63g9nff2ye0p7j2txhz9ccs087dxmr8gnqevee4d` |
| BTC | Taproot (P2TR) | `bc1p6wk0ecu3355m0eymwd92a7f8d99w7lyx5s4xek8nm7razg4hjvqqfxdvx9` |
| USDT | TRC-20 | `TVXzchqZdvRqTCJutjGgF1xVP5kuDfk2nx` |
| USDT | ERC-20 | `0x761B53654e2333261649eEb8857B752A60f11435` |

---

## Limits

- Bitcoin mainnet only
- One source address per send
- Not a replacement for a hardware wallet

---

**Use carefully. You are responsible for your funds.**

---

## License

Released under the [MIT License](LICENSE): free to use, copy and modify, provided "as is", without warranty of any kind.

> The donation addresses above are published **only in this README**, not inside the app, so nothing sits next to the seed-phrase field. Verify any address here, on the official repository, before sending.

---

<details>
<summary>For advanced users: check the file / build from source</summary>

### Check file integrity (optional but recommended)

After saving `index.html`, verify the SHA-256 checksum:

```
9723387311cb3aea08ddd25f311b0c39f5604baabca1b0aa3e8c0ce0139be99d
```

- **Linux / macOS:** `sha256sum index.html` (or `shasum -a 256 index.html`)
- **Windows (PowerShell):** `Get-FileHash index.html -Algorithm SHA256`

If the hash does not match — do not use that file.

*(Update this hash whenever `index.html` is released anew.)*

### Build from source (optional)

`index.html` is generated from `src/` (edit `src/template.html` and `src/app.js`, **not** `index.html`). To reproduce it byte for byte and compare with the checksum above:

```
npm ci
npm run build   # writes index.html, refreshes the SHA-256 in all READMEs
npm test
```

</details>
