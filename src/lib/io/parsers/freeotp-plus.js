/* freeotp-plus.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Importer for FreeOTP+ plaintext JSON exports.
 *
 * Field mapping adapted from GNOME Authenticator's freeotp_json backup module
 * (GPL-3.0-or-later). Notably: FreeOTP stores the secret as an array of signed
 * bytes, and stores HOTP counters off by one (it subtracts 1), so we add it
 * back on import.
 */

import * as Base32 from "../../utils/base32.js";
import { makeAccount, normalizeSecret } from "../shared/otp-account.js";
import { asArray, parseJson } from "../shared/json.js";

export function parseFreeOTPPlus(data) {
  const root = parseJson(data);
  const tokens = asArray(root?.tokens);
  if (tokens.length === 0 && !Array.isArray(root?.tokens)) {
    throw new Error('Not a valid FreeOTP+ export (missing "tokens").');
  }

  return tokens.map((token) => {
    const type = String(token?.type ?? "TOTP").toUpperCase();
    const isHotp = type === "HOTP";
    return makeAccount({
      type: isHotp ? "HOTP" : "TOTP",
      issuer: token?.issuerExt,
      name: token?.label,
      secret: secretFromBytes(token?.secret),
      algorithm: token?.algo,
      digits: token?.digits,
      period: token?.period,
      // FreeOTP stores counter - 1; restore the real value.
      counter: isHotp ? (parseInt(token?.counter, 10) || 0) + 1 : undefined,
    });
  });
}

function secretFromBytes(signedBytes) {
  if (!Array.isArray(signedBytes)) return "";
  const bytes = Uint8Array.from(signedBytes, (b) => b & 0xff);
  return normalizeSecret(Base32.encode(bytes));
}
