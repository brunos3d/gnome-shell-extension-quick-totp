/* andotp.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Serializer for andOTP plaintext JSON. This is also the format consumed by
 * GNOME Authenticator (current), so the same output serves both. Structure
 * adapted from GNOME Authenticator's andotp backup module (GPL-3.0-or-later).
 * Only plaintext export is supported.
 */

import { isSteam } from "../shared/otp-account.js";

export function serializeAndOTP(accounts) {
  const items = accounts.map((account) => {
    const item = {
      secret: account.secret,
      issuer: account.issuer,
      label: account.name,
      digits: account.digits,
      type: isSteam(account) ? "STEAM" : account.type,
      algorithm: account.algorithm.replace("-", ""),
      thumbnail: "Default",
      last_used: 0,
      used_frequency: 0,
      counter: account.type === "HOTP" ? (account.counter ?? 0) : 0,
      tags: [],
      period: account.period ?? 30,
    };
    return item;
  });
  return JSON.stringify(items, null, 2);
}
