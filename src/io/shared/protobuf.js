/* protobuf.js
 * Copyright (C) 2026  Bruno Silva
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * A tiny, read-only Protocol Buffers decoder — just enough of the wire format
 * to parse Google Authenticator's migration payload. It intentionally supports
 * only the wire types that payload uses (varint and length-delimited) and is
 * hardened against malformed input (bounds-checked, no allocation blow-ups).
 *
 * Wire format reference: https://protobuf.dev/programming-guides/encoding/
 */

export const WireType = {
  VARINT: 0,
  I64: 1,
  LEN: 2,
  I32: 5,
};

export class Reader {
  constructor(bytes) {
    this.buf = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    this.pos = 0;
  }

  get atEnd() {
    return this.pos >= this.buf.length;
  }

  // Read a base-128 varint as an unsigned JS number (safe up to 2^53).
  readVarint() {
    let result = 0;
    let shift = 0;
    while (true) {
      if (this.pos >= this.buf.length) throw new Error("Truncated varint.");
      const byte = this.buf[this.pos++];
      result += (byte & 0x7f) * Math.pow(2, shift);
      if ((byte & 0x80) === 0) break;
      shift += 7;
      if (shift > 63) throw new Error("Varint is too long.");
    }
    return result;
  }

  // Read a length-delimited field as a byte slice.
  readBytes() {
    const length = this.readVarint();
    if (length < 0 || this.pos + length > this.buf.length) {
      throw new Error("Length-delimited field overruns the buffer.");
    }
    const slice = this.buf.subarray(this.pos, this.pos + length);
    this.pos += length;
    return slice;
  }

  readString() {
    return new TextDecoder("utf-8", { fatal: false }).decode(this.readBytes());
  }

  // Skip a field whose contents we don't care about.
  skip(wireType) {
    switch (wireType) {
      case WireType.VARINT:
        this.readVarint();
        break;
      case WireType.I64:
        this.pos += 8;
        break;
      case WireType.LEN:
        this.readBytes();
        break;
      case WireType.I32:
        this.pos += 4;
        break;
      default:
        throw new Error(`Unsupported wire type ${wireType}.`);
    }
    if (this.pos > this.buf.length)
      throw new Error("Field overruns the buffer.");
  }

  // Read a field tag, returning { fieldNumber, wireType }.
  readTag() {
    const tag = this.readVarint();
    return { fieldNumber: tag >>> 3, wireType: tag & 0x07 };
  }
}
