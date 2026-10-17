# Changelog

All notable changes to Bitcoin Seed Scanner are listed here, newest first.
Minor tweaks (wording, layout fixes, hash refreshes) are not included.

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
