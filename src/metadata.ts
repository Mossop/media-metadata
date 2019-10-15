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
  Thumbnail = "thumbnail",
}

export type LinkedMetadataBlocks =
  ExifMetadataType.Gps |
  ExifMetadataType.Interoperability |
  ExifMetadataType.Exif;

export interface RawMetadata {
  [ExifMetadataType.Image]: ExifData;
  [ExifMetadataType.Gps]: ExifData;
  [ExifMetadataType.Interoperability]: ExifData;
  [ExifMetadataType.Exif]: ExifData;
  [ExifMetadataType.Thumbnail]: ExifData;
  thumbnailData?: ArrayBuffer;
  xmp: XmpData;
}

export enum Orientation {
  Normal = 1,
  Mirror = 2,
  Rotate180 = 3,
  MirrorRotate180 = 4,
  Rotate90Mirror = 5,
  Rotate270 = 6,
  Rotate270Mirror = 7,
  Rotate90 = 8,
}

export interface Metadata {
  mimetype: string;
  width?: number;
  height?: number;
  created?: string;

  tags: string[][];
  people: string[];
  longitude?: number;
  latitude?: number;
  orientation: Orientation;

  thumbnail?: ArrayBuffer;

  raw: RawMetadata;
}

export function newRawMetadata(): RawMetadata {
  return {
    [ExifMetadataType.Image]: {},
    [ExifMetadataType.Gps]: {},
    [ExifMetadataType.Interoperability]: {},
    [ExifMetadataType.Exif]: {},
    [ExifMetadataType.Thumbnail]: {},
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

  public getXmpString(property: string): string | undefined {
    let value = this.raw.xmp[property];
    if (typeof value === "string") {
      return value;
    }
    return undefined;
  }

  public getXmpDate(property: string): string | undefined {
    return this.getXmpString(property);
  }

  public getXmpStrings(property: string): string[] | undefined {
    let value = this.raw.xmp[property];
    if (Array.isArray(value)) {
      return value.filter(isString);
    }
    return undefined;
  }

  public getExifNumber(property: string): number | undefined {
    let value = this.raw.exif[property];
    if (Array.isArray(value) && value.length === 1) {
      return value[0];
    }
    return undefined;
  }

  public getExifString(property: string): string | undefined {
    let value = this.raw.exif[property];
    if (typeof value === "string") {
      return value;
    }
    return undefined;
  }

  public getExifDate(property: string): string | undefined {
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

  public *people(): Iterable<string[] | undefined> {
    yield this.getXmpStrings("http://iptc.org/std/Iptc4xmpExt/2008-02-29/PersonInImage");
  }
}

export function generateMetadata(raw: RawMetadata, mimetype: string): Metadata {
  let resolver = new MetaDataResolver(raw);

  let metadata: Metadata = {
    mimetype,
    orientation: resolver.getExifNumber("Orientation") || Orientation.Normal,
    tags: choose(resolver.tags()) || [],
    people: choose(resolver.people()) || [],
    raw,
  };

  let created = choose(resolver.created());
  if (created) {
    metadata.created = created;
  }

  if (raw.thumbnailData) {
    metadata.thumbnail = raw.thumbnailData;
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

  return metadata;
}
