/* registry.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * The single catalogue of supported import/export formats. Each entry couples a
 * pure parser/serializer with the metadata the UI needs (title, description,
 * how the data arrives, file extension). Adding a format means adding one entry
 * here — no importer logic is scattered across the UI.
 *
 * Format concepts and coverage are informed by GNOME Authenticator's backup
 * module (GPL-3.0-or-later); see docs/import-export.md for the full mapping and
 * attribution.
 */

import { parseUri, parseUriList } from "../parsers/otpauth-uri.js";
import { parseGoogleMigration } from "../parsers/google-migration.js";
import { parseAegis } from "../parsers/aegis.js";
import { parseAndOTP, parseAuthenticatorLegacy } from "../parsers/andotp.js";
import { parseFreeOTPPlus } from "../parsers/freeotp-plus.js";
import { parseBitwarden } from "../parsers/bitwarden.js";
import { parseRaivo } from "../parsers/raivo.js";
import { parsePlainJson } from "../parsers/plain-json.js";

import { buildUriList } from "../serializers/otpauth-uri.js";
import { serializeAegis } from "../serializers/aegis.js";
import { serializeAndOTP } from "../serializers/andotp.js";
import { serializeFreeOTPPlus } from "../serializers/freeotp-plus.js";
import { serializePlainJson } from "../serializers/plain-json.js";

// How the payload reaches an importer, so the UI can pick the right entry point.
export const Source = {
  FILE: "file", // opened from disk
  TEXT: "text", // pasted / clipboard
  QR: "qr", // scanned image or webcam
};

function asText(data) {
  return typeof data === "string"
    ? data
    : new TextDecoder("utf-8", { fatal: false }).decode(data);
}

/**
 * Import formats. `parse(data) -> OtpAccount[]` is pure and throws on
 * unrecoverable input. `sources` lists where the data can come from.
 */
export const IMPORT_FORMATS = [
  {
    id: "otpauth_uri",
    title: "otpauth:// URI",
    subtitle: "One or more otpauth:// URIs (also used by QR codes)",
    sources: [Source.TEXT, Source.QR],
    parse: (data) => parseUriList(asText(data)).accounts,
  },
  {
    id: "google",
    title: "Google Authenticator",
    subtitle: "From an exported QR code (otpauth-migration://)",
    sources: [Source.QR, Source.TEXT],
    parse: (data) => parseGoogleMigration(data),
  },
  {
    id: "gnome_authenticator",
    title: "GNOME Authenticator",
    subtitle: "Plain-text JSON backup (current format)",
    sources: [Source.FILE],
    parse: (data) => parseAndOTP(data),
  },
  {
    id: "authenticator_legacy",
    title: "GNOME Authenticator (Legacy)",
    subtitle: "Plain-text JSON backup from older releases",
    sources: [Source.FILE],
    parse: (data) => parseAuthenticatorLegacy(data),
  },
  {
    id: "aegis",
    title: "Aegis",
    subtitle: "Plain-text JSON vault (unencrypted)",
    sources: [Source.FILE],
    parse: (data) => parseAegis(data),
  },
  {
    id: "andotp",
    title: "andOTP",
    subtitle: "Plain-text JSON backup",
    sources: [Source.FILE],
    parse: (data) => parseAndOTP(data),
  },
  {
    id: "freeotp_plus",
    title: "FreeOTP+",
    subtitle: "Plain-text JSON export",
    sources: [Source.FILE],
    parse: (data) => parseFreeOTPPlus(data),
  },
  {
    id: "bitwarden",
    title: "Bitwarden",
    subtitle: "Unencrypted JSON vault export",
    sources: [Source.FILE],
    parse: (data) => parseBitwarden(data),
  },
  {
    id: "raivo",
    title: "Raivo OTP",
    subtitle: "JSON export (extract from the .zip first)",
    sources: [Source.FILE],
    parse: (data) => parseRaivo(data),
  },
  {
    id: "plain_json",
    title: "Quick TOTP (JSON)",
    subtitle: "Quick TOTP's own plain JSON export",
    sources: [Source.FILE],
    parse: (data) => parsePlainJson(data),
  },
  {
    id: "uri_list",
    title: "URI list / plain text",
    subtitle: "A text file with one otpauth:// URI per line",
    sources: [Source.FILE, Source.TEXT],
    parse: (data) => parseUriList(asText(data)).accounts,
  },
];

/**
 * Export formats. `serialize(accounts) -> string`. `extension`/`mime` drive the
 * save dialog. `encrypted: false` everywhere — see docs/import-export.md.
 */
export const EXPORT_FORMATS = [
  {
    id: "plain_json",
    title: "Quick TOTP (JSON)",
    subtitle: "Quick TOTP's own plain JSON format",
    extension: "json",
    mime: "application/json",
    serialize: (accounts) => serializePlainJson(accounts),
  },
  {
    id: "otpauth_uri_list",
    title: "otpauth:// URI list",
    subtitle: "One otpauth:// URI per line",
    extension: "txt",
    mime: "text/plain",
    serialize: (accounts) => buildUriList(accounts),
  },
  {
    id: "gnome_authenticator",
    title: "GNOME Authenticator / andOTP",
    subtitle: "Plain-text JSON, importable by GNOME Authenticator and andOTP",
    extension: "json",
    mime: "application/json",
    serialize: (accounts) => serializeAndOTP(accounts),
  },
  {
    id: "aegis",
    title: "Aegis",
    subtitle: "Plain-text JSON vault (unencrypted)",
    extension: "json",
    mime: "application/json",
    serialize: (accounts) => serializeAegis(accounts),
  },
  {
    id: "freeotp_plus",
    title: "FreeOTP+",
    subtitle: "Plain-text JSON export",
    extension: "json",
    mime: "application/json",
    serialize: (accounts) => serializeFreeOTPPlus(accounts),
  },
];

export function findImportFormat(id) {
  return IMPORT_FORMATS.find((f) => f.id === id) ?? null;
}

export function findExportFormat(id) {
  return EXPORT_FORMATS.find((f) => f.id === id) ?? null;
}

/**
 * Best-effort auto-detection for file imports: try each candidate parser and
 * return the format that yields the most accounts. Purely a convenience — the
 * user can always pick a format explicitly.
 * @returns {{format: object, accounts: OtpAccount[]}|null}
 */
export function detectFormat(data, sources = [Source.FILE]) {
  let best = null;
  for (const format of IMPORT_FORMATS) {
    if (!format.sources.some((s) => sources.includes(s))) continue;
    try {
      const accounts = format.parse(data);
      if (
        accounts.length > 0 &&
        (!best || accounts.length > best.accounts.length)
      ) {
        best = { format, accounts };
      }
    } catch {
      // Not this format; keep trying.
    }
  }
  return best;
}
