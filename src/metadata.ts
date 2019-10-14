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

export interface Metadata {
  [ExifMetadataType.Image]: ExifData;
  [ExifMetadataType.Gps]: ExifData;
  [ExifMetadataType.Interoperability]: ExifData;
  [ExifMetadataType.Exif]: ExifData;
  xmp: XmpData;
}

export function newMetadata(): Metadata {
  return {
    [ExifMetadataType.Image]: {},
    [ExifMetadataType.Gps]: {},
    [ExifMetadataType.Interoperability]: {},
    [ExifMetadataType.Exif]: {},
    xmp: {},
  };
}
