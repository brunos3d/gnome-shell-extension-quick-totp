# Contributing to Quick TOTP

Thanks for your interest in improving Quick TOTP! Contributions of all kinds are
welcome — bug reports, feature requests, translations, documentation, and code.

## Project philosophy

- **Security first.** OTP secrets are sensitive. Changes must preserve local-only
  storage in the GNOME Keyring and never introduce network transmission of
  secrets or codes.
- **Feel native.** The extension should look and behave like a first-party GNOME
  component — consistent spacing, theming, keyboard behavior, and accessibility.
- **Keep it simple.** Prefer small, readable, idiomatic changes over clever ones.
  Reduce complexity and dead code where you can.
- **Compatibility matters.** The extension targets several GNOME Shell releases
  (see the README). Use runtime version guards rather than dropping support.

## Repository structure

GNOME Shell requires `extension.js`, `prefs.js`, `metadata.json`, and
`stylesheet.css` to live at the extension root; all other source lives under
`src/`.

```
extension.js              Extension entry point (enable/disable).
prefs.js                  Preferences window (GTK/Adw).
metadata.json             Extension manifest.
stylesheet.css            Panel menu styles (auto-loaded by the shell).
icons.gresource.xml       Symbolic-icon bundle manifest.
icons/                    Bundled symbolic icons.
schemas/                  GSettings schema.
po/                       Translations (gettext).
assets/                   Branding and screenshots (repo only, not packaged).
src/
  utils/
    base32.js             Base32 encode/decode (RFC 4648).
  otp/
    otp.js                OTP model + shared code generation.
    totp.js               Time-based OTP (RFC 6238).
    hotp.js               Counter-based OTP (RFC 4226).
  services/
    secret-utils.js       GNOME Keyring / libsecret access.
    code-controller.js    Toolkit-agnostic live code + countdown controller.
  ui/
    indicator.js          Panel button and the OTP menu (St/Clutter).
    backup-restore.js     "Backup & Restore" preferences group (Adwaita).
    prefs.css             Preferences window styles.
    widgets/
      my-alert-dialog.js  Fallbacks for older GTK/Adw.
      my-entry-row.js
      my-spin-row.js
  io/                     Toolkit-agnostic import/export engine (see below).
    shared/               Canonical account model, validators, base64, protobuf.
    parsers/              One module per format: bytes/text -> accounts.
    serializers/          One module per format: accounts -> bytes/text.
    formats/registry.js   Catalogue wiring parsers/serializers to UI metadata.
    import-service.js     Validate, de-duplicate, and store into the keyring.
    export-service.js     Gather accounts (with secrets) and serialize.
    crypto/               Documents the (deliberately unsupported) encrypted formats.
tests/                    Dependency-free test suite (node tests/run.mjs).
docs/                     Longer-form documentation (e.g. import-export.md).
```

The import/export engine under `src/io/` is pure JavaScript with no GNOME
dependencies, so it can be unit-tested with plain `node`. Only the UI
(`src/ui/backup-restore.js`) and the two services touch GTK/libsecret. Adding a
new format is a self-contained change: add a parser and/or serializer, then one
entry in `formats/registry.js`. See [`docs/import-export.md`](docs/import-export.md).

## Development setup

Prerequisites:

- [make](https://www.gnu.org/software/make/)
- [jq](https://stedolan.github.io/jq/)
- `glib-compile-resources` (from `glib2-devel` / `glib2.0-common` /
  `libgio-2.0-dev-bin`, depending on your distribution)

Clone and install the extension into your user extensions directory:

```sh
git clone https://github.com/brunos3d/gnome-shell-extension-totp.git
cd gnome-shell-extension-totp
make install
```

Then reload GNOME Shell (log out and back in on Wayland; `Alt`+`F2` → `r` on X11)
and enable **Quick TOTP**.

Useful during development:

```sh
# Follow logs from the extension and the shell
journalctl -f -o cat /usr/bin/gnome-shell

# Inspect preferences output
journalctl -f -o cat /usr/bin/gjs
```

On X11 you can also iterate in a nested shell without touching your session:

```sh
dbus-run-session -- gnome-shell --nested --wayland
```

## Build instructions

```sh
make            # build the packaged zip (quick-totp@brunosilva.io.shell-extension.zip)
make install    # build and install into ~/.local/share/gnome-shell/extensions
make clean      # remove build artifacts
make update-po  # refresh translation catalogs from the sources
```

## Testing

The import/export engine has an automated, dependency-free test suite. Before
opening a pull request, please:

1. **Run the test suite** (parsers, serializers, round-trips, validation,
   malformed input, and scaling):

   ```sh
   npm test
   ```

2. **Syntax-check** every JavaScript file you touched:

   ```sh
   for f in extension.js prefs.js $(find src -name "*.js"); do
     node --check "$f" || echo "FAIL $f"
   done
   ```

3. **Build** the extension (`make`) and confirm it packs without errors.

4. **Manually verify** the behavior you changed — panel menu, search, keyboard
   navigation, show/hide, countdown, import/export, and (for secret-related
   changes) that existing OTP secrets are still discovered and codes are correct.

When adding a format, add a parser/serializer test under `tests/` (reuse or add a
fixture in `tests/fixtures/`).

Some modules include self-contained reference vectors (see the RFC 4226 test
cases in `otp/hotp.js` and the commented Base32 test in `utils/base32.js`) that
are handy when changing code generation.

Some modules include self-contained reference vectors (see the RFC 4226 test
cases in `hotp.js` and the commented Base32 test in `base32.js`) that are handy
when changing code generation.

## Code style

Formatting is handled by [Prettier](https://prettier.io/) using the settings in
`.prettierrc`, so you don't have to format by hand. Before committing, run:

```sh
npm install     # once, to get the pinned Prettier version
npm run format  # format everything (or: npm run format:check)
```

A few conventions Prettier does not enforce, but that we still follow:

- Prefer `const`, then `let`; never `var`.
- Private class members use `#` fields.
- GObject classes are created with `GObject.registerClass`.
- Wrap all user-facing strings in `gettext` (`_()`); backend modules that must
  avoid a hard dependency use the `const _ = x => x;` passthrough so strings are
  still extractable.
- Write comments that explain _why_, not _what_.

## Pull request guidelines

- Keep pull requests focused; one logical change per PR is easiest to review.
- Describe the motivation and the user-visible effect, and note the GNOME Shell
  version(s) you tested on.
- Update `CHANGELOG.md` (under "Unreleased") for user-facing changes.
- If you add or change user-facing strings, run `make update-po`.
- Do not rewrite Git history on shared branches, and do not remove existing
  copyright or license headers.

## Commit messages

This project prefers [Conventional Commits](https://www.conventionalcommits.org/).
Use a type prefix and an imperative summary:

```
feat: add per-entry countdown ring to the panel menu
fix: avoid crash when the menu closes mid-refresh
docs: document the migration from the original extension
refactor: extract shared code controller
build: rename gettext domain for the fork
chore: update translation catalogs
```

## Code of conduct

Please keep interactions respectful and constructive. Assume good faith, be
welcoming to newcomers, and focus feedback on the code and ideas rather than the
person. Everyone contributing here is doing so to make the project better.
