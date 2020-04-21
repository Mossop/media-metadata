import moment = require("moment");

import {
  ExifMetadataType,
  Orientation,
  RawMetadata,
  XmpType,
  Metadata,
  MP4TrackData,
} from "./types";

export type LinkedMetadataBlocks =
  ExifMetadataType.Gps |
  ExifMetadataType.Interoperability |
  ExifMetadataType.Exif;

export function rotateClockwise90(orientation: Orientation = Orientation.TopLeft): Orientation {
  switch (orientation) {
    case Orientation.TopLeft:
      return Orientation.RightTop;
    case Orientation.TopRight:
      return Orientation.RightBottom;
    case Orientation.BottomRight:
      return Orientation.LeftBottom;
    case Orientation.BottomLeft:
      return Orientation.LeftTop;
    case Orientation.LeftTop:
      return Orientation.TopRight;
    case Orientation.RightTop:
      return Orientation.BottomRight;
    case Orientation.RightBottom:
      return Orientation.BottomLeft;
    case Orientation.LeftBottom:
      return Orientation.TopLeft;
  }
}

export function rotateCounterClockwise90(orientation: Orientation = Orientation.TopLeft): Orientation {
  return rotateClockwise90(rotateClockwise90(rotateClockwise90(orientation)));
}

export function mirrorHorizontal(orientation: Orientation = Orientation.TopLeft): Orientation {
  switch (orientation) {
    case Orientation.TopLeft:
      return Orientation.TopRight;
    case Orientation.TopRight:
      return Orientation.TopLeft;
    case Orientation.BottomRight:
      return Orientation.BottomLeft;
    case Orientation.BottomLeft:
      return Orientation.BottomRight;
    case Orientation.LeftTop:
      return Orientation.RightTop;
    case Orientation.RightTop:
      return Orientation.LeftTop;
    case Orientation.RightBottom:
      return Orientation.LeftBottom;
    case Orientation.LeftBottom:
      return Orientation.RightBottom;
  }
}

export function mirrorVertical(orientation: Orientation = Orientation.TopLeft): Orientation {
  return rotateCounterClockwise90(mirrorHorizontal(rotateClockwise90(orientation)));
}

export function newRawMetadata(): RawMetadata {
  return {
    [ExifMetadataType.Image]: {},
    [ExifMetadataType.Gps]: {},
    [ExifMetadataType.Interoperability]: {},
    [ExifMetadataType.Exif]: {},
    [ExifMetadataType.Thumbnail]: {},
    mp4Data: {},
    xmp: {},
  };
}

const EXIF_DATE_FORMAT = "YYYY:MM:DD HH:mm:ss Z";

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
    let value = this.getXmpString(property);
    if (value) {
      return moment(value).utc().toISOString();
    }
    return undefined;
  }

  public getFirstXmpString(property: string): string | undefined {
    let value = this.getXmpStrings(property);
    if (value && value.length) {
      return value[0];
    }
    return undefined;
  }

  public getXmpStrings(property: string): string[] | undefined {
    let value = this.raw.xmp[property];
    if (Array.isArray(value)) {
      return value.filter(isString);
    }
    return undefined;
  }

  public getImageNumber(property: string): number | undefined {
    let value = this.raw.image[property];
    if (Array.isArray(value) && value.length === 1) {
      return value[0];
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
    let value = this.getExifString(property);
    if (value) {
      return moment(value + " Z", EXIF_DATE_FORMAT).toISOString();
    }
    return undefined;
  }

  public *title(): Iterable<string | undefined> {
    yield this.getFirstXmpString("http://purl.org/dc/elements/1.1/title");
  }

  public *description(): Iterable<string | undefined> {
    yield this.getFirstXmpString("http://purl.org/dc/elements/1.1/description");
    yield this.getExifString("ImageDescription");
  }

  public *created(): Iterable<string | undefined> {
    yield this.getXmpDate("http://ns.adobe.com/xap/1.0/CreateDate");
    yield this.getExifDate("DateTimeOriginal");
    yield this.getExifDate("CreateDate");
    yield this.raw.mp4Data.created;
  }

  public *modified(): Iterable<string | undefined> {
    yield this.getXmpDate("http://ns.adobe.com/xap/1.0/ModifyDate");
    yield this.getExifDate("ModifyDate");
    yield this.raw.mp4Data.modified;
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

  public *orientation(): Iterable<Orientation | undefined> {
    yield this.getImageNumber("Orientation");
    if (this.raw.mp4Data.tracks) {
      yield* this.raw.mp4Data.tracks.map((t: MP4TrackData) => t.orientation);
    }
    yield this.raw.mp4Data.orientation;
  }
}

function set<P extends keyof Metadata>(metadata: Metadata, prop: P, value: Metadata[P]): void {
  if (value !== undefined) {
    metadata[prop] = value;
  }
}

export function generateMetadata(raw: RawMetadata, mimetype: string): Metadata {
  let resolver = new MetaDataResolver(raw);

  let metadata: Metadata = {
    mimetype,
    tags: choose(resolver.tags()) || [],
    people: choose(resolver.people()) || [],
    raw,
  };

  set(metadata, "created", choose(resolver.created()));
  set(metadata, "modified", choose(resolver.modified()));
  set(metadata, "height", raw.height);
  set(metadata, "width", raw.width);
  set(metadata, "duration", raw.duration);
  set(metadata, "title", choose(resolver.title()));
  set(metadata, "description", choose(resolver.description()));
  set(metadata, "orientation", choose(resolver.orientation()));
  set(metadata, "thumbnail", raw.thumbnailData);

  if (raw.mp4Data.longitude !== undefined && raw.mp4Data.latitude !== undefined) {
    metadata.latitude = raw.mp4Data.latitude;
    metadata.longitude = raw.mp4Data.longitude;
  } else if (Array.isArray(raw.gps.GPSLatitude) &&
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
