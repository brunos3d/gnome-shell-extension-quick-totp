/* json.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Shared, defensive JSON decoding for importers. Accepts either a string or a
 * byte array, strips a UTF-8 BOM, and turns parse failures into a uniform,
 * human-readable error. Never trusts the resulting structure — callers still
 * validate every field.
 */

export function parseJson(data) {
  let text =
    typeof data === "string"
      ? data
      : new TextDecoder("utf-8", { fatal: false }).decode(data);
  // Strip a leading BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`File is not valid JSON: ${e.message}`);
  }
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}
