import { DataReader, Alignment } from "./datareader";
import { RawMetadata } from "./types";
import { newRawMetadata } from "./metadata";
import { parseIfdData } from "./ifd";
import { parseXmpData } from "./xmp";

// https://www.w3.org/Graphics/JPEG/jfif3.pdf
// https://en.wikipedia.org/wiki/JPEG_File_Interchange_Format#File_format_structure
// https://en.wikipedia.org/wiki/JPEG#Syntax_and_structure
// https://www.exif.org/Exif2-2.PDF
// http://vip.sugovica.hu/Sardi/kepnezo/JPEG%20File%20Layout%20and%20Format.htm

const JPEG_SOI = 0xFFD8;
const JFIF_IDENTIFIER = "JFIF";
const EXIF_IDENTIFIER = "Exif";
const XMP_IDENTIFIER = "http://ns.adobe.com/xap/1.0/";

const JPEG_APPX = 0xFFE0;
const JPEG_SOF = 0xFFC0;
const JPEG_SOS = 0xFFDA;
const JPEG_EOI = 0xFFD9;

export async function isJPEG(reader: DataReader): Promise<boolean> {
  reader.alignment = Alignment.BigEndian;
  if (JPEG_SOI !== await reader.read16()) {
    return false;
  }

  let frame = await reader.read16();
  if (frame < JPEG_APPX || frame > JPEG_APPX + 0xF) {
    return false;
  }

  let frameLength = await reader.read16() - 2;
  let identifier = await reader.readStr(frameLength);
  return identifier === JFIF_IDENTIFIER || identifier === EXIF_IDENTIFIER;
}

export async function parseJpegData(reader: DataReader): Promise<RawMetadata> {
  reader.alignment = Alignment.BigEndian;
  let metadata: RawMetadata = newRawMetadata();

  let soi = await reader.read16();
  if (soi !== JPEG_SOI) {
    throw new Error(`Unexpected file header: '${soi.toString(16)}'`);
  }

  let frameId = await reader.read16();
  while (frameId !== JPEG_SOS && frameId !== JPEG_EOI) {
    if ((frameId & 0xFF00) != 0xFF00) {
      // Unexpected marker, abandon parsing here.
      return metadata;
    }

    // The frame length includes the bytes for the length.
    let frameLength = await reader.read16() - 2;
    let nextFrame = reader.offset + frameLength;

    if (frameId >= JPEG_APPX && frameId < JPEG_APPX + 0xF) {
      let app = frameId - JPEG_APPX;
      let identifier = await reader.readStr(frameLength);

      if (app === 1) {
        if (identifier === EXIF_IDENTIFIER) {
          await parseIfdData(reader, metadata);
        } else if (identifier === XMP_IDENTIFIER) {
          await parseXmpData(reader, metadata, frameLength - (identifier.length + 1));
        }
      }
    }

    if (frameId >= JPEG_SOF && frameId < JPEG_SOF + 0xF) {
      let type = frameId - JPEG_SOF;
      if (type !== 0x4 && type !== 0x8 && type !== 0xC) {
        // This is a valid start of frame.
        reader.skip(1);
        metadata.height = await reader.read16();
        metadata.width = await reader.read16();
      }
    }

    // Make sure to reset the alignment.
    // eslint-disable-next-line require-atomic-updates
    reader.alignment = Alignment.BigEndian;

    reader.seek(nextFrame);
    frameId = await reader.read16();
  }

  return metadata;
}
