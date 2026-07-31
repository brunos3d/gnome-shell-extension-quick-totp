/* debug.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import GLib from 'gi://GLib';

/*
 * Diagnostics are gated behind an environment flag so normal operation stays
 * quiet in the logs (see the EGO review guideline on excessive logging).
 * Set QUICK_TOTP_DEBUG=1 in the environment to see them.
 *
 * Note: this module reads the environment via GLib, so it must not be
 * imported from the Node-tested modules under src/lib/io/.
 */
const DEBUG = GLib.getenv('QUICK_TOTP_DEBUG') === '1';

export function logDebug(error) {
    if (DEBUG) console.error(error);
}
