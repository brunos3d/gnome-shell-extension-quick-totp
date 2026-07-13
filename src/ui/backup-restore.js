/* backup-restore.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * The "Backup & Restore" preferences group: a native Adwaita front-end over the
 * toolkit-agnostic import/export engine in src/io/. All parsing/serialization
 * lives in the engine; this file only drives file dialogs, confirmations, and
 * result feedback.
 *
 * The grouped import/export layout and workflow are inspired by GNOME
 * Authenticator's Backup & Restore dialog (GPL-3.0-or-later).
 */

import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";

import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import {
  EXPORT_FORMATS,
  Source,
  detectFormat,
} from "../io/formats/registry.js";
import { prepareImport, storeAccounts } from "../io/import-service.js";
import { gatherAccounts, serializeAccounts } from "../io/export-service.js";

Gio._promisify(Gtk.FileDialog.prototype, "open", "open_finish");
Gio._promisify(Gtk.FileDialog.prototype, "save", "save_finish");
Gio._promisify(Adw.MessageDialog.prototype, "choose", "choose_finish");

export const BackupRestoreGroup = GObject.registerClass(
  class BackupRestoreGroup extends Adw.PreferencesGroup {
    #onChanged;

    // onChanged() is invoked after a successful import so the caller can refresh
    // its account list.
    constructor(onChanged) {
      super({
        title: _("Backup & Restore"),
        description: _("Import and export your OTP accounts in many formats."),
      });
      this.#onChanged = onChanged;

      this.add(this.#buildImportRow());
      this.add(this.#buildExportRow());
    }

    #buildImportRow() {
      const expander = new Adw.ExpanderRow({
        title: _("Restore / Import"),
        subtitle: _("Add accounts from another app or a backup file"),
      });

      const fromFile = new Adw.ActionRow({
        title: _("Import from a file…"),
        // Note: gettext must be called at runtime (here), never at module scope.
        subtitle: _(
          "Aegis, andOTP, FreeOTP+, Bitwarden, GNOME Authenticator, Raivo OTP, Google Authenticator, Quick TOTP JSON, or a plain URI list.",
        ),
        activatable: true,
      });
      fromFile.add_prefix(
        new Gtk.Image({ icon_name: "document-import-symbolic" }),
      );
      fromFile.add_suffix(new Gtk.Image({ icon_name: "go-next-symbolic" }));
      fromFile.connect("activated", () => this.#importFromFile());
      expander.add_row(fromFile);

      return expander;
    }

    #buildExportRow() {
      const expander = new Adw.ExpanderRow({
        title: _("Backup / Export"),
        subtitle: _("Save your accounts to a file (unencrypted)"),
      });

      for (const format of EXPORT_FORMATS) {
        const row = new Adw.ActionRow({
          title: format.title,
          subtitle: format.subtitle,
          activatable: true,
        });
        row.add_prefix(new Gtk.Image({ icon_name: "document-save-symbolic" }));
        row.add_suffix(new Gtk.Image({ icon_name: "go-next-symbolic" }));
        row.connect("activated", () => this.#exportToFile(format));
        expander.add_row(row);
      }

      return expander;
    }

    // ---- Import -----------------------------------------------------------

    async #importFromFile() {
      const window = this.root;
      try {
        const dialog = new Gtk.FileDialog({ title: _("Import OTP accounts") });
        dialog.set_filters(this.#buildImportFilters());

        let file;
        try {
          file = await dialog.open(window, null);
        } catch {
          return; // dismissed
        }
        if (!file) return;

        const bytes = readFile(file);
        const detected = detectFormat(bytes, [Source.FILE, Source.TEXT]);
        if (!detected) {
          this.#notify(
            _("Could not recognize this file as a supported OTP backup."),
          );
          return;
        }

        const result = prepareImport(detected.format.id, bytes);
        if (result.valid.length === 0) {
          this.#notify(_("No valid accounts were found in this file."));
          return;
        }

        if (!(await this.#confirmImport(detected.format, result))) return;

        const { added, skipped, failed } = await storeAccounts(result.valid);
        this.#onChanged?.();

        let summary = _("Imported accounts:") + ` ${added}`;
        if (skipped > 0)
          summary += `  ·  ${_("skipped (already present):")} ${skipped}`;
        if (failed.length > 0)
          summary += `  ·  ${_("failed:")} ${failed.length}`;
        this.#notify(summary);
      } catch (e) {
        logError(e);
        this.#notify(_("Import failed:") + ` ${e.message}`);
      }
    }

    async #confirmImport(format, result) {
      const window = this.root;
      const lines = [
        `${_("Format:")} ${format.title}`,
        `${_("Accounts to import:")} ${result.valid.length}`,
      ];
      if (result.duplicatesInFile > 0)
        lines.push(
          `${_("Duplicates in file (merged):")} ${result.duplicatesInFile}`,
        );
      if (result.invalid.length > 0)
        lines.push(
          `${_("Invalid entries (skipped):")} ${result.invalid.length}`,
        );

      const dialog = new Adw.MessageDialog({
        heading: _("Import OTP accounts?"),
        body: lines.join("\n"),
        transient_for: window,
        modal: true,
      });
      dialog.add_response("cancel", _("Cancel"));
      dialog.add_response("import", _("Import"));
      dialog.set_response_appearance(
        "import",
        Adw.ResponseAppearance.SUGGESTED,
      );
      dialog.set_default_response("import");
      dialog.set_close_response("cancel");

      const response = await dialog.choose(window, null);
      return response === "import";
    }

    #buildImportFilters() {
      const store = new Gio.ListStore({ item_type: Gtk.FileFilter });
      const all = new Gtk.FileFilter({
        name: _("OTP backups (JSON, text, URIs)"),
      });
      ["json", "txt", "text", "otpauth"].forEach((s) => all.add_suffix(s));
      all.add_mime_type("application/json");
      all.add_mime_type("text/plain");
      store.append(all);
      const any = new Gtk.FileFilter({ name: _("All files") });
      any.add_pattern("*");
      store.append(any);
      return store;
    }

    // ---- Export -----------------------------------------------------------

    async #exportToFile(format) {
      const window = this.root;
      try {
        const accounts = await gatherAccounts();
        if (accounts.length === 0) {
          this.#notify(_("There are no accounts to export."));
          return;
        }

        if (!(await this.#confirmExport(format, accounts.length))) return;

        const text = serializeAccounts(format.id, accounts);

        const dialog = new Gtk.FileDialog({ title: _("Export OTP accounts") });
        dialog.set_initial_name(`quick-totp-backup.${format.extension}`);

        let file;
        try {
          file = await dialog.save(window, null);
        } catch {
          return; // dismissed
        }
        if (!file) return;

        writeFile(file, text);
        this.#notify(_("Exported accounts:") + ` ${accounts.length}`);
      } catch (e) {
        logError(e);
        this.#notify(_("Export failed:") + ` ${e.message}`);
      }
    }

    async #confirmExport(format, count) {
      const window = this.root;
      const dialog = new Adw.MessageDialog({
        heading: _("Export as unencrypted file?"),
        body:
          `${format.title} — ${count} ${_("account(s)")}\n\n` +
          _(
            "The exported file will contain your OTP secrets in clear text. Store it somewhere safe and delete it when you no longer need it.",
          ),
        transient_for: window,
        modal: true,
      });
      dialog.add_response("cancel", _("Cancel"));
      dialog.add_response("export", _("Export"));
      dialog.set_response_appearance(
        "export",
        Adw.ResponseAppearance.DESTRUCTIVE,
      );
      dialog.set_default_response("cancel");
      dialog.set_close_response("cancel");

      const response = await dialog.choose(window, null);
      return response === "export";
    }

    #notify(message) {
      this.root?.add_toast?.(new Adw.Toast({ title: message, timeout: 5 }));
    }
  },
);

// Read a file's raw bytes synchronously (backups are small).
function readFile(file) {
  const [ok, bytes] = GLib.file_get_contents(file.get_path());
  if (!ok) throw new Error("Could not read the selected file.");
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function writeFile(file, text) {
  const ok = GLib.file_set_contents(
    file.get_path(),
    new TextEncoder().encode(text),
  );
  if (!ok) throw new Error("Could not write the file.");
}
