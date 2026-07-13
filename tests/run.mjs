/* run.mjs
 * Copyright (C) 2026  Bruno Silva
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Test entry point: `node tests/run.mjs`. Imports every *.test.mjs suite, then
 * runs them and exits non-zero on failure.
 */

import { run } from "./lib/harness.js";

await import("./parsers.test.mjs");
await import("./validators.test.mjs");
await import("./roundtrip.test.mjs");

const ok = await run();
process.exit(ok ? 0 : 1);
