# Encryption support

This directory is a placeholder that documents a deliberate limitation.

Several backup formats support **password-encrypted** variants:

| Format                          | Encryption                 |
| ------------------------------- | -------------------------- |
| Aegis (encrypted)               | scrypt (KDF) + AES-256-GCM |
| andOTP (encrypted)              | PBKDF2 + AES-256-GCM       |
| GNOME Authenticator (encrypted) | reuses the andOTP scheme   |
| FreeOTP (`.xml` keystore)       | Android KeyStore / PBE     |
| Raivo (encrypted ZIP)           | ZIP + password             |

Quick TOTP runs inside GNOME Shell's GJS runtime, which exposes **GLib**
(hashing/HMAC only) but **no AES, no scrypt, and no PBKDF2**. Implementing these
would require either bundling a JavaScript crypto library (an unwanted runtime
dependency for a shell extension) or shelling out to an external tool with a
fragile, format-specific command line.

For that reason, Quick TOTP imports and exports the **plaintext** variant of
every format, and clearly rejects encrypted files with an actionable message
("export an unencrypted vault to import it"). This keeps the security surface
small and the dependency footprint zero.

If a future revision adds a vetted crypto primitive, encrypted variants can be
implemented behind the same parser/serializer interfaces used here — the format
registry is designed to make that a drop-in change.

See `docs/import-export.md` for the full compatibility matrix.
