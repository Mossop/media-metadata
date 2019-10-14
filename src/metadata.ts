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
  mimetype?: string;
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
