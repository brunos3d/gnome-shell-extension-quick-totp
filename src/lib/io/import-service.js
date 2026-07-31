/* import-service.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Orchestrates an import: parse (via the format registry) -> validate ->
 * de-duplicate -> store in the keyring. The parse/validate/dedupe steps are
 * pure and testable; only storeAccounts() touches libsecret.
 */

import HOTP from "../otp/hotp.js";
import TOTP from "../otp/totp.js";
import * as SecretUtils from "../services/secret-utils.js";

import { accountKey } from "./shared/otp-account.js";
import { partitionValid } from "./shared/validators.js";
import { findImportFormat } from "./formats/registry.js";

/**
 * Parse and validate data for a given format id, de-duplicating within the
 * batch. Pure — safe to unit test.
 * @returns {{valid: OtpAccount[], invalid: {account:any, errors:string[]}[], duplicatesInFile: number}}
 */
export function prepareImport(formatId, data) {
  const format = findImportFormat(formatId);
  if (!format) throw new Error(`Unknown import format "${formatId}".`);

  const parsed = format.parse(data);
  const { valid, invalid } = partitionValid(parsed);

  // Collapse exact duplicates within the same file.
  const seen = new Set();
  const unique = [];
  let duplicatesInFile = 0;
  for (const account of valid) {
    const key = accountKey(account);
    if (seen.has(key)) {
      duplicatesInFile++;
      continue;
    }
    seen.add(key);
    unique.push(account);
  }

  return { valid: unique, invalid, duplicatesInFile };
}

/**
 * Store accounts in the keyring, skipping any that already exist. Runs
 * sequentially with awaits between items so the shell stays responsive even for
 * very large imports.
 * @param {OtpAccount[]} accounts
 * @param {(done:number, total:number)=>void} [onProgress]
 * @returns {Promise<{added:number, skipped:number, failed:{account:OtpAccount, error:string}[]}>}
 */
export async function storeAccounts(accounts, onProgress) {
  const existing = await loadExistingKeys();

  let added = 0;
  let skipped = 0;
  const failed = [];

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    try {
      const key = accountKeyIgnoringSecret(account);
      if (existing.has(key)) {
        skipped++;
      } else {
        await SecretUtils.createOTPItem(toOtp(account), -1);
        existing.add(key);
        added++;
      }
    } catch (e) {
      failed.push({ account, error: e.message });
    }
    onProgress?.(i + 1, accounts.length);
  }

  return { added, skipped, failed };
}

async function loadExistingKeys() {
  const keys = new Set();
  try {
    const items = await SecretUtils.getOTPItems();
    for (const item of items) {
      const attrs = item.get_attributes();
      keys.add(
        accountKey({
          type: attrs.type,
          issuer: attrs.issuer ?? "",
          name: attrs.name ?? "",
          secret: "", // secret is not needed to detect issuer/name/type collisions
          algorithm: normalizeAttrAlgorithm(attrs.algorithm),
          digits: parseInt(attrs.digits, 10) || 6,
        }),
      );
    }
  } catch {
    // If we cannot read existing items (e.g. locked), fall back to adding all.
  }
  return keys;
}

// Build a TOTP/HOTP model object suitable for SecretUtils.createOTPItem.
function toOtp(account) {
  if (account.type === "HOTP") {
    return new HOTP({
      issuer: account.issuer,
      name: account.name,
      secret: account.secret,
      digits: account.digits,
      counter: account.counter ?? 0,
      algorithm: account.algorithm,
    });
  }
  return new TOTP({
    issuer: account.issuer,
    name: account.name,
    secret: account.secret,
    digits: account.digits,
    period: account.period ?? 30,
    algorithm: account.algorithm,
  });
}

function normalizeAttrAlgorithm(algorithm) {
  const up = String(algorithm ?? "SHA-1").toUpperCase();
  return up.startsWith("SHA-") ? up : up.replace("SHA", "SHA-");
}

// De-dup keys must be computed the same way for existing items and incoming
// accounts; both drop the secret so they compare on service identity only.
function accountKeyIgnoringSecret(account) {
  return accountKey({ ...account, secret: "" });
}
