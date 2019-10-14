export type ExifData = {
  [tag: string]: string | number[];
  [tag: number]: string | number[];
};

export type XmpType = string | XmpData;

export interface XmpData {
  [key: string]: XmpType | XmpType[];
}

export enum ExifMetadataType {
  Image = "image",
  Gps = "gps",
  Interoperability = "interoperability",
  Exif = "exif",
}

export interface RawMetadata {
  [ExifMetadataType.Image]: ExifData;
  [ExifMetadataType.Gps]: ExifData;
  [ExifMetadataType.Interoperability]: ExifData;
  [ExifMetadataType.Exif]: ExifData;
  xmp: XmpData;
}

export interface Metadata {
  mimetype: string;
  width?: number;
  height?: number;
  created?: string;

  tags: string[][];
  longitude?: number;
  latitude?: number;

  raw: RawMetadata;
}

export function newRawMetadata(): RawMetadata {
  return {
    [ExifMetadataType.Image]: {},
    [ExifMetadataType.Gps]: {},
    [ExifMetadataType.Interoperability]: {},
    [ExifMetadataType.Exif]: {},
    xmp: {},
  };
}

const EXIF_DATE_REGEX = /^(\d+):(\d+):(\d+) (\d+):(\d+):(\d+)$/;

function isString(i: XmpType): i is string {
  return typeof i === "string";
}

function choose<T>(choices: Iterable<T | undefined>): T | undefined {
  for (let choice of choices) {
    if (choice !== undefined) {
      return choice;
    }
  }
  return undefined;
}

class MetaDataResolver {
  private raw: RawMetadata;

  public constructor(raw: RawMetadata) {
    this.raw = raw;
  }

  private getXmpString(property: string): string | undefined {
    let value = this.raw.xmp[property];
    if (typeof value === "string") {
      return value;
    }
    return undefined;
  }

  private getXmpDate(property: string): string | undefined {
    return this.getXmpString(property);
  }

  private getXmpStrings(property: string): string[] | undefined {
    let value = this.raw.xmp[property];
    if (Array.isArray(value)) {
      return value.filter(isString);
    }
    return undefined;
  }

  private getExifString(property: string): string | undefined {
    let value = this.raw.exif[property];
    if (typeof value === "string") {
      return value;
    }
    return undefined;
  }

  private getExifDate(property: string): string | undefined {
    function pad(v: string): string {
      let n = parseInt(v);
      return n.toString().padStart(2, "0");
    }

    let value = this.getExifString(property);
    if (value) {
      let matches = EXIF_DATE_REGEX.exec(value);
      if (matches) {
        const [, year, month, day, hour, minute, second] = matches;
        return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
      }
    }
    return undefined;
  }

  public *created(): Iterable<string | undefined> {
    yield this.getXmpDate("http://ns.adobe.com/xap/1.0/CreateDate");
    yield this.getExifDate("DateTimeOriginal");
    return this.getExifDate("CreateDate");
  }

  public *tags(): Iterable<string[][] | undefined> {
    let tags = this.getXmpStrings("http://ns.adobe.com/lightroom/1.0/hierarchicalSubject");
    yield tags ? tags.map((t: string) => t.split(/\|/)) : undefined;
    tags = this.getXmpStrings("http://purl.org/dc/elements/1.1/subject");
    yield tags ? tags.map((t: string) => [t]) : undefined;
  }
}

export function generateMetadata(raw: RawMetadata, mimetype: string): Metadata {
  let resolver = new MetaDataResolver(raw);

  let metadata: Metadata = {
    mimetype,
    created: choose(resolver.created()),
    tags: choose(resolver.tags()) || [],
    raw,
  };

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

  return metadata;
}
