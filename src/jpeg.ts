import { DataReader, Alignment } from "./datareader";
//import { parseXmpData, NS_XMP } from "./xmp";
import { Metadata, newMetadata } from "./metadata";
import { parseIfdData } from "./ifd";
import { parseXmpData } from "./xmp";

// https://www.w3.org/Graphics/JPEG/jfif3.pdf
// https://en.wikipedia.org/wiki/JPEG_File_Interchange_Format#File_format_structure
// https://en.wikipedia.org/wiki/JPEG#Syntax_and_structure
// https://www.exif.org/Exif2-2.PDF

const JPEG_SOI = 0xFFD8;

const JPEG_APPX = 0xFFE0;
const JPEG_SOS = 0xFFDA;
const JPEG_EOI = 0xFFD9;

export async function parseJpegData(reader: DataReader): Promise<Metadata> {
  let metadata: Metadata = newMetadata();

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
        if (identifier === "Exif") {
          await parseIfdData(reader, metadata);
        } else if (identifier === "http://ns.adobe.com/xap/1.0/") {
          await parseXmpData(reader, metadata, frameLength - (identifier.length + 1));
        }
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
