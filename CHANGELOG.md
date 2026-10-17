# Changelog

All notable changes to Bitcoin Seed Scanner are listed here, newest first.
Minor tweaks (wording, layout fixes, hash refreshes) are not included.

## [Unreleased]

### Security
- Sending: the confirmation is now tied to the exact prepared transaction. Changing the recipient, amount, fee or source after "Prepare" cancels it and requires preparing again; the last-6-characters check uses the prepared recipient, not the form field.
- Before signing, the transaction is checked independently: inputs, recipient, amount, change and fee must match what was confirmed; the real fee rate is checked after signing.
- Strict checks of server data: every UTXO is validated (txid, output index, amount, duplicates); for Legacy addresses the previous transaction must match the txid, amount and address reported by the server.
- A new scan wipes the previous key material and forgets the selected source and any prepared transaction.

### Added
- "Addresses of this seed phrase" block under the found funds: the first receive address of every scanned type plus every address with history (receive and change), with path and status, and a Copy button. Public data only; nothing is saved.
- The confirmation announces when a sub-minimum leftover (below 546 sats) is added to the fee.

### Changed
- "Check an address" is now "Check an address (if known)" (all languages); the "Safer workflow" block moved under "Important".
- Fee rate must be a valid positive number (decimals such as 1.5 are allowed); invalid input is refused instead of silently replaced with 5.
- Fee estimates use the real output size of the recipient and change address types (Legacy, Nested SegWit, Native SegWit, Taproot); "Maximum" uses the same model.
- The fee-hint request has a time limit and its numbers are validated.

## [1.2.0] - 2026-10-16

### Added
- Address-type picker (BIP44 / BIP49 / BIP84 / BIP86): scan only the types you need and finish faster.
- "Check an address" block: look up the type and balance of any address without a seed phrase.
- Gap limit (default 25, can be changed) and account number (default 0) fields with short hints.
- A note that a scan can take a long time.

### Changed
- Two-column layout; the "Safer workflow" block now sits at the top of the right column.
- README: simple download steps (Code → Download ZIP, unpack, open `index.html`).

### Fixed
- Temporary mempool.space outages and rate limits no longer abort a scan: the app waits patiently, slows down only when needed and automatically re-checks failed lookups.
- Every request has a 20-second time limit; malformed or incomplete server answers are rejected instead of being trusted.
- If sending a transaction gets no answer, the app does not retry blindly and warns that it may already have been broadcast.

## [1.1.0] - 2026-10-15

### Added
- Seed phrase entry by word boxes with live validation (12 or 24 words).
- Built-in Help guide.

### Changed
- Simplified for ordinary users: fixed defaults, plain-language README, captions under Passphrase and Account number.

## [1.0.0] - 2026-10-14

### Added
- Scan of a seed phrase across BIP44 / BIP49 / BIP84 / BIP86 receive and change addresses via mempool.space, with signing and sending.
- Interface in English, Russian, Spanish and French.
- Strengthened critical security warning (antivirus, clean device).
- SHA-256 integrity check and official-source link in the README.
- MIT license.

### Security
- All dependencies are bundled into the single file (no CDN); the page is limited by a Content Security Policy to mempool.space only.

### Fixed
- BIP44 send.
- Hardened scanning and input handling.
