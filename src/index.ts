import fileType from "file-type";

import { parseJpegData, isJPEG } from "./jpeg";
import { Metadata, newRawMetadata, generateMetadata } from "./metadata";
import { DataViewReader, DataReader } from "./datareader";

async function checkType(reader: DataReader, checker: (reader: DataReader) => Promise<boolean>): Promise<boolean> {
  let result = await checker(reader);
  await reader.seek(0);
  return result;
}

export async function parseBuffer(buffer: ArrayBuffer): Promise<Metadata> {
  let reader = new DataViewReader(new DataView(buffer));
  if (await checkType(reader, isJPEG)) {
    return generateMetadata(await parseJpegData(reader), "image/jpeg");
  }

  let type = fileType(buffer);

  if (!type) {
    throw new Error("Unknown file type.");
  }
  return generateMetadata(newRawMetadata(), type.mime);
}
