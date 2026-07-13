/* otpauth-uri.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Serializer for otpauth:// URIs (Key Uri Format). Round-trips with
 * parsers/otpauth-uri.js.
 */

import { isSteam } from "../shared/otp-account.js";

/**
 * Build a single otpauth:// URI from an account.
 * @param {OtpAccount} account
 * @returns {string}
 */
export function buildUri(account) {
  const steam = isSteam(account);
  const host = steam ? "steam" : account.type.toLowerCase();

  const label = account.issuer
    ? `${encodeURIComponent(account.issuer)}:${encodeURIComponent(account.name)}`
    : encodeURIComponent(account.name);

  const params = [`secret=${account.secret}`];
  if (account.issuer)
    params.push(`issuer=${encodeURIComponent(account.issuer)}`);
  params.push(`algorithm=${account.algorithm.replace("-", "")}`);
  params.push(`digits=${account.digits}`);
  if (account.type === "HOTP") {
    params.push(`counter=${account.counter ?? 0}`);
  } else {
    params.push(`period=${account.period ?? 30}`);
  }

  return `otpauth://${host}/${label}?${params.join("&")}`;
}

/**
 * Build a newline-separated list of otpauth:// URIs.
 * @param {OtpAccount[]} accounts
 * @returns {string}
 */
export function buildUriList(accounts) {
  return accounts.map(buildUri).join("\n") + "\n";
}
