/* export-service.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Orchestrates an export: gather accounts (with secrets) from the keyring, then
 * serialize them via the format registry. Reading secrets requires the keyring
 * to be unlocked; callers should communicate that exports contain secrets in
 * clear text.
 */

import * as SecretUtils from "../services/secret-utils.js";

import { makeAccount } from "./shared/otp-account.js";
import { findExportFormat } from "./formats/registry.js";

/**
 * Read every stored OTP account, including its secret, as normalized
 * OtpAccount objects. Sensitive: the returned secrets are in clear text.
 * @returns {Promise<OtpAccount[]>}
 */
export async function gatherAccounts() {
  const items = await SecretUtils.getOTPItems();
  const accounts = [];

  for (const item of items) {
    const attrs = item.get_attributes();
    const otpLike = {
      type: attrs.type,
      issuer: attrs.issuer ?? "",
      name: attrs.name ?? "",
      digits: attrs.digits,
      period: attrs.period,
      counter: attrs.counter,
      algorithm: attrs.algorithm,
    };
    const secret = await SecretUtils.getSecret(otpLike);
    accounts.push(makeAccount({ ...otpLike, secret }));
  }

  return accounts;
}

/**
 * Serialize accounts to a string for the given export format id.
 * @param {string} formatId
 * @param {OtpAccount[]} accounts
 * @returns {string}
 */
export function serializeAccounts(formatId, accounts) {
  const format = findExportFormat(formatId);
  if (!format) throw new Error(`Unknown export format "${formatId}".`);
  if (accounts.length === 0)
    throw new Error("There are no accounts to export.");
  return format.serialize(accounts);
}
