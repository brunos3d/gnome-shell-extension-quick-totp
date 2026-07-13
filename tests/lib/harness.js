/* harness.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * A tiny zero-dependency test harness so the import/export engine can be tested
 * with plain `node` (or `gjs`) without pulling in a test framework.
 */

const suites = [];
let current = null;

export function describe(name, fn) {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
}

export function it(name, fn) {
  if (!current) throw new Error("it() must be called inside describe().");
  current.tests.push({ name, fn });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed.");
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message || "Values differ"}\n    expected: ${format(expected)}\n    actual:   ${format(actual)}`,
    );
  }
}

export function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(
      `${message || "Objects differ"}\n    expected: ${e}\n    actual:   ${a}`,
    );
  }
}

export function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(message || "Expected function to throw.");
}

export async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const suite of suites) {
    for (const test of suite.tests) {
      try {
        await test.fn();
        passed++;
      } catch (e) {
        failed++;
        failures.push({ suite: suite.name, test: test.name, error: e });
      }
    }
  }

  const total = passed + failed;
  console.log(`\n${passed}/${total} tests passed.`);
  if (failed > 0) {
    console.log(`\n${failed} FAILED:`);
    for (const f of failures) {
      console.log(`  ✗ ${f.suite} › ${f.test}`);
      console.log(
        `      ${String(f.error.message).replace(/\n/g, "\n      ")}`,
      );
    }
  }
  return failed === 0;
}

function format(value) {
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
