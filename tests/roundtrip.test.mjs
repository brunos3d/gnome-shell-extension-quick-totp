/* roundtrip.test.mjs
 * Copyright (C) 2026  Bruno Silva
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Every exporter must round-trip through its matching importer without losing
 * information, and the engine must scale to large batches.
 */

import { describe, it, assert, assertEqual } from "./lib/harness.js";
import { makeAccount } from "../src/io/shared/otp-account.js";

import { buildUriList } from "../src/io/serializers/otpauth-uri.js";
import { serializeAegis } from "../src/io/serializers/aegis.js";
import { serializeAndOTP } from "../src/io/serializers/andotp.js";
import { serializeFreeOTPPlus } from "../src/io/serializers/freeotp-plus.js";
import { serializePlainJson } from "../src/io/serializers/plain-json.js";

import { parseUriList } from "../src/io/parsers/otpauth-uri.js";
import { parseAegis } from "../src/io/parsers/aegis.js";
import { parseAndOTP } from "../src/io/parsers/andotp.js";
import { parseFreeOTPPlus } from "../src/io/parsers/freeotp-plus.js";
import { parsePlainJson } from "../src/io/parsers/plain-json.js";

const SAMPLE = [
  makeAccount({
    type: "TOTP",
    issuer: "Deno",
    name: "Mason",
    secret: "4SJHB4GSD43FZBAI7C2HLRJGPQ",
    digits: 6,
    algorithm: "SHA-1",
    period: 30,
  }),
  makeAccount({
    type: "TOTP",
    issuer: "SPDX",
    name: "James",
    secret: "5OM4WOOGPLQEF6UGN3CPEOOLWU",
    digits: 7,
    algorithm: "SHA-256",
    period: 20,
  }),
  makeAccount({
    type: "HOTP",
    issuer: "Issuu",
    name: "James",
    secret: "YOOMIXWS5GN6RTBPUFFWKTW5M4",
    digits: 6,
    algorithm: "SHA-1",
    counter: 5,
  }),
  makeAccount({
    type: "TOTP",
    steam: true,
    name: "Sophia",
    secret: "JRZCL47CMXVOQMNPZR2F7J4RGI",
  }),
];

function compare(original, restored, label) {
  assertEqual(restored.length, original.length, `${label}: account count`);
  for (let i = 0; i < original.length; i++) {
    const o = original[i];
    const r = restored[i];
    assertEqual(r.type, o.type, `${label}[${i}] type`);
    assertEqual(r.issuer, o.issuer, `${label}[${i}] issuer`);
    assertEqual(r.name, o.name, `${label}[${i}] name`);
    assertEqual(r.secret, o.secret, `${label}[${i}] secret`);
    assertEqual(r.digits, o.digits, `${label}[${i}] digits`);
    assertEqual(r.algorithm, o.algorithm, `${label}[${i}] algorithm`);
    if (o.type === "HOTP")
      assertEqual(r.counter, o.counter, `${label}[${i}] counter`);
    else assertEqual(r.period, o.period, `${label}[${i}] period`);
  }
}

describe("export → import round-trips", () => {
  it("Quick TOTP JSON", () => {
    compare(SAMPLE, parsePlainJson(serializePlainJson(SAMPLE)), "plain-json");
  });
  it("otpauth:// URI list", () => {
    compare(SAMPLE, parseUriList(buildUriList(SAMPLE)).accounts, "uri-list");
  });
  it("Aegis", () => {
    compare(SAMPLE, parseAegis(serializeAegis(SAMPLE)), "aegis");
  });
  it("andOTP / GNOME Authenticator", () => {
    compare(SAMPLE, parseAndOTP(serializeAndOTP(SAMPLE)), "andotp");
  });
  it("FreeOTP+", () => {
    compare(SAMPLE, parseFreeOTPPlus(serializeFreeOTPPlus(SAMPLE)), "freeotp");
  });
});

describe("performance / scaling", () => {
  for (const count of [50, 200, 1000]) {
    it(`parses ${count} accounts quickly`, () => {
      const big = [];
      for (let i = 0; i < count; i++) {
        big.push(
          makeAccount({
            type: "TOTP",
            issuer: `Issuer${i}`,
            name: `user${i}`,
            secret: "JBSWY3DPEHPK3PXP",
          }),
        );
      }
      const start = Date.now();
      const restored = parseAegis(serializeAegis(big));
      const elapsed = Date.now() - start;
      assertEqual(restored.length, count);
      assert(
        elapsed < 2000,
        `parsing ${count} took ${elapsed}ms (expected < 2000ms)`,
      );
    });
  }
});
