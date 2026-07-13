# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-13

First release of **Quick TOTP**, an independently maintained fork of the original
[TOTP](https://github.com/dkosmari/gnome-shell-extension-totp) extension by
Daniel Kosmari. It establishes the fork's own identity, modernizes the code and
documentation, and adds comprehensive import & export — while keeping the
lightweight experience of the original.

### Added

- **Scrollable OTP list** in the panel menu, capped to a sensible fraction of the
  screen height so long lists never overflow the display.
- **Search / filter field** that focuses automatically when the menu opens and
  filters entries live by issuer, account, and other non-secret attributes.
- **Show / hide codes toggle** to mask all codes at once.
- **Live countdown** for every TOTP entry, with a subtle circular progress ring
  that changes color as the code nears expiry.
- **Full keyboard navigation**: Arrow keys and Tab move between the search field
  and entries, Enter copies the focused (or first matching) code, and Escape
  clears the search before closing the menu.
- **Empty and no-match states** with clear messaging.
- **Comprehensive import**: `otpauth://` URIs (single/multiple/QR), URI-list
  files, Google Authenticator migration QR codes (`otpauth-migration://`), GNOME
  Authenticator (current and legacy), Aegis (plaintext), andOTP (plaintext),
  FreeOTP+, Bitwarden (unencrypted), Raivo OTP (JSON), and Quick TOTP's own JSON.
  TOTP, HOTP, and Steam tokens are all supported.
- **Comprehensive export**: Quick TOTP JSON, `otpauth://` URI list, GNOME
  Authenticator / andOTP, Aegis (plaintext), FreeOTP+, and per-account QR codes.
- **Backup & Restore** preferences group with a native Adwaita workflow:
  auto-detecting file import with a confirmation summary, and per-format export
  with an unencrypted-file warning.
- **Remove all secrets** action, with a confirmation dialog, in the preferences
  window.
- A clean, toolkit-agnostic import/export engine under `src/io/` (shared model,
  parsers, serializers, validators, format registry, and services), with a
  minimal built-in Base64 and Protobuf decoder — no new runtime dependencies.
- A dependency-free test suite (`npm test`) covering parsers, serializers,
  round-trips, validation, malformed input, and scaling (up to 1000 accounts).
- Project documentation: `README`, `DISCLAIMER.md`, `SECURITY.md`,
  `CONTRIBUTING.md`, this `CHANGELOG.md`, and `docs/import-export.md`.
- A visual identity (`assets/logo.svg`, `icon.svg`, `social-preview.svg`) and a
  demo screencast.
- npm scripts for building, packing, installing, and development tasks.

### Changed

- Rebranded the project to **Quick TOTP** across metadata, documentation, and
  user-facing strings.
- Adopted a distinct extension identity: UUID `quick-totp@brunosilva.io`,
  GSettings schema `org.gnome.shell.extensions.quick-totp`, and gettext domain
  `quick-totp@brunosilva.io`.
- Extracted a toolkit-agnostic `CodeController` that drives the live
  code-and-countdown behavior, removing duplicated timer logic between the
  preferences window (GTK) and the panel indicator (St/Clutter).
- Refactored the countdown indicator to a thin stroked ring, and refined menu
  typography and spacing to follow GNOME's conventions.
- Reorganized the source tree under `src/` (kebab-case modules) and adopted
  Prettier for consistent formatting.
- Moved the OTP-URI import into the Backup & Restore section and removed the
  unsafe "export all secrets to the clipboard" action.
- Restructured `AUTHORS` to credit the original author and the current
  maintainer, and replaced the legacy Mercurial `.hgignore` with `.gitignore`.

### Security

- Secrets are stored locally in the GNOME Keyring and wiped from memory
  immediately after use; nothing is transmitted to any external server.
- Imported files are treated as untrusted: every account is validated (type,
  algorithm, digits, period/counter, issuer/name, Base32 secret) before being
  stored, invalid entries are reported rather than dropped, and nothing in a file
  is executed.
- Exports are unencrypted and warn before writing; encrypted backup variants are
  intentionally unsupported (documented in `src/io/crypto/`).

### Fixed

- Added defensive error handling for a race where the live-code callback could
  fire after its widgets were destroyed (e.g. while the menu was closing).
- Corrected a typo ("configurablle") in the extension description.

### Compatibility

- The libsecret schema name used to store OTP secrets is intentionally unchanged,
  so secrets created by the original extension are discovered automatically after
  switching to Quick TOTP. See the migration notes in the README.
- Runs on GNOME Shell 45–50.
- All original copyright notices and GPL-3.0-or-later licensing are preserved.
- Import/export concepts and some test fixtures are derived from GNOME
  Authenticator (GPL-3.0-or-later); see `docs/import-export.md`.

[Unreleased]: https://github.com/brunos3d/gnome-shell-extension-quick-totp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/brunos3d/gnome-shell-extension-quick-totp/releases/tag/v1.0.0
