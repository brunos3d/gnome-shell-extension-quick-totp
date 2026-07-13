/* otpauth-uri.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Parser for otpauth:// URIs (Key Uri Format), the lingua franca of OTP apps:
 * https://github.com/google/google-authenticator/wiki/Key-Uri-Format
 *
 * Hand-rolled (no GLib.Uri / URL) so the format layer stays pure and behaves
 * identically under Node test harnesses and GNOME Shell's gjs.
 */

import { makeAccount } from "../shared/otp-account.js";

/**
 * Parse a single otpauth:// URI into a normalized account.
 * @param {string} uri
 * @returns {OtpAccount}
 */
export function parseUri(uri) {
  const str = String(uri ?? "").trim();
  const match = /^otpauth:\/\/([^/?#]+)\/?([^?#]*)(?:\?([^#]*))?/i.exec(str);
  if (!match) throw new Error('Not an "otpauth://" URI.');

  const host = decodeURIComponent(match[1]).toLowerCase();
  if (host !== "totp" && host !== "hotp" && host !== "steam") {
    throw new Error(`Unsupported otpauth type "${host}".`);
  }

  const query = parseQuery(match[3] ?? "");
  const { issuer: labelIssuer, name } = splitLabel(match[2] ?? "");

  const steam = host === "steam";
  return makeAccount({
    type: steam ? "TOTP" : host.toUpperCase(),
    steam,
    issuer: query.issuer ?? labelIssuer,
    name,
    secret: query.secret,
    algorithm: query.algorithm,
    digits: query.digits,
    period: query.period,
    counter: query.counter,
  });
}

/**
 * Parse free-form text that may contain one or many otpauth:// URIs, one per
 * line (blank lines and lines starting with "#" are ignored). Returns every
 * account it can parse and collects per-line errors instead of aborting.
 * @param {string} text
 * @returns {{accounts: OtpAccount[], errors: {line: number, error: string}[]}}
 */
export function parseUriList(text) {
  const accounts = [];
  const errors = [];
  const lines = String(text ?? "").split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    try {
      accounts.push(parseUri(line));
    } catch (e) {
      errors.push({ line: index + 1, error: e.message });
    }
  });
  return { accounts, errors };
}

// "Issuer:Account" (or just "Account"). The colon is literal in the path; each
// side is percent-decoded independently.
function splitLabel(rawLabel) {
  const label = rawLabel.replace(/^\//, "");
  const colon = label.indexOf(":");
  if (colon === -1) {
    return { issuer: "", name: safeDecode(label) };
  }
  return {
    issuer: safeDecode(label.slice(0, colon)).trim(),
    name: safeDecode(label.slice(colon + 1)).trim(),
  };
}

function parseQuery(queryString) {
  const result = {};
  for (const pair of queryString.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = safeDecode(pair.slice(0, eq));
    // application/x-www-form-urlencoded: "+" means space in query values.
    const value = safeDecode(pair.slice(eq + 1).replace(/\+/g, " "));
    if (key) result[key] = value;
  }
  return result;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
