import fileType from "file-type";

import { parseJpegData, isJPEG } from "./jpeg";
import { Metadata, newRawMetadata, generateMetadata } from "./metadata";
import { DataViewReader, DataReader } from "./datareader";
import { isMP4, parseMp4Data } from "./mp4";

async function checkType(reader: DataReader, checker: (reader: DataReader) => Promise<boolean>): Promise<boolean> {
  let result = await checker(reader);
  await reader.seek(0);
  return result;
}

export async function parseBuffer(buffer: ArrayBuffer): Promise<Metadata> {
  let reader = new DataViewReader(new DataView(buffer));
  if (await checkType(reader, isJPEG)) {
    return generateMetadata(await parseJpegData(reader), "image/jpeg");
  } else if (await checkType(reader, isMP4)) {
    return generateMetadata(await parseMp4Data(reader), "video/mp4");
  }

  let type = fileType(buffer);

  if (!type) {
    throw new Error("Unknown file type.");
  }
  return generateMetadata(newRawMetadata(), type.mime);
}
