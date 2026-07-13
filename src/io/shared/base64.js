/* base64.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Minimal, dependency-free Base64 (standard and URL-safe) so the parsers stay
 * pure JavaScript and unit-testable outside of GNOME Shell. GLib offers
 * base64 helpers too, but keeping this local avoids a gi:// dependency in the
 * pure format layer.
 */

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) t[ALPHABET.charCodeAt(i)] = i;
  // URL-safe aliases
  t["-".charCodeAt(0)] = 62;
  t["_".charCodeAt(0)] = 63;
  return t;
})();

/**
 * Decode standard or URL-safe Base64 into bytes.
 * @param {string} input
 * @returns {Uint8Array}
 */
export function decode(input) {
  const s = String(input ?? "").replace(/\s+/g, "");
  const clean = s.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let outIndex = 0;

  for (let i = 0; i < clean.length; i++) {
    const value = LOOKUP[clean.charCodeAt(i)];
    if (value < 0)
      throw new Error(`Invalid Base64 character at position ${i}.`);
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, outIndex);
}

/**
 * Encode bytes into standard Base64 (with padding).
 * @param {Uint8Array|number[]} bytes
 * @returns {string}
 */
export function encode(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  let out = "";
  for (let i = 0; i < b.length; i += 3) {
    const b0 = b[i];
    const b1 = i + 1 < b.length ? b[i + 1] : 0;
    const b2 = i + 2 < b.length ? b[i + 2] : 0;
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < b.length ? ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < b.length ? ALPHABET[b2 & 0x3f] : "=";
  }
  return out;
}
