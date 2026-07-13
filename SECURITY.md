# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Quick TOTP, please report it
responsibly and **privately** so it can be addressed before public disclosure.

- Preferred: open a [GitHub security advisory](https://github.com/brunos3d/gnome-shell-extension-totp/security/advisories/new)
  ("Report a vulnerability"), which keeps the report private.
- Please do **not** open a public issue for security-sensitive reports.

When reporting, include as much detail as you can:

- a description of the issue and its potential impact,
- steps to reproduce,
- the GNOME Shell version and distribution you are using,
- and the Quick TOTP version (see `metadata.json` or the extension's page).

You can expect an initial acknowledgement, and we will keep you informed as the
issue is investigated and resolved.

## How your secrets are handled

- **Local storage only.** OTP secrets are stored locally on your machine using
  the [GNOME Keyring](https://wiki.gnome.org/Projects/GnomeKeyring) via
  `libsecret`, in a dedicated collection named "OTP" that you can lock with its
  own password.
- **No external transmission.** The extension does **not** send your OTP secrets,
  generated codes, or account information to any external or third-party server.
  All code generation happens locally.
- **Minimal exposure in memory.** During normal use, a secret is loaded only when
  needed to generate a code and is wiped from memory immediately afterwards.
- **Clipboard hygiene.** Sensitive data copied to the clipboard (such as
  `otpauth://` URIs) is automatically cleared after a configurable delay.

Optional integrations you enable yourself — such as scanning or exporting QR
codes — invoke external command-line tools (for example `zbar` or `qrencode`)
that must already be installed on your system. These run locally and are not part
of any network communication.

## Importing and exporting

- **Imports are untrusted input.** Every account parsed from a file or QR code is
  validated (type, algorithm, digits, period/counter, issuer/name length, and
  Base32 secret) before it can be written to the keyring. Malformed entries are
  reported to you and skipped — never silently accepted or executed. No content
  from an imported file is evaluated as code.
- **Exports are unencrypted.** An exported backup contains your OTP secrets in
  clear text. Quick TOTP warns you before writing one and recommends storing it
  securely and deleting it when no longer needed.
- **Encrypted backup formats are intentionally not supported**, because the GNOME
  Shell runtime lacks the required cryptographic primitives; this keeps the
  security surface small and avoids bundling crypto into a shell extension. See
  [`docs/import-export.md`](docs/import-export.md) and
  [`src/io/crypto/README.md`](src/io/crypto/README.md).

## Priority

Security issues that could expose or compromise user secrets are treated with
**high priority** and will be investigated promptly.

## Supported versions

Security fixes are provided for the latest released version of Quick TOTP. Please
make sure you are running an up-to-date version before reporting an issue.
