export interface MP4TrackData {
  matrix: number[];
  width: number;
  height: number;
  created: string;
  modified: string;
  duration: number;
  orientation?: Orientation;
}

export type QTMetadata = {
  [key: string]: string;
};

export type XmpType = string | XmpData;

export interface XmpData {
  [key: string]: XmpType | XmpType[];
}

export interface MP4MovieData {
  matrix?: number[];
  created?: string;
  modified?: string;
  duration?: number;
  timescale?: number;
  longitude?: number;
  latitude?: number;
  orientation?: Orientation;
  tracks?: MP4TrackData[];
  qtMetadata?: QTMetadata;
}

export type ExifData = {
  [tag: string]: string | number[];
  [tag: number]: string | number[];
};

export enum ExifMetadataType {
  Image = "image",
  Gps = "gps",
  Interoperability = "interoperability",
  Exif = "exif",
  Thumbnail = "thumbnail",
}

export interface RawMetadata {
  duration?: number;
  height?: number;
  width?: number;
  [ExifMetadataType.Image]: ExifData;
  [ExifMetadataType.Gps]: ExifData;
  [ExifMetadataType.Interoperability]: ExifData;
  [ExifMetadataType.Exif]: ExifData;
  [ExifMetadataType.Thumbnail]: ExifData;
  mp4Data: MP4MovieData;
  thumbnailData?: ArrayBuffer;
  xmp: XmpData;
}

/**
 * Describes the orientation of the image with two sides. The first side is
 * the side represented by the zeroth row. The second side is the side
 * represented by the zeroth column.
 */
export enum Orientation {
  TopLeft = 1,
  TopRight = 2,
  BottomRight = 3,
  BottomLeft = 4,
  LeftTop = 5,
  RightTop = 6,
  RightBottom = 7,
  LeftBottom = 8,
}

export interface Metadata {
  mimetype: string;
  width?: number;
  height?: number;
  duration?: number;
  created?: string;
  modified?: string;
  title?: string;
  description?: string;

  tags: string[][];
  people: string[];
  longitude?: number;
  latitude?: number;
  orientation?: Orientation;

  thumbnail?: ArrayBuffer;

  raw: RawMetadata;
}
