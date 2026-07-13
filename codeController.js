/*  codeController.js
 * Copyright (C) 2025  Daniel K. O.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Toolkit-agnostic controller that drives the "live OTP code + countdown"
 * behavior.  It owns a single GLib timeout, fetches the secret when needed,
 * (re)computes the current code and its expiry, and reports the resulting
 * state to a render callback.
 *
 * This deliberately contains no GTK/St widget code so it can be shared by both
 * the preferences window (GTK) and the panel indicator (St/Clutter).
 */

import GLib from "gi://GLib";

import * as SecretUtils from "./secretUtils.js";

function now() {
  return Date.now() / 1000;
}

export default class CodeController {
  #otp;
  #on_update;
  #interval;

  #code = null;
  #expiry = 0;
  #source = 0;

  // on_update receives a state object:
  //   { type, locked, code, remaining, fraction, period, error }
  constructor(otp, on_update, interval = 500) {
    this.#otp = otp;
    this.#on_update = on_update;
    this.#interval = interval;
  }

  get otp() {
    return this.#otp;
  }

  start() {
    if (this.#source) return;

    // Do a first update immediately so the UI isn't blank until the first
    // tick fires.
    this.update();

    this.#source = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      this.#interval,
      () => {
        this.update();
        return GLib.SOURCE_CONTINUE;
      },
    );
  }

  stop() {
    if (this.#source) {
      GLib.Source.remove(this.#source);
      this.#source = 0;
    }
  }

  // HOTP codes never expire on their own; TOTP codes expire when the current
  // period ends.
  #expired() {
    if (this.#otp.type == "HOTP") return true;
    if (!this.#code) return true;
    if (this.#expiry == 0) return true;
    if (this.#expiry < now()) return true;
    return false;
  }

  async update() {
    const type = this.#otp.type;
    try {
      if (this.#expired()) {
        const item = await SecretUtils.getOTPItem(this.#otp);
        if (item.locked) {
          this.#code = null;
          this.#expiry = 0;
          this.#on_update({
            type,
            locked: true,
            code: null,
            remaining: 0,
            fraction: 0,
            period: this.#otp.period ?? 0,
          });
          return;
        }

        this.#otp.secret = await SecretUtils.getSecret(this.#otp);

        if (type == "TOTP") {
          const [code, expiry] = this.#otp.code_and_expiry();
          this.#expiry = expiry;
          this.#code = code;
        } else {
          this.#otp.counter = parseInt(item.get_attributes().counter);
          this.#code = this.#otp.code();
        }
      }

      let remaining = 0;
      let fraction = 0;
      if (type == "TOTP" && this.#otp.period) {
        remaining = Math.max(this.#expiry - now(), 0);
        fraction = remaining / this.#otp.period;
      }

      this.#on_update({
        type,
        locked: false,
        code: this.#code,
        remaining,
        fraction,
        period: this.#otp.period ?? 0,
      });
    } catch (e) {
      /*
       * Errors here are usually harmless: the item was deleted or edited
       * while this async function was running, or the keyring was locked.
       * Stop updating and let the renderer decide how to present it.
       */
      this.stop();
      // The renderer's widgets may already be destroyed (e.g. the menu
      // was closing), so don't let a failing callback turn into an
      // unhandled rejection.
      try {
        this.#on_update({
          type,
          locked: false,
          code: this.#code,
          remaining: 0,
          fraction: 0,
          period: this.#otp.period ?? 0,
          error: e,
        });
      } catch (_) {}
    }
  }
}
