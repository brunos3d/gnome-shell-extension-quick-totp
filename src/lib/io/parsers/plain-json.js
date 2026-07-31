/* plain-json.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Importer for Quick TOTP's own plain JSON format (see serializers/plain-json.js
 * for the writer). Also accepts a bare array of account objects for leniency.
 */

import { makeAccount } from "../shared/otp-account.js";
import { asArray, parseJson } from "../shared/json.js";

export function parsePlainJson(data) {
  const root = parseJson(data);
  const entries = Array.isArray(root) ? root : asArray(root?.accounts);
  if (!Array.isArray(root) && !Array.isArray(root?.accounts)) {
    throw new Error(
      'Not a valid JSON export (expected an array or an "accounts" array).',
    );
  }

  return entries.map((entry) =>
    makeAccount({
      type: entry?.type,
      steam: entry?.steam,
      issuer: entry?.issuer,
      name: entry?.name,
      secret: entry?.secret,
      algorithm: entry?.algorithm,
      digits: entry?.digits,
      period: entry?.period,
      counter: entry?.counter,
    }),
  );
}
