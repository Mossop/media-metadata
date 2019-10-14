import fileType from "file-type";
import { parseJpegData } from "./jpeg";
import { Metadata } from "./metadata";
import { DataViewReader } from "./datareader";

export async function parseBuffer(buffer: ArrayBuffer): Promise<Metadata> {
  let type = fileType(buffer);

  if (!type) {
    throw new Error("Unknown file type.");
  }

  let reader = new DataViewReader(new DataView(buffer));

  switch (type.mime) {
    case "image/jpeg":
      return parseJpegData(reader);
    default:
      throw new Error(`Unsupported file type "${type.mime}".`);
  }
}
