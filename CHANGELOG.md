# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - Unreleased

Major feature release: comprehensive **import & export**, bringing Quick TOTP
close to GNOME Authenticator's ecosystem compatibility while staying lightweight.

### Added

- **Backup & Restore** preferences group with a native Adwaita workflow:
  auto-detecting file import with a confirmation summary, and per-format export
  with an unencrypted-file warning.
- **Import** from: `otpauth://` URIs (single/multiple/QR), URI-list files, Google
  Authenticator migration QR codes (`otpauth-migration://`), GNOME Authenticator
  (current and legacy), Aegis (plaintext), andOTP (plaintext), FreeOTP+,
  Bitwarden (unencrypted), Raivo OTP (JSON), and Quick TOTP's own JSON. TOTP,
  HOTP, and Steam tokens are all supported.
- **Export** to: Quick TOTP JSON, `otpauth://` URI list, GNOME Authenticator /
  andOTP, Aegis (plaintext), and FreeOTP+.
- A clean, toolkit-agnostic import/export engine under `src/io/`
  (shared model, parsers, serializers, validators, format registry, and
  import/export services), with a minimal built-in Base64 and Protobuf decoder
  (no new runtime dependencies).
- A dependency-free test suite (`npm test`) covering parsers, serializers,
  round-trips, validation, malformed input, and scaling (up to 1000 accounts).
- `docs/import-export.md` documenting every format, the compatibility matrix,
  limitations, and security notes.

### Security

- Imported files are treated as untrusted: every account is validated
  (type, algorithm, digits, period/counter, issuer/name, Base32 secret) before
  being stored, invalid entries are reported rather than dropped, and nothing in
  a file is executed.
- Exports are unencrypted and warn the user before writing; encrypted backup
  variants are intentionally unsupported (documented in `src/io/crypto/`).

### Notes

- Imported accounts use the existing libsecret schema and `OTP` collection —
  no keyring changes, and re-importing skips accounts that already exist.
- Import/export concepts and some test fixtures are derived from GNOME
  Authenticator (GPL-3.0-or-later); see the credits in `docs/import-export.md`.

## [1.0.0] - 2026-07-13

First release of **Quick TOTP**, an independently maintained fork of the
original [TOTP](https://github.com/dkosmari/gnome-shell-extension-totp)
extension by Daniel Kosmari. This release establishes the fork's own identity
and gathers the usability improvements made on top of the original project.

### Added

- **Scrollable OTP list** in the panel menu, capped to a sensible fraction of
  the screen height so long lists never overflow the display.
- **Search / filter field** that focuses automatically when the menu opens and
  filters entries live by issuer, account, and other non-secret attributes.
- **Show / hide codes toggle** to mask all codes at once, with a matching
  accessible label and icon state.
- **Live countdown** for every TOTP entry, showing the remaining seconds and a
  subtle circular progress ring that changes color as the code nears expiry.
- **Full keyboard navigation**: Arrow keys and Tab move between the search field
  and entries, Enter copies the focused (or first matching) code, and Escape
  clears the search before closing the menu.
- **Empty and no-match states** with clear, dimmed messaging.
- `CHANGELOG.md`, `DISCLAIMER.md`, and a `.gitignore` tailored to the project's
  build artifacts.
- `version-name` metadata for release tracking.

### Changed

- Rebranded the project to **Quick TOTP** across metadata, documentation, and
  user-facing strings.
- Adopted a distinct extension identity for the fork: new UUID
  (`quick-totp@brunosilva.io`), GSettings schema
  (`org.gnome.shell.extensions.quick-totp`), and gettext domain
  (`quick-totp@brunosilva.io`).
- Extracted a toolkit-agnostic `CodeController` that drives the live
  code-and-countdown behavior, removing duplicated timer logic shared between
  the preferences window (GTK) and the panel indicator (St/Clutter).
- Refactored the countdown indicator to draw a thin stroked ring instead of a
  filled pie, and refined menu typography and spacing to follow GNOME's
  conventions.
- Rewrote the README to present Quick TOTP as an actively maintained
  continuation, and restructured `AUTHORS` to credit the original author and the
  current maintainer.
- Replaced the legacy Mercurial `.hgignore` with a Git-native `.gitignore`.

### Fixed

- Added defensive error handling for a race condition where the live-code
  callback could fire after its widgets were destroyed (e.g. while the menu was
  closing).
- Corrected a typo ("configurablle") in the extension description.

### Compatibility

- The libsecret schema name used to store OTP secrets is intentionally
  unchanged, so secrets created by the original extension are discovered
  automatically after switching to Quick TOTP. See the migration notes in the
  README.
- All original copyright notices and GPL-3.0-or-later licensing are preserved.

[Unreleased]: https://github.com/brunos3d/gnome-shell-extension-quick-totp/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/brunos3d/gnome-shell-extension-quick-totp/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/brunos3d/gnome-shell-extension-quick-totp/releases/tag/v1.0.0
