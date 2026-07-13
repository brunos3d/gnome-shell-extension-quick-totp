/* parsers.test.mjs
 * Copyright (C) 2026  Bruno Silva
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Parser tests. Several fixtures and expected values are reused from GNOME
 * Authenticator's backup test suite (GPL-3.0-or-later).
 */

import { describe, it, assert, assertEqual } from "./lib/harness.js";
import { fixture } from "./lib/fixtures.js";

import { parseUri, parseUriList } from "../src/io/parsers/otpauth-uri.js";
import { parseGoogleMigration } from "../src/io/parsers/google-migration.js";
import { parseAegis } from "../src/io/parsers/aegis.js";
import {
  parseAndOTP,
  parseAuthenticatorLegacy,
} from "../src/io/parsers/andotp.js";
import { parseFreeOTPPlus } from "../src/io/parsers/freeotp-plus.js";
import { parseBitwarden } from "../src/io/parsers/bitwarden.js";
import { parseRaivo } from "../src/io/parsers/raivo.js";
import { parsePlainJson } from "../src/io/parsers/plain-json.js";

describe("otpauth:// URI", () => {
  it("parses a TOTP URI with all fields", () => {
    const a = parseUri(
      "otpauth://totp/ACME%20Co:john.doe@email.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=ACME%20Co&algorithm=SHA256&digits=7&period=45",
    );
    assertEqual(a.type, "TOTP");
    assertEqual(a.issuer, "ACME Co");
    assertEqual(a.name, "john.doe@email.com");
    assertEqual(a.secret, "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ");
    assertEqual(a.algorithm, "SHA-256");
    assertEqual(a.digits, 7);
    assertEqual(a.period, 45);
  });

  it("treats a steam URI as a Steam TOTP token", () => {
    const a = parseUri(
      "otpauth://steam/Boeing:Sophia?secret=JRZCL47CMXVOQMNPZR2F7J4RGI&digits=5",
    );
    assertEqual(a.type, "TOTP");
    assertEqual(a.issuer, "Steam");
    assertEqual(a.steam, true);
    assertEqual(a.digits, 5);
  });

  it("parses a HOTP URI with a counter and '+'-encoded issuer", () => {
    const a = parseUri(
      "otpauth://hotp/Air%20Canada:Benjamin?secret=KUVJJOM753IHTNDSZVCNKL7GII&issuer=Air+Canada&digits=7&counter=50",
    );
    assertEqual(a.type, "HOTP");
    assertEqual(a.issuer, "Air Canada");
    assertEqual(a.counter, 50);
  });

  it("parses a list of URIs and reports bad lines", () => {
    const { accounts, errors } = parseUriList(fixture("plain_uris.txt"));
    assertEqual(accounts.length, 7);
    assertEqual(errors.length, 0);
    assertEqual(accounts[6].issuer, "Steam"); // the steam line
  });

  it("rejects a non-otpauth URI", () => {
    assert(
      parseUriList("https://example.com\nnot a uri").accounts.length === 0,
    );
  });
});

describe("Google Authenticator migration", () => {
  it("decodes the protobuf payload", () => {
    // Vector from GNOME Authenticator's google backup test.
    const data =
      "otpauth-migration://offline?data=CjYKEExyJfPiZeroMa/MdF%2BnkTISE2pvaG5kb2VAZXhhbXBsZS5jb20aB0Rpc2NvcmQgASgBMAIQARgBIAA%3D";
    const items = parseGoogleMigration(data);
    assertEqual(items[0].name, "johndoe@example.com");
    assertEqual(items[0].issuer, "Discord");
    assertEqual(items[0].secret, "JRZCL47CMXVOQMNPZR2F7J4RGI");
    assertEqual(items[0].algorithm, "SHA-1");
    assertEqual(items[0].type, "TOTP");
  });
});

describe("Aegis (plaintext)", () => {
  it("parses entries including a steam token", () => {
    const items = parseAegis(fixture("aegis_plain.json"));
    assertEqual(items.length, 3);
    assertEqual(items[0].issuer, "Google");
    assertEqual(items[0].name, "Bob");
    assertEqual(items[0].secret, "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567");
    assertEqual(items[1].type, "HOTP");
    assertEqual(items[1].counter, 50);
    assertEqual(items[2].steam, true);
    assertEqual(items[2].issuer, "Steam");
    assertEqual(items[2].digits, 5);
  });

  it("rejects an encrypted vault with a clear message", () => {
    let msg = "";
    try {
      parseAegis(
        '{"version":1,"header":{"slots":[{}],"params":{}},"db":"BASE64=="}',
      );
    } catch (e) {
      msg = e.message;
    }
    assert(
      /encrypted/i.test(msg),
      "expected an 'encrypted' error, got: " + msg,
    );
  });
});

describe("andOTP / GNOME Authenticator", () => {
  it("parses a plaintext backup", () => {
    const items = parseAndOTP(fixture("andotp_plain.json"));
    assertEqual(items.length, 7);
    assertEqual(items[0].issuer, "Deno");
    assertEqual(items[0].name, "Mason");
    assertEqual(items[0].secret, "4SJHB4GSD43FZBAI7C2HLRJGPQ");
    assertEqual(items[0].algorithm, "SHA-1");
    assertEqual(items[3].type, "HOTP");
    assertEqual(items[6].steam, true);
    assertEqual(items[6].digits, 5);
  });

  it("parses a legacy backup taking the issuer from the first tag", () => {
    const legacy = JSON.stringify([
      {
        secret: "4SJHB4GSD43FZBAI7C2HLRJGPQ",
        label: "Mason",
        digits: 6,
        type: "TOTP",
        algorithm: "SHA1",
        thumbnail: "Default",
        last_used: 0,
        tags: ["Deno"],
        period: 30,
      },
    ]);
    const items = parseAuthenticatorLegacy(legacy);
    assertEqual(items[0].issuer, "Deno");
    assertEqual(items[0].name, "Mason");
  });
});

describe("FreeOTP+", () => {
  it("decodes byte-array secrets and fixes HOTP counters", () => {
    const items = parseFreeOTPPlus(fixture("freeotp_plus.json"));
    assertEqual(items[0].secret, "4SJHB4GSD43FZBAI7C2HLRJGPQ");
    assertEqual(items[0].issuer, "Deno");
    assertEqual(items[3].type, "HOTP");
    assertEqual(items[3].counter, 1); // stored as 0, +1
  });
});

describe("Bitwarden", () => {
  it("parses otpauth and steam totp fields", () => {
    const items = parseBitwarden(fixture("bitwarden.json"));
    assert(items.length >= 4);
    const steam = items.find((i) => i.steam);
    assert(steam, "expected a steam token");
    assertEqual(steam.digits, 5);
  });

  it("accepts a bare Base32 secret", () => {
    const data = JSON.stringify({
      items: [
        {
          name: "Example",
          login: { username: "me", totp: "JBSWY3DPEHPK3PXP" },
        },
      ],
    });
    const items = parseBitwarden(data);
    assertEqual(items[0].issuer, "Example");
    assertEqual(items[0].secret, "JBSWY3DPEHPK3PXP");
  });
});

describe("Raivo OTP", () => {
  it("parses string-typed numeric fields", () => {
    const items = parseRaivo(fixture("raivo.json"));
    assertEqual(items.length, 2);
    assertEqual(items[0].period, 30);
    assertEqual(items[1].type, "HOTP");
    assertEqual(items[1].counter, 1);
  });
});

describe("Quick TOTP JSON", () => {
  it("parses its own format and a bare array", () => {
    const a = parsePlainJson(
      '{"app":"Quick TOTP","version":1,"accounts":[{"type":"TOTP","issuer":"X","name":"y","secret":"JBSWY3DPEHPK3PXP","digits":6,"algorithm":"SHA-1","period":30}]}',
    );
    assertEqual(a[0].issuer, "X");
    const b = parsePlainJson(
      '[{"type":"TOTP","name":"y","secret":"JBSWY3DPEHPK3PXP"}]',
    );
    assertEqual(b[0].secret, "JBSWY3DPEHPK3PXP");
  });
});
