/* aegis.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Serializer for the Aegis Authenticator plaintext vault. Round-trips with
 * parsers/aegis.js. Structure adapted from GNOME Authenticator's aegis backup
 * module (GPL-3.0-or-later). Only plaintext export is supported.
 */

import { isSteam } from "../shared/otp-account.js";
import { randomUuid } from "../shared/uuid.js";

export function serializeAegis(accounts) {
  const entries = accounts.map((account) => {
    const info = {
      secret: account.secret,
      algo: account.algorithm.replace("-", ""),
      digits: account.digits,
    };
    if (account.type === "HOTP") info.counter = account.counter ?? 0;
    else info.period = account.period ?? 30;

    return {
      type: isSteam(account) ? "steam" : account.type.toLowerCase(),
      uuid: randomUuid(),
      name: account.name,
      issuer: account.issuer,
      note: "",
      icon: null,
      info,
    };
  });

  const vault = {
    version: 1,
    header: { slots: null, params: null },
    db: { version: 2, entries },
  };
  return JSON.stringify(vault, null, 2);
}
