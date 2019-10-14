import fileType from "file-type";

import { parseJpegData } from "./jpeg";
import { Metadata, newRawMetadata, generateMetadata } from "./metadata";
import { DataViewReader } from "./datareader";

export async function parseBuffer(buffer: ArrayBuffer): Promise<Metadata> {
  let type = fileType(buffer);

  if (!type) {
    throw new Error("Unknown file type.");
  }

  let reader = new DataViewReader(new DataView(buffer));

  switch (type.mime) {
    case "image/jpeg":
      return generateMetadata(await parseJpegData(reader), type.mime);
    default:
      return generateMetadata(newRawMetadata(), type.mime);
  }
}
