import { DataReader, Alignment } from "./datareader";
import exiftags, { TagNames } from "./exif-tags";
import { Metadata, ExifMetadataType } from "./metadata";

const BYTE_ORDER_INTEL = 0x4949;
const BYTE_ORDER_MOTO = 0x4D4D;
const TIFF_VERSION = 42;

enum DataType {
  Unknown = "UNKNOWN",
  Byte = "BYTE",
  String = "STRING",
  Short = "SHORT",
  Long = "LONG",
  Rational = "RATIONAL",
  SignedByte = "SIGNED_BYTE",
  Undefined = "UNDEFINED",
  SignedShort = "SIGNED_SHORT",
  SignedLong = "SIGNED_LONG",
  SignedRational = "SIGNED_RATIONAL",
  Single = "SINGLE",
  Double = "DOUBLE",
}

function typeFromValue(value: number): DataType {
  switch (value) {
    case 1:
      return DataType.Byte;
    case 2:
      return DataType.String;
    case 3:
      return DataType.Short;
    case 4:
      return DataType.Long;
    case 5:
      return DataType.Rational;
    case 6:
      return DataType.SignedByte;
    case 7:
      return DataType.Undefined;
    case 8:
      return DataType.SignedShort;
    case 9:
      return DataType.SignedLong;
    case 10:
      return DataType.SignedRational;
    case 11:
      return DataType.Single;
    case 12:
      return DataType.Double;
    default:
      return DataType.Unknown;
  }
}

// The number of bytes in a component of each type.
const COMPONENT_SIZES = {
  [DataType.Unknown]: 1,
  [DataType.Byte]: 1,
  [DataType.String]: 1,
  [DataType.Short]: 2,
  [DataType.Long]: 4,
  [DataType.Rational]: 8,
  [DataType.SignedByte]: 1,
  [DataType.Undefined]: 1,
  [DataType.SignedShort]: 2,
  [DataType.SignedLong]: 4,
  [DataType.SignedRational]: 8,
  [DataType.Single]: 4,
  [DataType.Double]: 8,
};

const ID_EXIF_IFD = 0x8769;
const ID_GPS_IFD = 0x8825;
const ID_INTEROP_IFD = 0xA005;

async function readString(reader: DataReader, length: number): Promise<string> {
  let characters: number[] = [];
  for (let i = 0; i < length; i++) {
    characters.push(await reader.read8());
  }

  if (characters[characters.length - 1] != 0) {
    throw new Error("Missing null terminator from string.");
  } else {
    characters.pop();
  }

  return String.fromCharCode(...characters);
}

async function readData(reader: DataReader, type: DataType, components: number): Promise<number[]> {
  let results: number[] = [];

  switch (type) {
    case DataType.Unknown:
    case DataType.Undefined:
    case DataType.Byte:
      for (let i = 0; i < components; i++) {
        results.push(await reader.read8());
      }
      break;
    case DataType.Short:
      for (let i = 0; i < components; i++) {
        results.push(await reader.read16());
      }
      break;
    case DataType.Long:
      for (let i = 0; i < components; i++) {
        results.push(await reader.read32());
      }
      break;
    case DataType.Rational: {
      for (let i = 0; i < components; i++) {
        results.push(1.0 * await reader.read32() / await reader.read32());
      }
      break;
    }
    case DataType.SignedByte:
      for (let i = 0; i < components; i++) {
        results.push(await reader.readSigned8());
      }
      break;
    case DataType.SignedShort:
      for (let i = 0; i < components; i++) {
        results.push(await reader.readSigned16());
      }
      break;
    case DataType.SignedLong:
      for (let i = 0; i < components; i++) {
        results.push(await reader.readSigned32());
      }
      break;
    case DataType.SignedRational: {
      for (let i = 0; i < components; i++) {
        results.push(1.0 * await reader.readSigned32() / await reader.readSigned32());
      }
      break;
    }
    default:
      throw new Error(`Unable to read type '${type}'.`);
  }

  return results;
}

async function parseIFD(reader: DataReader, metadata: Metadata, tiffOffset: number, ifdOffset: number, count: number, metaType: ExifMetadataType): Promise<void> {
  if (ifdOffset === 0) {
    return;
  }
  await reader.seek(tiffOffset + ifdOffset);

  let tags: TagNames;
  if (metaType == ExifMetadataType.Image) {
    tags = exiftags[ExifMetadataType.Exif];
  } else {
    tags = exiftags[metaType];
  }

  let exifData = metadata[metaType];

  let fieldCount = await reader.read16();
  for (let i = 0; i < fieldCount; i++) {
    let tagId: number = await reader.read16();
    let fieldType = typeFromValue(await reader.read16());

    // This is measured in number of components. Each component may be multiple
    // bytes. See COMPONENT_SIZES.
    let componentsInField = await reader.read32();

    // Record where the next entry starts
    let offset = reader.offset + 4;

    // If the data <= 4 bytes then it is stored here, otherwise the next 4 bytes
    // are an offset to where the data is stored.
    if ((COMPONENT_SIZES[fieldType] * componentsInField) > 4) {
      let offset = await reader.read32();
      await reader.seek(tiffOffset + offset);
    }

    // Now positioned to read the data if we want it.

    switch (tagId) {
      // Some tags are pointers to other IFDs.
      case ID_GPS_IFD:
      case ID_EXIF_IFD:
      case ID_INTEROP_IFD: {
        if (fieldType !== DataType.Long) {
          throw new Error(`Unexpected data type for IFD offset ${tagId.toString(16)}: '${fieldType}'`);
        }

        let offset = await readData(reader, fieldType, componentsInField);
        if (offset.length != 1) {
          throw new Error(`Unexpected offset count for IFD ${tagId.toString(16)}: ${offset.length}`);
        }

        if (tagId == ID_GPS_IFD) {
          await parseIFD(reader, metadata, tiffOffset, offset[0], 0, ExifMetadataType.Gps);
        } else if (tagId == ID_INTEROP_IFD) {
          await parseIFD(reader, metadata, tiffOffset, offset[0], 0, ExifMetadataType.Interoperability);
        } else {
          await parseIFD(reader, metadata, tiffOffset, offset[0], 0, ExifMetadataType.Exif);
        }
        break;
      }
      // Otherwise they are just data.
      default: {
        let data: string | number[];
        if (fieldType === DataType.String) {
          data = await readString(reader, componentsInField);
        } else {
          data = await readData(reader, fieldType, componentsInField);
        }

        if (tagId in tags) {
          // Named tag
          exifData[tags[tagId]] = data;
        } else {
          // Unknown tag
          exifData[tagId] = data;
        }
      }
    }

    // Seek to the next tag.
    await reader.seek(offset);
  }

  let nextIfd = await reader.read32();
  await parseIFD(reader, metadata, tiffOffset, nextIfd, count + 1, metaType);
}

export async function parseIfdData(reader: DataReader, metadata: Metadata): Promise<void> {
  // Contains 1 padding byte, presumably to align the tiff data on an even boundary.
  reader.skip(1);

  // Where the TIFF header starts is the relative position for all offsets.
  let tiffOffset = reader.offset;

  // Figure out the byte alignment.
  let align = await reader.read16();
  if (align == BYTE_ORDER_INTEL) {
    // eslint-disable-next-line require-atomic-updates
    reader.alignment = Alignment.LittleEndian;
  } else if (align != BYTE_ORDER_MOTO) {
    throw new Error(`Unexpected alignment data: ${align.toString(16)}`);
  } else {
    // eslint-disable-next-line require-atomic-updates
    reader.alignment = Alignment.BigEndian;
  }

  // Verfy that it is correct.
  let check = await reader.read16();
  if (check != TIFF_VERSION) {
    throw new Error(`Unknown TIFF version ${check} (Perhaps the alignment is incorrectly).`);
  }

  let ifdOffset = await reader.read32();

  // The initial IFD is for image data.
  await parseIFD(reader, metadata, tiffOffset, ifdOffset, 0, ExifMetadataType.Image);
}
