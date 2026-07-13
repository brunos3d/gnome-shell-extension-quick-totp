/* bitwarden.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Importer for Bitwarden unencrypted JSON vault exports. TOTP data lives in each
 * login item's "totp" field, which may be an otpauth:// URI, a "steam://SECRET"
 * value, or a bare Base32 secret.
 *
 * The otpauth/steam handling is adapted from GNOME Authenticator's bitwarden
 * backup module (GPL-3.0-or-later); the bare-secret fallback is an addition, as
 * real-world Bitwarden exports frequently store just the secret.
 */

import { makeAccount, normalizeSecret } from "../shared/otp-account.js";
import { asArray, parseJson } from "../shared/json.js";
import { parseUri } from "./otpauth-uri.js";

export function parseBitwarden(data) {
  const root = parseJson(data);
  const items = asArray(root?.items);

  const accounts = [];
  for (const item of items) {
    const totp = item?.login?.totp;
    if (typeof totp !== "string" || totp.trim() === "") continue;

    const username = item?.login?.username ?? "";
    const issuer = item?.name ?? "";
    const value = totp.trim();

    if (value.toLowerCase().startsWith("steam://")) {
      accounts.push(
        makeAccount({
          type: "TOTP",
          steam: true,
          name: username || issuer,
          secret: value.slice("steam://".length),
        }),
      );
    } else if (value.toLowerCase().startsWith("otpauth://")) {
      const account = parseUri(value);
      if (!account.issuer) account.issuer = issuer;
      if (!account.name) account.name = username;
      accounts.push(account);
    } else if (/^[A-Za-z2-7\s=]+$/.test(value)) {
      // Bare Base32 secret.
      accounts.push(
        makeAccount({
          type: "TOTP",
          issuer,
          name: username,
          secret: normalizeSecret(value),
        }),
      );
    }
    // Anything else (unknown URL, junk) is skipped rather than guessed at.
  }
  return accounts;
}
