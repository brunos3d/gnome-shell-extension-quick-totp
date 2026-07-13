/* aegis.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Importer for the Aegis Authenticator vault (plaintext JSON).
 * Vault format: https://github.com/beemdevelopment/Aegis/blob/master/docs/vault.md
 *
 * The field mapping mirrors GNOME Authenticator's aegis backup module
 * (GPL-3.0-or-later). Encrypted Aegis vaults (scrypt + AES-256-GCM) are
 * detected and rejected with a clear message — see docs/import-export.md for
 * why encrypted formats are out of scope for a pure-gjs extension.
 */

import { makeAccount } from "../shared/otp-account.js";
import { asArray, parseJson } from "../shared/json.js";

export function parseAegis(data) {
  const root = parseJson(data);
  if (!root || typeof root !== "object" || typeof root.db !== "object") {
    if (root && typeof root.db === "string") {
      throw new Error(
        "This Aegis vault is encrypted. Export an unencrypted vault to import it.",
      );
    }
    throw new Error("Not a valid Aegis vault.");
  }

  return asArray(root.db.entries).map((entry) => {
    const info = entry?.info ?? {};
    const type = String(entry?.type ?? "totp").toLowerCase();
    return makeAccount({
      type: type === "hotp" ? "HOTP" : "TOTP",
      steam: type === "steam",
      issuer: entry?.issuer,
      name: entry?.name,
      secret: info.secret,
      algorithm: info.algo,
      digits: info.digits,
      period: info.period,
      counter: info.counter,
    });
  });
}
