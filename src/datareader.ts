export enum Alignment {
  BigEndian = 0,
  LittleEndian = 1,
}

export abstract class DataReader {
  protected _alignment: Alignment;

  public constructor(alignment: Alignment = Alignment.BigEndian) {
    this._alignment = alignment;
  }

  public get alignment(): Alignment {
    return this._alignment;
  }

  public set alignment(alignment: Alignment) {
    this._alignment = alignment;
  }

  protected assertSeek(offset: number): void {
    if (offset < 0 || offset > this.length) {
      throw new Error(`Attempted to seek to offset ${offset} failed (${this.length} bytes are available).`);
    }
  }

  protected assertAvailable
  (bytes: number): void {
    if ((this.offset + bytes) > this.length) {
      throw new Error(`Read required ${bytes} bytes but only ${this.length - this.offset} bytes were available.`);
    }
  }

  public abstract get offset(): number;
  public abstract get length(): number;
  public abstract skip(count: number): Promise<void>;
  public abstract seek(offset: number): Promise<void>;
  public abstract read8(peek?: boolean): Promise<number>;
  public abstract read16(peek?: boolean): Promise<number>;
  public abstract read32(peek?: boolean): Promise<number>;
  public abstract readSigned8(peek?: boolean): Promise<number>;
  public abstract readSigned16(peek?: boolean): Promise<number>;
  public abstract readSigned32(peek?: boolean): Promise<number>;
  public abstract readData(length: number, peek?: boolean): Promise<ArrayBuffer>;

  public async readStr(maxLength?: number, peek: boolean = false): Promise<string | undefined> {
    let offset = this.offset;
    let bytes = [];
    let max = maxLength ? maxLength + 1 : this.length - this.offset;

    while (bytes.length < max) {
      let byte = await this.read8();
      if (byte === 0) {
        if (peek) {
          await this.seek(offset);
        }

        return String.fromCharCode(...bytes);
        break;
      }

      bytes.push(byte);
    }

    // Failed to find a string.
    await this.seek(offset);
    return undefined;
  }
}

export class DataViewReader extends DataReader {
  private data: DataView;
  private _offset: number;

  public constructor(data: DataView, offset: number = 0, alignment: Alignment = Alignment.BigEndian) {
    super(alignment);
    this.data = data;
    this._offset = offset;
  }

  public get offset(): number {
    return this._offset;
  }

  public get length(): number {
    return this.data.byteLength;
  }

  public async skip(count: number): Promise<void> {
    this.assertSeek(this._offset + count);
    this._offset += count;
  }

  public async seek(offset: number): Promise<void> {
    this.assertSeek(offset);
    this._offset = offset;
  }

  public async read8(peek: boolean = false): Promise<number> {
    this.assertAvailable(1);
    let value = this.data.getUint8(this._offset);

    if (!peek) {
      this._offset += 1;
    }

    return value;
  }

  public async read16(peek: boolean = false): Promise<number> {
    this.assertAvailable(2);
    let value = this.data.getUint16(this._offset, this.alignment == Alignment.LittleEndian);

    if (!peek) {
      this._offset += 2;
    }

    return value;
  }

  public async read32(peek: boolean = false): Promise<number> {
    this.assertAvailable(4);
    let value = this.data.getUint32(this._offset, this.alignment == Alignment.LittleEndian);

    if (!peek) {
      this._offset += 4;
    }

    return value;
  }

  public async readSigned8(peek: boolean = false): Promise<number> {
    this.assertAvailable(1);
    let value = this.data.getInt8(this._offset);

    if (!peek) {
      this._offset += 1;
    }

    return value;
  }

  public async readSigned16(peek: boolean = false): Promise<number> {
    this.assertAvailable(2);
    let value = this.data.getInt16(this._offset, this.alignment == Alignment.LittleEndian);

    if (!peek) {
      this._offset += 2;
    }

    return value;
  }

  public async readSigned32(peek: boolean = false): Promise<number> {
    this.assertAvailable(4);
    let value = this.data.getInt32(this._offset, this.alignment == Alignment.LittleEndian);

    if (!peek) {
      this._offset += 4;
    }

    return value;
  }

  public async readData(length: number, peek?: boolean): Promise<ArrayBuffer> {
    this.assertAvailable(length);
    let data = this.data.buffer.slice(this._offset, this._offset + length);
    if (!peek) {
      this._offset += length;
    }
    return data;
  }
}
