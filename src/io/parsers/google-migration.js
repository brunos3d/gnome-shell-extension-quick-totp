/* google-migration.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Importer for Google Authenticator's export QR codes, which encode an
 * "otpauth-migration://offline?data=<base64 protobuf>" URI.
 *
 * The protobuf schema and decoding approach are adapted from GNOME
 * Authenticator's google backup module (GPL-3.0-or-later). The protobuf wire
 * format is decoded by our own minimal reader (shared/protobuf.js).
 *
 * MigrationPayload {
 *   repeated OtpParameters otp_parameters = 1;   // field 1, LEN
 * }
 * OtpParameters {
 *   bytes  secret    = 1;   // LEN
 *   string name      = 2;   // LEN
 *   string issuer    = 3;   // LEN
 *   enum   algorithm = 4;   // VARINT (1 = SHA1)
 *   enum   digits     = 5;  // VARINT (1 = 6, 2 = 8)
 *   enum   type       = 6;  // VARINT (1 = HOTP, 2 = TOTP)
 *   int64  counter    = 7;  // VARINT
 * }
 */

import * as Base32 from "../../utils/base32.js";
import { makeAccount, normalizeSecret } from "../shared/otp-account.js";
import { Reader, WireType } from "../shared/protobuf.js";
import { decode as base64Decode } from "../shared/base64.js";

export function parseGoogleMigration(data) {
  const uri = typeof data === "string" ? data : new TextDecoder().decode(data);
  const trimmed = uri.trim();

  if (!/^otpauth-migration:\/\//i.test(trimmed)) {
    throw new Error(
      'Not a Google Authenticator migration URI ("otpauth-migration://").',
    );
  }

  const dataParam = /[?&]data=([^&#]+)/.exec(trimmed);
  if (!dataParam) throw new Error("Migration URI is missing its data payload.");

  const payload = base64Decode(safeDecode(dataParam[1]));
  return decodeMigrationPayload(payload);
}

function decodeMigrationPayload(bytes) {
  const reader = new Reader(bytes);
  const accounts = [];

  while (!reader.atEnd) {
    const { fieldNumber, wireType } = reader.readTag();
    if (fieldNumber === 1 && wireType === WireType.LEN) {
      accounts.push(decodeOtpParameters(reader.readBytes()));
    } else {
      reader.skip(wireType);
    }
  }
  return accounts.filter(Boolean);
}

function decodeOtpParameters(bytes) {
  const reader = new Reader(bytes);
  let secretBytes = new Uint8Array(0);
  let name = "";
  let issuer = "";
  let algorithmEnum = 1; // SHA1
  let digitsEnum = 1; // 6 digits
  let typeEnum = 2; // TOTP
  let counter = 0;

  while (!reader.atEnd) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        secretBytes = reader.readBytes();
        break;
      case 2:
        name = reader.readString();
        break;
      case 3:
        issuer = reader.readString();
        break;
      case 4:
        algorithmEnum = reader.readVarint();
        break;
      case 5:
        digitsEnum = reader.readVarint();
        break;
      case 6:
        typeEnum = reader.readVarint();
        break;
      case 7:
        counter = reader.readVarint();
        break;
      default:
        reader.skip(wireType);
    }
  }

  if (typeEnum !== 1 && typeEnum !== 2) return null; // OTP_INVALID
  const type = typeEnum === 1 ? "HOTP" : "TOTP";
  const algorithm = algorithmEnum === 1 ? "SHA-1" : "SHA-1";
  const digits = digitsEnum === 2 ? 8 : 6;

  return makeAccount({
    type,
    issuer,
    name,
    secret: normalizeSecret(Base32.encode(secretBytes)),
    algorithm,
    digits,
    counter: type === "HOTP" ? counter : undefined,
  });
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
