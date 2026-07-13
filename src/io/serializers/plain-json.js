/* plain-json.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Serializer for Quick TOTP's own JSON export format. Round-trips with
 * parsers/plain-json.js.
 */

import { isSteam } from "../shared/otp-account.js";

export const FORMAT_VERSION = 1;

export function serializePlainJson(accounts) {
  const payload = {
    app: "Quick TOTP",
    version: FORMAT_VERSION,
    accounts: accounts.map((account) => {
      const entry = {
        type: account.type,
        issuer: account.issuer,
        name: account.name,
        secret: account.secret,
        digits: account.digits,
        algorithm: account.algorithm,
      };
      if (account.type === "HOTP") entry.counter = account.counter ?? 0;
      else entry.period = account.period ?? 30;
      if (isSteam(account)) entry.steam = true;
      return entry;
    }),
  };
  return JSON.stringify(payload, null, 2);
}
