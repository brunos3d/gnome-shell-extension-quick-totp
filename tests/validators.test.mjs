/* validators.test.mjs
 * Copyright (C) 2026  Bruno Silva
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  describe,
  it,
  assert,
  assertEqual,
  assertThrows,
} from "./lib/harness.js";
import { makeAccount } from "../src/io/shared/otp-account.js";
import {
  validateAccount,
  partitionValid,
  validateBase32Secret,
} from "../src/io/shared/validators.js";
import { parseAegis } from "../src/io/parsers/aegis.js";
import { parseAndOTP } from "../src/io/parsers/andotp.js";

describe("validation", () => {
  it("accepts a well-formed account", () => {
    const a = makeAccount({
      type: "TOTP",
      issuer: "X",
      name: "y",
      secret: "JBSWY3DPEHPK3PXP",
    });
    assertEqual(validateAccount(a).length, 0);
  });

  it("rejects an invalid Base32 secret", () => {
    assert(validateBase32Secret("not base32!!") !== null);
    assert(validateBase32Secret("JBSWY3DPEHPK3PXP") === null);
    assert(validateBase32Secret("") !== null);
  });

  it("rejects out-of-range digits and period", () => {
    const bad = makeAccount({
      type: "TOTP",
      name: "y",
      secret: "JBSWY3DPEHPK3PXP",
    });
    bad.digits = 99;
    bad.period = 0;
    const errors = validateAccount(bad);
    assert(errors.some((e) => /digits/i.test(e)));
    assert(errors.some((e) => /period/i.test(e)));
  });

  it("rejects an unknown algorithm", () => {
    const bad = makeAccount({
      type: "TOTP",
      name: "y",
      secret: "JBSWY3DPEHPK3PXP",
      algorithm: "MD5",
    });
    assert(validateAccount(bad).some((e) => /algorithm/i.test(e)));
  });

  it("rejects an entry with neither issuer nor name", () => {
    const bad = makeAccount({ type: "TOTP", secret: "JBSWY3DPEHPK3PXP" });
    assert(validateAccount(bad).some((e) => /neither/i.test(e)));
  });

  it("partitions valid and invalid entries without discarding either", () => {
    const good = makeAccount({
      type: "TOTP",
      name: "y",
      secret: "JBSWY3DPEHPK3PXP",
    });
    const bad = makeAccount({ type: "TOTP", name: "z", secret: "###" });
    const { valid, invalid } = partitionValid([good, bad]);
    assertEqual(valid.length, 1);
    assertEqual(invalid.length, 1);
    assert(invalid[0].errors.length > 0);
  });
});

describe("malformed input", () => {
  it("throws on corrupted JSON", () => {
    assertThrows(() => parseAegis("{ this is not json"));
    assertThrows(() => parseAndOTP("}{"));
  });

  it("throws when the top-level shape is wrong", () => {
    assertThrows(() => parseAndOTP('{"not":"an array"}'));
    assertThrows(() => parseAegis('{"no":"db"}'));
  });

  it("tolerates missing optional fields", () => {
    // An Aegis entry with only a secret should still produce an account object
    // (which validation may later reject), not crash.
    const data =
      '{"version":1,"header":{"slots":null,"params":null},"db":{"version":2,"entries":[{"type":"totp","info":{"secret":"JBSWY3DPEHPK3PXP"}}]}}';
    const items = parseAegis(data);
    assertEqual(items.length, 1);
    assertEqual(items[0].secret, "JBSWY3DPEHPK3PXP");
  });
});
