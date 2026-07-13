# Import & Export

Quick TOTP can import and export OTP accounts in many of the formats used across
the wider authenticator ecosystem. This document describes every supported
format, the compatibility matrix, current limitations, and how imported accounts
integrate with your keyring.

The import/export subsystem was designed after studying
[GNOME Authenticator](https://gitlab.gnome.org/World/Authenticator)'s excellent
backup module. See [Credits & attribution](#credits--attribution).

## Where to find it

Open **Quick TOTP → Settings** and use the **Backup & Restore** group:

- **Restore / Import → Import from a file…** — pick a backup file; Quick TOTP
  auto-detects the format, shows how many accounts were found (and how many were
  invalid or duplicated), and asks you to confirm before anything is stored.
- **Backup / Export → &lt;format&gt;** — pick a format; Quick TOTP warns that the
  file is unencrypted, then lets you choose where to save it.

You can also import single/multiple `otpauth://` URIs (and scan QR codes) from
the existing **Import** / **Add secret** actions.

## Architecture

All parsing and serialization lives in `src/io/`, split by responsibility so no
importer logic leaks into the UI:

```
src/io/
  shared/       canonical account model, validators, base64, protobuf, json, uuid
  parsers/      one module per format: bytes/text -> accounts
  serializers/  one module per format: accounts -> bytes/text
  formats/      registry.js — the catalogue that wires parsers/serializers to UI metadata
  crypto/       documentation of the (deliberately unsupported) encrypted variants
  import-service.js / export-service.js   keyring glue (validate, de-dup, store, gather)
```

Every format maps to a single **canonical account**
(`{ type, issuer, name, secret, digits, algorithm, period|counter, steam }`), so
adding a format is a self-contained change and formats interoperate without
N×M conversions.

## Import compatibility matrix

| Source                        | Format                            | How it arrives | Supported              |
| ----------------------------- | --------------------------------- | -------------- | ---------------------- |
| otpauth URI                   | `otpauth://totp\|hotp\|steam/…`   | text / QR      | ✅                     |
| otpauth URI list              | one URI per line                  | file / text    | ✅                     |
| Google Authenticator          | `otpauth-migration://` (protobuf) | QR / text      | ✅                     |
| GNOME Authenticator (current) | plain JSON (andOTP-compatible)    | file           | ✅                     |
| GNOME Authenticator (legacy)  | plain JSON                        | file           | ✅                     |
| Aegis                         | plain JSON vault                  | file           | ✅                     |
| Aegis (encrypted)             | scrypt + AES-256-GCM              | file           | ❌ _(see limitations)_ |
| andOTP                        | plain JSON                        | file           | ✅                     |
| andOTP (encrypted)            | PBKDF2 + AES-256-GCM              | file           | ❌                     |
| FreeOTP+                      | plain JSON                        | file           | ✅                     |
| FreeOTP (`.xml` keystore)     | Android KeyStore                  | file           | ❌                     |
| Bitwarden                     | unencrypted JSON export           | file           | ✅                     |
| Raivo OTP                     | JSON (extract from `.zip`)        | file           | ✅                     |
| Quick TOTP                    | its own JSON                      | file           | ✅                     |
| TOTP / HOTP / Steam           | via any of the above              | —              | ✅                     |

## Export compatibility matrix

| Target                       | Format             | Extension | Supported                          |
| ---------------------------- | ------------------ | --------- | ---------------------------------- |
| Quick TOTP                   | plain JSON         | `.json`   | ✅                                 |
| otpauth URI list             | one URI per line   | `.txt`    | ✅                                 |
| GNOME Authenticator / andOTP | plain JSON         | `.json`   | ✅                                 |
| Aegis                        | plain JSON vault   | `.json`   | ✅                                 |
| FreeOTP+                     | plain JSON         | `.json`   | ✅                                 |
| QR code (single account)     | PNG via `qrencode` | image     | ✅ _(existing per-account action)_ |
| Encrypted variants           | —                  | —         | ❌                                 |

Single-account export is available from each account's row (copy URI / export QR);
multi-account backup is the Backup & Restore group described above.

## Format notes & examples

### otpauth:// URIs

The lingua franca of OTP apps
([Key Uri Format](https://github.com/google/google-authenticator/wiki/Key-Uri-Format)):

```
otpauth://totp/ACME%20Co:john.doe@email.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=ACME%20Co&algorithm=SHA1&digits=6&period=30
otpauth://hotp/Issuu:James?secret=YOOMIXWS5GN6RTBPUFFWKTW5M4&issuer=Issuu&counter=1
otpauth://steam/Valve:me?secret=JRZCL47CMXVOQMNPZR2F7J4RGI&digits=5
```

`steam://` hosts and `otpauth://steam/` are mapped to Quick TOTP's Steam token
(issuer `Steam`, 5 digits).

### Google Authenticator

Google exports one or more accounts inside a single QR code encoding an
`otpauth-migration://offline?data=<base64 protobuf>` URI. Quick TOTP decodes the
protobuf directly (no external dependency).

### Aegis / andOTP / GNOME Authenticator / FreeOTP+ / Bitwarden / Raivo

All imported from their **plaintext** JSON exports. GNOME Authenticator's current
backup is andOTP-compatible, so one importer serves both. Raivo ships its JSON
inside a `.zip`; extract the JSON first.

### Quick TOTP JSON

```json
{
  "app": "Quick TOTP",
  "version": 1,
  "accounts": [
    {
      "type": "TOTP",
      "issuer": "Example",
      "name": "me",
      "secret": "JBSWY3DPEHPK3PXP",
      "digits": 6,
      "algorithm": "SHA-1",
      "period": 30
    }
  ]
}
```

## Limitations

- **Encrypted backups are not supported.** Aegis, andOTP, GNOME Authenticator
  (encrypted), FreeOTP `.xml`, and Raivo's encrypted `.zip` rely on scrypt /
  PBKDF2 / AES-256-GCM, which GNOME Shell's GJS runtime does not provide. Adding
  them would require an unwanted crypto dependency in a shell extension. Export
  an **unencrypted** variant from the source app, or extract the JSON, then
  import that. Quick TOTP rejects encrypted files with a clear message rather
  than failing silently. Details: [`src/io/crypto/README.md`](../src/io/crypto/README.md).
- **Icons, notes, tags, and groups** carried by some formats are not imported or
  exported — only the fields needed to generate codes are kept.
- **Raivo `.zip`** must be extracted to its inner JSON before importing.

## Security

- Imports are treated as untrusted. Every entry is validated (type, algorithm,
  digits, period/counter, issuer/name length, Base32 secret) before it can reach
  the keyring; invalid entries are reported, never silently dropped.
- Nothing in an imported file is executed; only recognized data fields are read.
- Exported files contain secrets **in clear text**. Quick TOTP warns before
  writing and recommends deleting the file when no longer needed.
- See [`SECURITY.md`](../SECURITY.md).

## Migration & keyring integration

Imported accounts are stored through the same libsecret schema and `OTP`
collection Quick TOTP already uses, so they appear immediately alongside your
existing accounts and are indistinguishable from manually-added ones. The keyring
schema is **unchanged** — existing users are unaffected. Re-importing the same
file is safe: accounts that already exist (same issuer/name/type/algorithm/digits)
are skipped.

## Testing

The engine is covered by a dependency-free suite (`npm test`) with parser,
serializer, round-trip, validation, malformed-input, and scaling tests, several
of which reuse GNOME Authenticator's own test fixtures to guarantee faithful
interoperability.

## Credits & attribution

Quick TOTP's import/export design — the canonical "restorable item" model, the
per-format parser/serializer split, the set of supported formats, and the
Backup & Restore UX — was informed by studying
[GNOME Authenticator](https://gitlab.gnome.org/World/Authenticator) (GPL-3.0-or-later).

No code was copied verbatim; the concepts were re-implemented in JavaScript for
Quick TOTP's architecture. Some **test fixtures and expected values** under
`tests/fixtures/` are taken from GNOME Authenticator's backup test suite to
verify compatibility. Quick TOTP is likewise distributed under GPL-3.0-or-later,
satisfying the license's attribution requirements.

With gratitude to Authenticator's authors and contributors.
