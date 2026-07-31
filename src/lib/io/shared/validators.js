/* validators.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Validation for imported accounts. Because this project manages authentication
 * secrets, imports are treated as untrusted: every field is checked, malformed
 * entries are rejected with a specific reason, and nothing is ever executed or
 * coerced silently.
 */

import * as Base32 from "../../utils/base32.js";
import { ALGORITHMS, OTP_TYPES } from "./otp-account.js";

// Reasonable upper bounds. These are not security boundaries by themselves, but
// they stop absurd values (e.g. a 10-million digit code) from reaching the
// generator or the keyring.
const MAX_DIGITS = 10;
const MIN_DIGITS = 1;
const MAX_PERIOD = 3600;
const MAX_COUNTER = Number.MAX_SAFE_INTEGER;
const MAX_STRING = 1024;

/**
 * Validate a single account.
 * @returns {string[]} a list of human-readable problems; empty means valid.
 */
export function validateAccount(account) {
  const errors = [];

  if (!account || typeof account !== "object") {
    return ["Entry is not an object."];
  }

  if (!OTP_TYPES.includes(account.type)) {
    errors.push(`Unsupported type "${account.type}".`);
  }

  if (!ALGORITHMS.includes(account.algorithm)) {
    errors.push(`Unsupported algorithm "${account.algorithm}".`);
  }

  if (
    typeof account.issuer !== "string" ||
    account.issuer.length > MAX_STRING
  ) {
    errors.push("Invalid issuer.");
  }
  if (typeof account.name !== "string" || account.name.length > MAX_STRING) {
    errors.push("Invalid account name.");
  }
  if (!account.issuer && !account.name) {
    errors.push("Entry has neither an issuer nor an account name.");
  }

  if (
    !Number.isInteger(account.digits) ||
    account.digits < MIN_DIGITS ||
    account.digits > MAX_DIGITS
  ) {
    errors.push(`Invalid digits (${account.digits}).`);
  }

  if (account.type === "TOTP") {
    if (
      !Number.isInteger(account.period) ||
      account.period < 1 ||
      account.period > MAX_PERIOD
    ) {
      errors.push(`Invalid period (${account.period}).`);
    }
  } else if (account.type === "HOTP") {
    if (
      !Number.isInteger(account.counter) ||
      account.counter < 0 ||
      account.counter > MAX_COUNTER
    ) {
      errors.push(`Invalid counter (${account.counter}).`);
    }
  }

  const secretError = validateBase32Secret(account.secret);
  if (secretError) errors.push(secretError);

  return errors;
}

// Validate a base32 secret without keeping the decoded bytes around.
export function validateBase32Secret(secret) {
  if (typeof secret !== "string" || secret.length === 0) {
    return "Missing secret.";
  }
  if (!/^[A-Z2-7]+$/.test(secret)) {
    return "Secret is not valid Base32.";
  }
  try {
    const bytes = Base32.decode(secret, false);
    if (!bytes || bytes.length === 0) return "Secret decodes to no bytes.";
  } catch (e) {
    return `Secret is not valid Base32: ${e.message}`;
  }
  return null;
}

/**
 * Partition a list of accounts into valid and invalid, keeping a reason for each
 * rejection so the UI can surface it. Never silently discards entries.
 * @returns {{valid: OtpAccount[], invalid: {account: any, errors: string[]}[]}}
 */
export function partitionValid(accounts) {
  const valid = [];
  const invalid = [];
  for (const account of accounts) {
    const errors = validateAccount(account);
    if (errors.length === 0) valid.push(account);
    else invalid.push({ account, errors });
  }
  return { valid, invalid };
}
