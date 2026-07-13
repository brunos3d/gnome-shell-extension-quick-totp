/* raivo.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Importer for Raivo OTP's JSON export. Raivo ships this JSON inside a ZIP
 * archive; extract the JSON first (GNOME Shell has no bundled ZIP reader). The
 * field mapping is adapted from GNOME Authenticator's raivootp backup module
 * (GPL-3.0-or-later). Raivo stores digits/timer/counter as strings, which
 * makeAccount() coerces.
 */

import { makeAccount } from "../shared/otp-account.js";
import { parseJson } from "../shared/json.js";

export function parseRaivo(data) {
  const root = parseJson(data);
  if (!Array.isArray(root)) {
    throw new Error(
      "Not a valid Raivo OTP JSON export (expected a JSON array; extract it from the .zip first).",
    );
  }

  return root.map((entry) => {
    const kind = String(entry?.kind ?? "totp").toLowerCase();
    return makeAccount({
      type: kind === "hotp" ? "HOTP" : "TOTP",
      steam: kind === "steam",
      issuer: entry?.issuer,
      name: entry?.account,
      secret: entry?.secret,
      algorithm: entry?.algorithm,
      digits: entry?.digits,
      period: entry?.timer,
      counter: entry?.counter,
    });
  });
}
