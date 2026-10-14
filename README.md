**Language / Язык / Idioma / Langue:** [English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Français](README.fr.md)

---

# Bitcoin Seed Scanner

Simple tool to **find Bitcoin that modern wallets often miss** after restoring a seed — and send it out.

Many wallets only look at the newest address type. Older coins (especially addresses starting with `3...`) can become invisible even though they are still on the blockchain.  
This tool checks **all common address types at once**.

> ⚠️ **Not a daily wallet.** Use only for recovery. For large amounts prefer a clean computer or live USB.

The app itself supports **English · Русский · Español · Français** (switch in the top-right of the page).

---

## Download and open (1 minute)

### Option 1 — easiest

1. Open **https://github.com/olegsh247-stack/Bitcoin-Seed-Scanner**
2. Click green **Code** → **Download ZIP**
3. Unzip the archive
4. Double-click **`index.html`** — it opens in your browser

### Option 2 — single file

1. Open: **https://raw.githubusercontent.com/olegsh247-stack/Bitcoin-Seed-Scanner/main/index.html**
2. Right-click → **Save as…**
3. Open the saved file

Internet is only needed to check balances and broadcast a transaction. The seed never leaves your browser.

---

## How to use

1. Paste your **seed phrase** (12 or 24 words)
2. Enter **passphrase** if you used one
3. Click **Find coins**
4. Wait while all address types are checked
5. Click **Select** on an address with balance
6. Enter destination and amount → **Prepare**
7. Type the **last 6 characters** of the destination address
8. **Sign and send**

Then close the browser tab. Nothing is stored on disk.

---

## What it scans

| Address type | Looks like | Path |
|--------------|------------|------|
| Legacy | starts with **1** | BIP44 |
| Nested SegWit | starts with **3** | BIP49 |
| Native SegWit | starts with **bc1q** | BIP84 |
| Taproot | starts with **bc1p** | BIP86 |

Receive and change chains are both scanned.

---

## Security

- Seed and keys stay **only in browser memory**
- Cleared when you close the tab or click Clear
- Network calls go only to mempool.space (balances, fees, broadcast)
- Send requires typing the last 6 characters of the destination
- **Never enter a seed on a computer you do not trust**

---

## Gratitude

If this program helped you recover your funds — we would gladly accept your voluntary thank-you. It is never required, and it will surely be counted by the Almighty. 🙂

---

## Limits

- Bitcoin mainnet only
- One source address per send
- Not a replacement for a hardware wallet

---

**Use carefully. You are responsible for your funds.**
