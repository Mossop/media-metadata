module.exports = class DataReader {
  constructor(data, offset = 0, alignment = false) {
    this.data = data;
    this.offset = offset;
    this.alignment = alignment;
  }

  readStr(peek = false) {
    let offset = this.offset;
    let bytes = [];
    let byte = this.read8();
    while (byte != 0 && (this.offset < this.data.byteLength)) {
      bytes.push(byte);
      byte = this.read8();
    }

    if (byte != 0) {
      throw new Error("String never terminated.");
    }

    if (peek) {
      this.offset = offset;
    }

    return String.fromCharCode(...bytes);
  }

  read8(peek = false) {
    let value = this.data.getUint8(this.offset);

    if (!peek) {
      this.offset += 1;
    }

    return value;
  }

  read16(peek = false) {
    let value = this.data.getUint16(this.offset, this.alignment);

    if (!peek) {
      this.offset += 2;
    }

    return value;
  }

  read32(peek = false) {
    let value = this.data.getUint32(this.offset, this.alignment);

    if (!peek) {
      this.offset += 4;
    }

    return value;
  }

  readSigned8(peek = false) {
    let value = this.data.getInt8(this.offset);

    if (!peek) {
      this.offset += 1;
    }

    return value;
  }

  readSigned16(peek = false) {
    let value = this.data.getInt16(this.offset, this.alignment);

    if (!peek) {
      this.offset += 2;
    }

    return value;
  }

  readSigned32(peek = false) {
    let value = this.data.getInt32(this.offset, this.alignment);

    if (!peek) {
      this.offset += 4;
    }

    return value;
  }
};
