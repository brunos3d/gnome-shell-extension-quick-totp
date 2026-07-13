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

| Path                                                | Purpose                                                    |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `extension.js`                                      | Extension entry point (enable/disable).                    |
| `indicator.js`                                      | Panel button and the OTP menu (St/Clutter UI).             |
| `prefs.js`                                          | Preferences window (GTK/Adw).                              |
| `codeController.js`                                 | Toolkit-agnostic controller for the live code + countdown. |
| `secretUtils.js`                                    | GNOME Keyring / libsecret access (storage of secrets).     |
| `otp.js`, `totp.js`, `hotp.js`                      | OTP model and RFC 4226 / 6238 code generation.             |
| `base32.js`                                         | Base32 encode/decode (RFC 4648).                           |
| `myAlertDialog.js`, `myEntryRow.js`, `mySpinRow.js` | Fallbacks for older GTK/Adw.                               |
| `schemas/`                                          | GSettings schema.                                          |
| `po/`                                               | Translations (gettext).                                    |
| `icons/`, `icons.gresource.xml`                     | Bundled symbolic icons.                                    |
| `stylesheet.css`, `prefs.css`                       | Styles for the menu and preferences.                       |

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

There is no automated test suite yet. Before opening a pull request, please:

1. **Syntax-check** every JavaScript file you touched:

   ```sh
   for f in *.js; do node --check "$f" || echo "FAIL $f"; done
   ```

2. **Build** the extension (`make`) and confirm it packs without errors.

3. **Manually verify** the behavior you changed — panel menu, search, keyboard
   navigation, show/hide, countdown, and (for secret-related changes) that
   existing OTP secrets are still discovered and codes are still correct.

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
