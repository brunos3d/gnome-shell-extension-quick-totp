# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/brunos3d/gnome-shell-extension-totp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/brunos3d/gnome-shell-extension-totp/releases/tag/v1.0.0
