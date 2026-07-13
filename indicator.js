/* indicator.js
 * Copyright (C) 2025  Daniel K. O.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Pango from "gi://Pango";
import St from "gi://St";

import * as Config from "resource:///org/gnome/shell/misc/config.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import CodeController from "./codeController.js";
import HOTP from "./hotp.js";
import * as SecretUtils from "./secretUtils.js";
import TOTP from "./totp.js";

import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

// St.ScrollView changed its child/scrollbar API in GNOME 46.
const SHELL_MAJOR = parseInt(Config.PACKAGE_VERSION.split(".")[0]);

function copyToClipboard(text) {
  // this runs inside gnome-shell, so we use St
  let clipboard = St.Clipboard.get_default();
  clipboard.set_text(St.ClipboardType.PRIMARY, text);
  clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
  Main.notify(_("OTP code copied to clipboard."), text);
}

function makeLabel({ issuer, name }) {
  return `${issuer}: ${name}`;
}

// Small circular countdown drawn with cairo. The color is taken from the CSS
// foreground color, and the state classes (full/high/low) mirror the LevelBar
// offsets used in the preferences window, so both menus feel consistent.
const CountdownIndicator = GObject.registerClass(
  class TotpCountdownIndicator extends St.DrawingArea {
    #fraction = 1;

    constructor() {
      super({
        style_class: "totp-countdown full",
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
      });
    }

    setState(fraction, remaining) {
      fraction = Math.max(0, Math.min(1, fraction));

      let state = "full";
      if (remaining <= 5) state = "low";
      else if (remaining <= 10) state = "high";

      const style_class = `totp-countdown ${state}`;
      let changed = false;

      if (this.style_class != style_class) {
        this.style_class = style_class;
        changed = true;
      }
      if (Math.abs(fraction - this.#fraction) > 0.001) {
        this.#fraction = fraction;
        changed = true;
      }

      // Only repaint when something actually changed.
      if (changed) this.queue_repaint();
    }

    vfunc_repaint() {
      const [width, height] = this.get_surface_size();
      const cr = this.get_context();

      try {
        const color = this.get_theme_node().get_foreground_color();
        const red = color.red / 255;
        const green = color.green / 255;
        const blue = color.blue / 255;
        const alpha = color.alpha / 255;

        // A thin ring reads as a subtle status indicator rather than a bold
        // element that competes with the OTP code.
        const line_width = 2;
        const radius = Math.min(width, height) / 2 - line_width;
        const cx = width / 2;
        const cy = height / 2;

        cr.setLineWidth(line_width);

        // faint background track (full circle)
        cr.setSourceRGBA(red, green, blue, alpha * 0.2);
        cr.arc(cx, cy, radius, 0, 2 * Math.PI);
        cr.stroke();

        // remaining arc, starting at 12 o'clock going clockwise
        if (this.#fraction > 0) {
          const start = -Math.PI / 2;
          const end = start + 2 * Math.PI * this.#fraction;
          cr.setSourceRGBA(red, green, blue, alpha);
          cr.arc(cx, cy, radius, start, end);
          cr.stroke();
        }
      } finally {
        cr.$dispose();
      }
    }
  },
);

// A single OTP entry: copy icon, issuer/name title, live code, remaining
// seconds and a circular countdown. The countdown/refresh logic is shared with
// the preferences window through CodeController.
const OTPMenuItem = GObject.registerClass(
  class TotpOTPMenuItem extends PopupMenu.PopupBaseMenuItem {
    #controller;
    #countdown;
    #code_label;
    #remaining_label;
    #code = null;
    #masked = false;

    constructor(otp, label, haystack, on_activate) {
      super();

      this.add_style_class_name("totp-otp-item");

      this.otp = otp;
      this.haystack = haystack;

      this.add_child(
        new St.Icon({
          style_class: "popup-menu-icon",
          icon_name: "edit-copy-symbolic",
          y_align: Clutter.ActorAlign.CENTER,
        }),
      );

      const text_box = new St.BoxLayout({
        style_class: "totp-text-box",
        vertical: true,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
      });
      this.add_child(text_box);

      // Primary: issuer/account. Ellipsized so long names never push the
      // countdown out of the row.
      const title_label = new St.Label({
        style_class: "totp-title-label",
        text: label,
        x_expand: true,
      });
      title_label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
      text_box.add_child(title_label);

      const sub_box = new St.BoxLayout({
        style_class: "totp-subtitle-box",
        y_align: Clutter.ActorAlign.CENTER,
      });
      text_box.add_child(sub_box);

      // Secondary: the OTP code, made to stand out via monospace + weight.
      this.#code_label = new St.Label({
        style_class: "totp-code-label",
        text: "…", // ellipsis while loading
        y_align: Clutter.ActorAlign.CENTER,
      });
      sub_box.add_child(this.#code_label);

      // Tertiary: remaining seconds, visually lighter.
      this.#remaining_label = new St.Label({
        style_class: "totp-remaining-label",
        text: "",
        y_align: Clutter.ActorAlign.CENTER,
      });
      this.#remaining_label.opacity = 160;
      sub_box.add_child(this.#remaining_label);

      // Status: subtle countdown ring, right-aligned and vertically centered.
      this.#countdown = new CountdownIndicator();
      if (otp.type != "TOTP") this.#countdown.visible = false;
      this.add_child(this.#countdown);

      this.connect("activate", () => on_activate(this.otp));

      this.#controller = new CodeController(otp, this.render.bind(this));
    }

    start() {
      this.#controller.start();
    }

    stop() {
      this.#controller.stop();
    }

    // Toggle whether the code is shown or masked with bullets. Purely a
    // display concern; copying always uses the real code.
    setMasked(masked) {
      this.#masked = masked;
      this.#renderCode();
    }

    #renderCode() {
      if (this.#code == null) {
        this.#code_label.text = "…"; // still loading
        return;
      }
      this.#code_label.text = this.#masked
        ? "•".repeat(this.otp.digits)
        : this.#code;
    }

    render({ locked, code, remaining, fraction, type, error }) {
      if (error) {
        this.#code = null;
        this.#code_label.text = _("Error");
        this.#remaining_label.text = "";
        this.reactive = false;
        return;
      }

      if (locked) {
        this.#code = null;
        this.#code_label.text = _("Locked");
        this.#remaining_label.text = "";
        if (type == "TOTP") this.#countdown.setState(0, 0);
        return;
      }

      this.#code = code ?? null;
      this.#renderCode();

      if (type == "TOTP") {
        const secs = Math.ceil(remaining);
        this.#remaining_label.text = `${secs} s`;
        this.#countdown.setState(fraction, remaining);
      } else {
        this.#remaining_label.text = "";
      }
    }

    destroy() {
      this.#controller.stop();
      super.destroy();
    }
  },
);

export default class Indicator extends PanelMenu.Button {
  static {
    GObject.registerClass(this);
  }

  #ext;
  #lock_item;
  #unlock_item;
  #search_entry;
  #scroll;
  #section;
  #empty_item;
  #empty_label;
  #visibility_button;
  #visibility_icon;
  #codes_hidden = false;
  #otp_items = [];
  #focus_source = 0;

  constructor(ext) {
    super();

    this.#ext = ext;

    this.add_child(
      new St.Icon({
        icon_name: "changes-prevent-symbolic",
        style_class: "system-status-icon",
      }),
    );

    // --- Search field (always at the top) ---
    const search_item = new PopupMenu.PopupBaseMenuItem({
      style_class: "totp-search-item",
      reactive: false,
      can_focus: false,
    });
    this.#search_entry = new St.Entry({
      style_class: "totp-search-entry",
      hint_text: _("Type to search…"),
      can_focus: true,
      x_expand: true,
    });
    this.#search_entry.set_primary_icon(
      new St.Icon({
        style_class: "totp-search-icon",
        icon_name: "edit-find-symbolic",
      }),
    );
    search_item.add_child(this.#search_entry);

    // Show/hide-codes toggle button, right of the search field.
    this.#visibility_icon = new St.Icon({
      style_class: "popup-menu-icon",
      icon_name: "view-conceal-symbolic",
    });
    this.#visibility_button = new St.Button({
      style_class: "totp-visibility-button",
      child: this.#visibility_icon,
      can_focus: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this.#visibility_button.connect(
      "clicked",
      this.toggleCodesVisibility.bind(this),
    );
    search_item.add_child(this.#visibility_button);
    this.updateVisibilityButton();

    this.menu.addMenuItem(search_item);

    this.#search_entry.clutter_text.connect(
      "text-changed",
      this.applyFilter.bind(this),
    );
    this.#search_entry.clutter_text.connect(
      "key-press-event",
      this.onSearchKeyPress.bind(this),
    );

    // --- Actions ---
    this.#lock_item = this.menu.addAction(
      _("Lock OTP secrets"),
      this.lockOTPSecrets.bind(this),
      "changes-prevent-symbolic",
    );

    this.#unlock_item = this.menu.addAction(
      _("Unlock OTP secrets..."),
      this.unlockOTPSecrets.bind(this),
      "changes-allow-symbolic",
    );
    this.#unlock_item.visible = !this.#lock_item.visible;

    this.menu.addAction(
      _("Settings..."),
      this.editOTPSecrets.bind(this),
      "preferences-other-symbolic",
    );

    this.menu.addMenuItem(
      new PopupMenu.PopupSeparatorMenuItem(_("OTP Secrets")),
    );

    // --- Scrollable OTP list ---
    this.#scroll = new St.ScrollView({
      style_class: "totp-scroll",
      overlay_scrollbars: false,
      x_expand: true,
      y_expand: true,
    });
    if (SHELL_MAJOR >= 46) {
      this.#scroll.hscrollbar_policy = St.PolicyType.NEVER;
      this.#scroll.vscrollbar_policy = St.PolicyType.AUTOMATIC;
    } else {
      this.#scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    }

    // The section is added to the menu (so items get a proper parent chain
    // for activation/close), then its actor is reparented into the scroll
    // view for the actual layout.
    this.#section = new PopupMenu.PopupMenuSection();
    this.menu.addMenuItem(this.#section);
    this.menu.box.remove_child(this.#section.actor);
    if (SHELL_MAJOR >= 46) this.#scroll.add_child(this.#section.actor);
    else this.#scroll.add_actor(this.#section.actor);
    this.menu.box.add_child(this.#scroll);

    // --- Empty state ---
    this.#empty_item = new PopupMenu.PopupBaseMenuItem({
      style_class: "totp-empty-item",
      reactive: false,
      can_focus: false,
    });
    this.#empty_label = new St.Label({
      style_class: "totp-empty-label",
      text: _("No OTP secrets."),
      x_align: Clutter.ActorAlign.CENTER,
      x_expand: true,
    });
    this.#empty_label.opacity = 160;
    this.#empty_item.add_child(this.#empty_label);
    this.menu.addMenuItem(this.#empty_item);
    this.#empty_item.visible = false;

    Main.panel.addToStatusArea(ext.uuid, this);
  }

  _init() {
    super._init(0.5, "Quick TOTP");
  }

  destroy() {
    this.cancelFocus();
    this.clearOTPItems();
    super.destroy();
  }

  async _onOpenStateChanged(menu, is_open) {
    super._onOpenStateChanged(menu, is_open);

    try {
      if (!is_open) {
        this.cancelFocus();
        this.clearOTPItems();
        return;
      }

      // Fresh start: clear any previous search text.
      this.#search_entry.set_text("");

      let locked = await SecretUtils.isOTPCollectionLocked();
      this.#lock_item.visible = !locked;
      this.#unlock_item.visible = locked;

      if (locked) {
        this.clearOTPItems();
        this.#empty_item.visible = false;
      } else {
        await this.refreshOTPItems();
      }

      // Automatically focus the search field so the user can type
      // immediately. Deferred to idle so the entry is mapped first.
      this.cancelFocus();
      this.#focus_source = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        this.#focus_source = 0;
        this.#search_entry.grab_key_focus();
        return GLib.SOURCE_REMOVE;
      });
    } catch (e) {
      logError(e);
    }
  }

  cancelFocus() {
    if (this.#focus_source) {
      GLib.Source.remove(this.#focus_source);
      this.#focus_source = 0;
    }
  }

  toggleCodesVisibility() {
    this.#codes_hidden = !this.#codes_hidden;
    this.updateVisibilityButton();
    this.#otp_items.forEach((item) => item.setMasked(this.#codes_hidden));
    // Keep typing uninterrupted after toggling.
    this.#search_entry.grab_key_focus();
  }

  updateVisibilityButton() {
    this.#visibility_icon.icon_name = this.#codes_hidden
      ? "view-reveal-symbolic"
      : "view-conceal-symbolic";
    const label = this.#codes_hidden
      ? _("Show OTP codes")
      : _("Hide OTP codes");
    this.#visibility_button.accessible_name = label;
  }

  async lockOTPSecrets() {
    try {
      if (!(await SecretUtils.lockOTPCollection()))
        // Sometimes the keyring locks just fine, yet it reports incorrectly that
        // nothing was locked. So we double check here.
        if (!(await SecretUtils.isOTPCollectionLocked()))
          Main.notify(_("Failed to lock OTP secrets."));
    } catch (e) {
      logError(e);
      Main.notifyError(_("Error locking OTP secrets."), _(e.message));
    }
  }

  async unlockOTPSecrets() {
    try {
      if (!(await SecretUtils.unlockOTPCollection()))
        // Sometimes the keyring unlocks just fine, yet it reports incorrectly
        // that nothing was unlocked. So we double check here.
        if (await SecretUtils.isOTPCollectionLocked())
          Main.notify(_("Failed to unlock OTP secrets."));
    } catch (e) {
      logError(e);
      Main.notifyError(_("Error unlocking OTP secrets."), _(e.message));
    }
  }

  editOTPSecrets() {
    this.#ext.openPreferences();
  }

  async refreshOTPItems() {
    try {
      let secrets = await SecretUtils.getOTPItems();
      this.clearOTPItems();
      secrets.forEach((x) => {
        let otp = null;
        let args = x.get_attributes();
        if (args.type == "TOTP") otp = new TOTP(args);
        if (args.type == "HOTP") otp = new HOTP(args);
        if (otp == null) throw Error(`BUG: args.type is ${args.type}`);

        const label = makeLabel(otp);

        // Build a searchable haystack out of every meaningful, non-secret
        // attribute plus the visible label.
        const parts = [];
        for (const [key, value] of Object.entries(args)) {
          if (key == "secret" || !value) continue;
          parts.push(value);
        }
        parts.push(label);
        const haystack = parts.join(" ").toLowerCase();

        const item = new OTPMenuItem(
          otp,
          label,
          haystack,
          this.copyCode.bind(this),
        );
        item.connect("key-press-event", (actor, event) =>
          this.onItemKeyPress(item, event),
        );
        item.connect("key-focus-in", () => this.ensureVisible(item));

        item.setMasked(this.#codes_hidden);

        this.#section.addMenuItem(item);
        this.#otp_items.push(item);
        item.start();
      });

      this.updateMaxHeight();
      this.applyFilter();
    } catch (e) {
      logError(e);
      Main.notifyError(_("Error retrieving OTP items."), _(e.message));
    }
  }

  updateMaxHeight() {
    const monitor = Main.layoutManager.primaryMonitor;
    if (!monitor) return;
    // Never let the list exceed a sensible fraction of the screen height.
    const max_height = Math.max(200, Math.round(monitor.height * 0.6));
    this.#scroll.style = `max-height: ${max_height}px;`;
  }

  clearOTPItems() {
    this.#otp_items.forEach((x) => x.stop());
    this.#section.removeAll();
    this.#otp_items = [];
  }

  visibleItems() {
    return this.#otp_items.filter((item) => item.visible);
  }

  applyFilter() {
    const query = this.#search_entry.get_text().toLowerCase().trim();

    let visible = 0;
    for (const item of this.#otp_items) {
      const match = query == "" || item.haystack.includes(query);
      item.visible = match;
      if (match) ++visible;
    }

    if (this.#otp_items.length == 0) {
      this.#empty_label.text = _("No OTP secrets.");
      this.#empty_item.visible = true;
    } else if (visible == 0) {
      this.#empty_label.text = _("No matching OTP secrets.");
      this.#empty_item.visible = true;
    } else {
      this.#empty_item.visible = false;
    }
  }

  focusItem(item) {
    item.grab_key_focus();
    this.ensureVisible(item);
  }

  focusFirstItem() {
    const items = this.visibleItems();
    if (items.length == 0) return false;
    this.focusItem(items[0]);
    return true;
  }

  ensureVisible(item) {
    const adjustment =
      this.#scroll.vadjustment ??
      this.#scroll.get_vadjustment?.() ??
      this.#scroll.vscroll?.adjustment;
    if (!adjustment) return;

    const box = item.get_allocation_box();
    if (box.y1 < adjustment.value) adjustment.value = box.y1;
    else if (box.y2 > adjustment.value + adjustment.page_size)
      adjustment.value = box.y2 - adjustment.page_size;
  }

  onSearchKeyPress(actor, event) {
    const symbol = event.get_key_symbol();

    switch (symbol) {
      case Clutter.KEY_Down:
      case Clutter.KEY_Tab:
        if (this.focusFirstItem()) return Clutter.EVENT_STOP;
        return Clutter.EVENT_PROPAGATE;

      case Clutter.KEY_Return:
      case Clutter.KEY_KP_Enter:
      case Clutter.KEY_ISO_Enter: {
        const first = this.visibleItems()[0];
        if (first) {
          first.activate(event);
          return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
      }

      case Clutter.KEY_Escape:
        // First Escape clears the search; a second one closes the menu.
        if (this.#search_entry.get_text() != "") {
          this.#search_entry.set_text("");
          return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    return Clutter.EVENT_PROPAGATE;
  }

  onItemKeyPress(item, event) {
    const symbol = event.get_key_symbol();
    const items = this.visibleItems();
    const index = items.indexOf(item);

    switch (symbol) {
      case Clutter.KEY_Down: {
        const next = items[index + 1];
        if (next) this.focusItem(next);
        return Clutter.EVENT_STOP;
      }

      case Clutter.KEY_Up:
        if (index <= 0) this.#search_entry.grab_key_focus();
        else this.focusItem(items[index - 1]);
        return Clutter.EVENT_STOP;

      case Clutter.KEY_Return:
      case Clutter.KEY_KP_Enter:
      case Clutter.KEY_ISO_Enter:
        item.activate(event);
        return Clutter.EVENT_STOP;
    }

    // Let Escape and everything else fall through to the default handling
    // (Escape closes the menu).
    return Clutter.EVENT_PROPAGATE;
  }

  async copyCode(otp) {
    try {
      otp.secret = await SecretUtils.getSecret(otp);
      const code = otp.code();
      if (otp.type == "HOTP") await SecretUtils.incrementHOTP(otp);
      copyToClipboard(code);
    } catch (e) {
      logError(e);
      Main.notifyError(
        _("Error copying the OTP authentication code."),
        _(e.message),
      );
    }
  }
}
