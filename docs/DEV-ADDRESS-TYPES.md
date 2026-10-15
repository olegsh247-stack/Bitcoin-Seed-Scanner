# DEV — Bitcoin address types & BIP reference

**Internal development notes only.** Not linked from README. Not for end users.
Canonical source: [bitcoin/bips](https://github.com/bitcoin/bips).

## Quick map (scanner paths)

| Address type | Looks like | HD path BIP | Path (BTC mainnet, account 0) | Script / output | Address encoding |
|--------------|------------|-------------|-------------------------------|-----------------|------------------|
| Legacy | `1…` | BIP44 | `m/44'/0'/0'/change/i` | P2PKH | Base58Check |
| Nested SegWit | `3…` | BIP49 | `m/49'/0'/0'/change/i` | P2SH-P2WPKH (BIP141 + BIP16) | Base58Check |
| Native SegWit | `bc1q…` | BIP84 | `m/84'/0'/0'/change/i` | P2WPKH (BIP141) | Bech32 (BIP173) |
| Taproot | `bc1p…` | BIP86 | `m/86'/0'/0'/change/i` | P2TR (BIP341) | Bech32m (BIP350) |

- `change = 0` — receive (external)
- `change = 1` — change (internal)
- `coin_type = 0'` — Bitcoin mainnet (SLIP-0044)

Common template (BIP44 family):

```text
m / purpose' / coin_type' / account' / change / address_index
```

## Official BIP documents

### Derivation paths

| BIP | Title | URL |
|-----|--------|-----|
| BIP32 | Hierarchical Deterministic Wallets | https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki |
| BIP43 | Purpose Field for Deterministic Wallets | https://github.com/bitcoin/bips/blob/master/bip-0043.mediawiki |
| BIP44 | Multi-Account Hierarchy for Deterministic Wallets | https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki |
| BIP49 | Derivation scheme for P2WPKH-nested-in-P2SH | https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki |
| BIP84 | Derivation scheme for P2WPKH based accounts | https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki |
| BIP86 | Key Derivation for Single Key P2TR Outputs | https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki |
| BIP39 | Mnemonic code for generating deterministic keys | https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki |

### Scripts & address encoding

| BIP | Title | Relevance |
|-----|--------|-----------|
| [BIP16](https://github.com/bitcoin/bips/blob/master/bip-0016.mediawiki) | Pay to Script Hash | P2SH wrapper (`3…`) |
| [BIP141](https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki) | Segregated Witness (Consensus layer) | Nested + native SegWit scripts |
| [BIP173](https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki) | Bech32 address format | Native SegWit `bc1q…` |
| [BIP340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki) | Schnorr Signatures for secp256k1 | Taproot signatures |
| [BIP341](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki) | Taproot: SegWit version 1 spending rules | P2TR outputs |
| [BIP342](https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki) | Validation of Taproot Scripts | Tapscript |
| [BIP350](https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki) | Bech32m for v1+ witness addresses | Taproot `bc1p…` |

### Related (not in scanner UI, but useful)

| Doc | URL |
|-----|-----|
| BIP index | https://github.com/bitcoin/bips |
| Bitcoin Core implemented BIPs | https://github.com/bitcoin/bitcoin/blob/master/doc/bips.md |
| SLIP-0044 coin types | https://github.com/satoshilabs/slips/blob/master/slip-0044.md |
| SLIP-0132 xpub/ypub/zpub version bytes | https://github.com/satoshilabs/slips/blob/master/slip-0132.md |

## Notes for implementers

1. **BIP44** defines the hierarchy; wallets conventionally use `purpose=44'` with **P2PKH** (`1…`).
2. **BIP49 / 84 / 86** explicitly bind path purpose to script type (nested P2WPKH, native P2WPKH, single-key P2TR).
3. Address prefixes (`1` / `3` / `bc1q` / `bc1p`) come from encoding, not from the path BIP alone.
4. BIP86 test vector (receive 0): mnemonic `abandon…about` → `m/86'/0'/0'/0/0` → `bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr`.
5. Scanner in this project derives all four purposes, both change chains, gap limit configurable (default 25, range 5–100).

Last updated: 2026-10-15
