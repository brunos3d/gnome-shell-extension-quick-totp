/* andotp.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Importer for andOTP plaintext JSON backups. GNOME Authenticator's own current
 * export uses this same structure, so this parser also imports GNOME
 * Authenticator (current) backups.
 *
 * Field mapping adapted from GNOME Authenticator's andotp backup module
 * (GPL-3.0-or-later). Encrypted andOTP backups (PBKDF2 + AES-256-GCM, a binary
 * container) are not JSON and are rejected by the JSON decoder.
 */

import { makeAccount } from "../shared/otp-account.js";
import { asArray, parseJson } from "../shared/json.js";

export function parseAndOTP(data) {
  const root = parseJson(data);
  if (!Array.isArray(root))
    throw new Error("Not a valid andOTP backup (expected a JSON array).");

  return root.map((entry) => {
    const type = String(entry?.type ?? "TOTP").toUpperCase();
    return makeAccount({
      type: type === "HOTP" ? "HOTP" : "TOTP",
      steam: type === "STEAM",
      issuer: entry?.issuer,
      name: entry?.label,
      secret: entry?.secret,
      algorithm: entry?.algorithm,
      digits: entry?.digits,
      period: entry?.period,
      counter: entry?.counter,
    });
  });
}

/**
 * Legacy GNOME Authenticator backup: same as andOTP, but the issuer comes from
 * the first tag rather than a dedicated field, and there is no counter.
 */
export function parseAuthenticatorLegacy(data) {
  const root = parseJson(data);
  if (!Array.isArray(root))
    throw new Error("Not a valid Authenticator (Legacy) backup.");

  return root.map((entry) => {
    const type = String(entry?.type ?? "TOTP").toUpperCase();
    const tags = asArray(entry?.tags);
    return makeAccount({
      type: type === "HOTP" ? "HOTP" : "TOTP",
      steam: type === "STEAM",
      issuer: tags.length > 0 ? tags[0] : "",
      name: entry?.label,
      secret: entry?.secret,
      algorithm: entry?.algorithm,
      digits: entry?.digits,
      period: entry?.period,
    });
  });
}
