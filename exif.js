const DataReader = require("./datareader");

module.exports.EXIF_HEAD = "Exif";

const ALIGN_INTEL = 0x4949;
const ALIGN_MOTO = 0x4D4D;
const ALIGN_CHECK = 0x002A;

const TYPE_BYTE = 1;
const TYPE_STR = 2;
const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const TYPE_RATIONAL = 5;
const TYPE_SBYTE = 6;
const TYPE_UNKNOWN = 7;
const TYPE_SSHORT = 8;
const TYPE_SLONG = 9;
const TYPE_SRATIONAL = 10;
const TYPE_SINGLE = 11;
const TYPE_DOUBLE = 12;
const COMPONENT_SIZES = {
  [TYPE_BYTE]: 1,
  [TYPE_STR]: 1,
  [TYPE_SHORT]: 2,
  [TYPE_LONG]: 4,
  [TYPE_RATIONAL]: 8,
  [TYPE_SBYTE]: 1,
  [TYPE_UNKNOWN]: 1,
  [TYPE_SSHORT]: 2,
  [TYPE_SLONG]: 4,
  [TYPE_SRATIONAL]: 8,
  [TYPE_SINGLE]: 4,
  [TYPE_DOUBLE]: 8,
};

const ID_EXIF_IFD = 0x8769;
const ID_GPS_IFD = 0x8825;
const ID_INTEROP_IFD = 0xA005;

const exiftags = require("./exiftags");

class ExifParser extends DataReader {
  constructor(data, metadata){
    super(data);
    this.metadata = metadata;
  }

  readData(type, components) {
    let results = [];

    switch (type) {
      case TYPE_UNKNOWN:
      case TYPE_BYTE:
        for (let i = 0; i < components; i++) {
          results.push(this.read8());
        }
        break;
      case TYPE_SHORT:
        for (let i = 0; i < components; i++) {
          results.push(this.read16());
        }
        break;
      case TYPE_LONG:
        for (let i = 0; i < components; i++) {
          results.push(this.read32());
        }
        break;
      case TYPE_STR:
        for (let i = 0; i < components; i++) {
          results.push(this.read8());
        }

        if (results[results.length - 1] != 0) {
          throw new Error("Missing null terminator from string.");
        } else {
          results.pop();
        }

        return String.fromCharCode(...results);
      case TYPE_RATIONAL: {
        for (let i = 0; i < components; i++) {
          results.push(1.0 * this.read32() / this.read32());
        }
        break;
      }
      case TYPE_SBYTE:
        for (let i = 0; i < components; i++) {
          results.push(this.readSigned8());
        }
        break;
      case TYPE_SSHORT:
        for (let i = 0; i < components; i++) {
          results.push(this.readSigned16());
        }
        break;
      case TYPE_SLONG:
        for (let i = 0; i < components; i++) {
          results.push(this.readSigned32());
        }
        break;
      case TYPE_SRATIONAL: {
        for (let i = 0; i < components; i++) {
          results.push(1.0 * this.readSigned32() / this.readSigned32());
        }
        break;
      }
      default:
        throw new Error("Unable to read type.", type);
    }

    return results;
  }

  parseIFD(metaType, tags) {
    if (!(metaType in this.metadata)) {
      this.metadata[metaType] = {};
    }

    let count = this.read16();
    for (let i = 0; i < count; i++) {
      let tag = this.read16();
      let type = this.read16();
      let components = this.read32();

      // Record where the next entry starts
      let offset = this.offset + 4;

      if ((COMPONENT_SIZES[type] * components) > 4) {
        this.offset = this.tiffOffset + this.read32();
      }

      // Now positioned to read the data if we want it.
      let data = this.readData(type, components);

      switch (tag) {
        case ID_GPS_IFD:
        case ID_EXIF_IFD:
        case ID_INTEROP_IFD: {
          if (data.length != 1) {
            throw new Error(`Unexpected IFD offset tag ${tag.toString(16)} ${type} ${components}`);
          }

          let ifdOffset = data[0];
          this.offset = this.tiffOffset + ifdOffset;
          if (tag == ID_GPS_IFD) {
            this.parseIFD("gps", exiftags.gps);
          } else if (tag == ID_INTEROP_IFD) {
            this.parseIFD("interoperability", {});
          } else {
            this.parseIFD("exif", exiftags.exif);
          }
          break;
        }
        default:
          if (tag in tags) {
            tag = tags[tag];
          }
          this.metadata[metaType][tag] = data;
      }

      this.offset = offset;
    }
  }

  parse() {
    // Skip over the EXIF header.
    this.offset += 6;

    // Where the TIFF header starts is the relative position for all offsets.
    this.tiffOffset = this.offset;

    let align = this.read16();
    if (align == ALIGN_INTEL) {
      this.alignment = true;
    } else if (align != ALIGN_MOTO) {
      throw new Error(`Unexpected alignment data: ${align.toString(16)}`);
    }

    let check = this.read16();
    if (check != ALIGN_CHECK) {
      throw new Error(`Alignment check failed: ${check.toString(16)}`);
    }

    this.offset = this.tiffOffset + this.read32();

    let nextIfd;
    do {
      this.parseIFD("image", exiftags.exif);
      nextIfd = this.read32();
      this.offset = this.tiffOffset + nextIfd;
    } while (nextIfd != 0);
  }
}

module.exports.parseExifData = function parseExifData(data, metadata) {
  let parser = new ExifParser(data, metadata);
  parser.parse();
};
