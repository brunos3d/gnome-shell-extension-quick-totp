/* otp-account.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Canonical, toolkit-agnostic representation of an OTP account, shared by every
 * importer and exporter. Every format parser maps its native structure onto
 * this shape, and every serializer maps it back out. Keeping a single
 * normalized model in the middle is what lets formats interoperate without N*M
 * conversion code.
 *
 * The field set is deliberately a superset of what Quick TOTP stores in the
 * keyring (type, issuer, name, secret, digits, algorithm, period/counter), so
 * an imported account can be handed straight to secretUtils.createOTPItem.
 *
 * The concept of a shared "restorable item" is adapted from GNOME
 * Authenticator's backup module (GPL-3.0-or-later); see docs/import-export.md.
 */

export const OTP_TYPES = ["TOTP", "HOTP"];
export const ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

export const DEFAULT_DIGITS = 6;
export const DEFAULT_PERIOD = 30;
export const DEFAULT_ALGORITHM = "SHA-1";

export const STEAM_ISSUER = "Steam";
export const STEAM_DIGITS = 5;
export const STEAM_PERIOD = 30;

/**
 * @typedef {Object} OtpAccount
 * @property {"TOTP"|"HOTP"} type
 * @property {string} issuer
 * @property {string} name
 * @property {string} secret      Base32, uppercase, no padding
 * @property {number} digits
 * @property {string} algorithm   One of ALGORITHMS
 * @property {number} [period]    TOTP only
 * @property {number} [counter]   HOTP only
 * @property {boolean} [steam]    True when this is a Steam Guard token
 */

// Normalize an algorithm label from any known spelling to the "SHA-256" form
// used throughout Quick TOTP. Unknown values are upper-cased and returned as-is
// so validation can reject them with a clear message.
export function normalizeAlgorithm(name) {
  const up = String(name ?? "")
    .toUpperCase()
    .replace(/[\s_]/g, "");
  switch (up) {
    case "SHA1":
    case "SHA-1":
      return "SHA-1";
    case "SHA256":
    case "SHA-256":
      return "SHA-256";
    case "SHA384":
    case "SHA-384":
      return "SHA-384";
    case "SHA512":
    case "SHA-512":
      return "SHA-512";
    default:
      return up || DEFAULT_ALGORITHM;
  }
}

// Base32 secrets travel in many spellings (lower case, spaced in groups of 4,
// zero padded). Normalize to the canonical upper-case, unpadded form.
export function normalizeSecret(secret) {
  return String(secret ?? "")
    .replace(/\s+/g, "")
    .replace(/=+$/, "")
    .toUpperCase();
}

export function isSteam(account) {
  return (
    account?.steam === true ||
    String(account?.issuer ?? "").toLowerCase() === STEAM_ISSUER.toLowerCase()
  );
}

// Coerce a possibly-loose set of fields into a fully-populated, normalized
// account. Does not validate; call validateAccount() for that.
export function makeAccount(fields = {}) {
  const type =
    String(fields.type ?? "TOTP").toUpperCase() === "HOTP" ? "HOTP" : "TOTP";
  const steam = fields.steam === true || isSteam(fields);

  const account = {
    type,
    issuer: steam ? STEAM_ISSUER : String(fields.issuer ?? "").trim(),
    name: String(fields.name ?? "").trim(),
    secret: normalizeSecret(fields.secret),
    digits: toPositiveInt(fields.digits, steam ? STEAM_DIGITS : DEFAULT_DIGITS),
    algorithm: normalizeAlgorithm(fields.algorithm ?? DEFAULT_ALGORITHM),
  };

  if (type === "HOTP") {
    account.counter = toNonNegativeInt(fields.counter, 0);
  } else {
    account.period = toPositiveInt(
      fields.period,
      steam ? STEAM_PERIOD : DEFAULT_PERIOD,
    );
  }
  if (steam) account.steam = true;

  return account;
}

// A stable identity used for de-duplication: two accounts are "the same" when
// they would generate the same codes for the same service.
export function accountKey(account) {
  return [
    account.type,
    account.issuer.toLowerCase(),
    account.name.toLowerCase(),
    account.secret,
    account.algorithm,
    account.digits,
  ].join(" ");
}

function toPositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toNonNegativeInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
