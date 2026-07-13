# Test fixtures

These files are sample backups used to verify the import/export parsers.

The following fixtures are taken from
[GNOME Authenticator](https://gitlab.gnome.org/World/Authenticator)'s backup test
suite (`src/backup/tests/`), which is licensed **GPL-3.0-or-later** — the same
license as Quick TOTP. They are reused here to guarantee that Quick TOTP's
parsers produce results compatible with Authenticator:

- `aegis_plain.json`
- `andotp_plain.json`
- `bitwarden.json`
- `freeotp_plus.json` (Authenticator's `freeotp_json.json`)
- `plain_uris.txt` (Authenticator's `plain.txt`)

`raivo.json` is an original fixture created for Quick TOTP (Raivo's real export
is a ZIP archive; this is its inner JSON, hand-written from the documented
schema).

With gratitude to GNOME Authenticator's authors and contributors.
