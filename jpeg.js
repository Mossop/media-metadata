const DataReader = require("./datareader");
const { parseExifData, EXIF_HEAD } = require("./exif");
const { parseXmpData, NS_XMP } = require("./xmp");

const JPEG_EOI = 0xFFD9;
const JPEG_SOS = 0xFFDA;
const JPEG_APP1 = 0xFFE1;

class JpegParser extends DataReader {
  constructor(data, metadata) {
    super(data, 2);
    this.metadata = metadata;
  }

  parse() {
    while (true) { // eslint-disable-line
      let id = this.read16();
      let length = this.read16() - 2;
      if ((this.offset + length) >= this.data.byteLength) {
        throw new Error("Jpeg section ran over end of file.");
      }

      switch (id) {
        case JPEG_SOS:
        case JPEG_EOI:
          return;
        case JPEG_APP1: {
          let str = "";
          try {
            str = this.readStr(true);
          } catch (e) {
            // Ignore failures to read strings.
          }

          if (str == EXIF_HEAD) {
            let view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, length);
            parseExifData(view, this.metadata);
          }
          else if (str == NS_XMP) {
            let view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, length);
            parseXmpData(view, this.metadata);
          }
          break;
        }
      }

      this.offset += length;
    }
  }
}

module.exports.parseJpegData = function parseJpegData(data, metadata) {
  let parser = new JpegParser(data, metadata);
  parser.parse();
};
