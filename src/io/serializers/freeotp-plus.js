/* freeotp-plus.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Serializer for FreeOTP+ plaintext JSON. Round-trips with
 * parsers/freeotp-plus.js. FreeOTP stores the secret as an array of signed
 * bytes and HOTP counters off by one (it subtracts 1), which we reproduce.
 */

import * as Base32 from "../../utils/base32.js";

export function serializeFreeOTPPlus(accounts) {
  const tokens = accounts.map((account) => {
    const isHotp = account.type === "HOTP";
    return {
      algo: account.algorithm.replace("-", ""),
      // FreeOTP stores counter - 1.
      counter: isHotp ? Math.max((account.counter ?? 0) - 1, 0) : 0,
      digits: account.digits,
      label: account.name,
      issuerExt: account.issuer,
      issuerInt: null,
      period: account.period ?? 30,
      secret: secretToSignedBytes(account.secret),
      type: isHotp ? "HOTP" : "TOTP",
    };
  });
  return JSON.stringify({ tokens }, null, 2);
}

function secretToSignedBytes(secret) {
  const bytes = Base32.decode(secret, false);
  // FreeOTP (Java) stores bytes as signed 8-bit values.
  return [...bytes].map((b) => (b > 127 ? b - 256 : b));
}
