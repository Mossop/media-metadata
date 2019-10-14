import fileType from "file-type";
import moment from "moment";

import { parseJpegData } from "./jpeg";
import { RawMetadata, Metadata, XmpType, newRawMetadata } from "./metadata";
import { DataViewReader } from "./datareader";

const EXIF_DATE_FORMAT = "YYYY:MM:DD HH:mm:ss";
function parseExifDate(datestr: string): moment.Moment {
  return moment(datestr, EXIF_DATE_FORMAT).utc();
}

function buildTags(list: XmpType[], hierarchical: boolean = false): string[][] {
  function isString(i: XmpType): i is string {
    return typeof i === "string";
  }

  let filtered: string[] = list.filter(isString);
  if (hierarchical) {
    return filtered.map((t: string) => t.split(/\|/));
  }
  return filtered.map((t: string) => [t]);
}

function generateMetadata(raw: RawMetadata, mimetype: string): Metadata {
  let metadata: Metadata = {
    mimetype,
    tags: [],
    raw,
  };

  if (typeof raw.xmp["http://ns.adobe.com/xap/1.0/CreateDate"] === "string") {
    metadata.created = moment(raw.xmp["http://ns.adobe.com/xap/1.0/CreateDate"]).utc().toISOString(true);
  } else if (typeof raw.exif.DateTimeOriginal === "string") {
    metadata.created = parseExifDate(raw.exif.DateTimeOriginal).toISOString(true);
  } else if (typeof raw.exif.CreateDate === "string") {
    metadata.created = parseExifDate(raw.exif.CreateDate).toISOString(true);
  }

  if (Array.isArray(raw.gps.GPSLatitude) &&
    typeof raw.gps.GPSLatitudeRef === "string" &&
    Array.isArray(raw.gps.GPSLongitude) &&
    typeof raw.gps.GPSLongitudeRef === "string") {

    let [deg, min, sec] = raw.gps.GPSLatitude;
    deg += min/60 + sec/3600;
    if (raw.gps.GPSLatitudeRef === "S") {
      deg = -deg;
    }
    metadata.latitude = deg;

    [deg, min, sec] = raw.gps.GPSLongitude;
    deg += min/60 + sec/3600;
    if (raw.gps.GPSLongitudeRef == "W") {
      deg = -deg;
    }
    metadata.longitude = deg;
  }

  if (Array.isArray(raw.xmp["http://ns.adobe.com/lightroom/1.0/hierarchicalSubject"])) {
    metadata.tags = buildTags(raw.xmp["http://ns.adobe.com/lightroom/1.0/hierarchicalSubject"], true);
  } else if (Array.isArray(raw.xmp["http://purl.org/dc/elements/1.1/subject"])) {
    metadata.tags = buildTags(raw.xmp["http://purl.org/dc/elements/1.1/subject"]);
  }

  return metadata;
}

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
