import moment from "moment";

import { DataReader, Alignment } from "./datareader";
import { RawMetadata, newRawMetadata, MP4TrackData } from "./metadata";
import { MP4_TYPE, parseXmpData } from "./xmp";

/*function translate([p, q]: number[], [a, b, u, c, d, v, x, y, w]: number[]): [number, number] {
  let m = a * p + c * q + x;
  let n = b * p + d * q + y;
  let z = u * p + v * q + w;
  return [m / z, n / z];
}*/

const EPOCH = "1904-01-01T00:00:00Z";

const CONTAINER_TYPES = [
  "moov",
  "trak",
  "edts",
  "mdia",
  "minf",
  "stbl",
  "mvex",
  "moof",
  "traf",
  "mfra",
  "skip",
  "udta",
  "strk",
  "meta",
  "dinf",
  "ipro",
  "sinf",
  "fiin",
  "paen",
  "meco",
  "mere",
];

interface BoxHeader {
  size: number;
  type: string;
  length: number;
  nextBox: number;
}

interface BoxVersion {
  version: number;
  flags: number;
}

async function readBoxHeader(reader: DataReader, end: number = reader.length): Promise<BoxHeader> {
  let offset = reader.offset;
  let size = await reader.read32();
  let type = await reader.readChars(4);

  if (size === 1) {
    size = await reader.read64();
  }

  if (type === "uuid") {
    type = "{" +
      (await reader.read32()).toString(16) +
      "-" +
      (await reader.read16()).toString(16) +
      "-" +
      (await reader.read16()).toString(16) +
      "-" +
      (await reader.read16()).toString(16) +
      "-" +
      (await reader.read32()).toString(16) +
      (await reader.read16()).toString(16) +
      "}";
  }

  let nextBox = size === 0 ? end : offset + size;
  return {
    size,
    type,
    length: nextBox - reader.offset,
    nextBox,
  };
}

async function readBoxVersion(reader: DataReader): Promise<BoxVersion> {
  return {
    version: await reader.read8(),
    flags: ((await reader.read8()) << 16) + (await reader.read16()),
  };
}

export async function isMP4(reader: DataReader, count: number = 4): Promise<boolean> {
  if (count === 0) {
    return false;
  }

  reader.alignment = Alignment.BigEndian;

  let header = await readBoxHeader(reader);

  if (header.type !== "ftyp") {
    await reader.seek(header.nextBox);
    return await isMP4(reader, count - 1);
  }

  let brand = await reader.readChars(4);
  return brand === "mp41" || brand === "mp42";
}

async function parseTrackHeader(metadata: RawMetadata, reader: DataReader): Promise<void> {
  const TRACK_ENABLED = 0x1;
  const TRACK_IN_MOVIE = 0x2;

  let version = await readBoxVersion(reader);
  if (!(version.flags & TRACK_ENABLED && version.flags & TRACK_IN_MOVIE)) {
    return;
  }

  let created: number, modified: number, duration: number;
  if (version.version === 1) {
    created = await reader.read64();
    modified = await reader.read64();
    await reader.skip(8);
    duration = await reader.read64();
  } else if (version.version === 0) {
    created = await reader.read32();
    modified = await reader.read32();
    await reader.skip(8);
    duration = await reader.read32();
  } else {
    return;
  }

  await reader.skip(16);
  let matrix: number[] = [
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 30),
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 30),
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 30),
  ];

  let width = await reader.read32() / Math.pow(2, 16);
  let height = await reader.read32() / Math.pow(2, 16);

  let track: MP4TrackData = {
    width,
    height,
    matrix,
    created: moment(EPOCH).add(created, "seconds").toISOString(),
    modified: moment(EPOCH).add(modified, "seconds").toISOString(),
    duration,
  };

  if (metadata.mp4Data.tracks) {
    metadata.mp4Data.tracks.push(track);
  } else {
    metadata.mp4Data.tracks = [track];
  }
}

async function parseMovieHeader(metadata: RawMetadata, reader: DataReader): Promise<void> {
  let version = await readBoxVersion(reader);
  let created: number, modified: number, timescale: number, duration: number;
  if (version.version === 1) {
    created = await reader.read64();
    modified = await reader.read64();
    timescale = await reader.read32();
    duration = await reader.read64();
  } else if (version.version === 0) {
    created = await reader.read32();
    modified = await reader.read32();
    timescale = await reader.read32();
    duration = await reader.read32();
  } else {
    return;
  }

  metadata.mp4Data.created = moment(EPOCH).add(created, "seconds").toISOString();
  metadata.mp4Data.modified = moment(EPOCH).add(modified, "seconds").toISOString();
  metadata.mp4Data.duration = duration;
  metadata.mp4Data.timescale = timescale;
  metadata.duration = duration / timescale;

  await reader.skip(16);

  metadata.mp4Data.matrix = [
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 30),
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 30),
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 16),
    await reader.read32() / Math.pow(2, 30),
  ];
}

async function parseXYZBox(header: BoxHeader, metadata: RawMetadata, reader: DataReader): Promise<void> {
  const GPS_REGEX = /^([+-])(\d{2}|\d{4}|\d{6})(\.\d+)?([+-])(\d{3}|\d{5}|\d{7})(\.\d+)?.*\/$/;

  await readBoxVersion(reader);
  let gpsdata = await reader.readChars(header.length - 4);
  let matches = GPS_REGEX.exec(gpsdata);
  if (!matches) {
    console.warn(`Invalid GPS format: ${gpsdata}`);
    return;
  }

  let extra = 0;
  if (matches[3]) {
    extra = parseFloat(`0${matches[3]}`);
  }

  let degrees = 0;
  let minutes = 0;
  let seconds = 0;

  if (matches[2].length === 2) {
    degrees = parseInt(matches[2]) + extra;
  } else if (matches[2].length === 4) {
    degrees = parseInt(matches[2].substring(0, 2));
    minutes = parseInt(matches[2].substring(2)) + extra;
  } else if (matches[2].length === 6) {
    degrees = parseInt(matches[2].substring(0, 2));
    minutes = parseInt(matches[2].substring(2, 4));
    seconds = parseInt(matches[2].substring(4)) + extra;
  }

  degrees += minutes / 60;
  degrees += seconds / (60 * 60);
  if (matches[1] === "-") {
    degrees = -degrees;
  }

  metadata.mp4Data.latitude = degrees;

  extra = 0;
  if (matches[6]) {
    extra = parseFloat(`0${matches[3]}`);
  }

  degrees = 0;
  minutes = 0;
  seconds = 0;

  if (matches[5].length === 3) {
    degrees = parseInt(matches[5]) + extra;
  } else if (matches[5].length === 5) {
    degrees = parseInt(matches[5].substring(0, 3));
    minutes = parseInt(matches[5].substring(3)) + extra;
  } else if (matches[5].length === 7) {
    degrees = parseInt(matches[5].substring(0, 3));
    minutes = parseInt(matches[5].substring(3, 5));
    seconds = parseInt(matches[5].substring(5)) + extra;
  }

  degrees += minutes / 60;
  degrees += seconds / (60 * 60);
  if (matches[4] === "-") {
    degrees = -degrees;
  }

  metadata.mp4Data.longitude = degrees;
}

async function parseBoxes(metadata: RawMetadata, reader: DataReader, end: number = reader.length, parents: string[] = []): Promise<void> {
  while ((end - reader.offset) >= 8) {
    let header = await readBoxHeader(reader, end);
    let type = parents.slice(0);
    type.push(header.type);
    console.log(type);

    if (CONTAINER_TYPES.includes(header.type)) {
      await parseBoxes(metadata, reader, header.nextBox, type);
    } else {
      let path = type.join("/");
      if (path === "moov/mvhd") {
        await parseMovieHeader(metadata, reader);
      } else if (path === "moov/trak/tkhd") {
        await parseTrackHeader(metadata, reader);
      } else if (path === "moov/udta/©xyz") {
        await parseXYZBox(header, metadata, reader);
      } else if (header.type === MP4_TYPE) {
        await parseXmpData(reader, metadata, header.length);
      }
    }

    await reader.seek(header.nextBox);
  }
}

export async function parseMp4Data(reader: DataReader): Promise<RawMetadata> {
  reader.alignment = Alignment.BigEndian;
  let metadata = newRawMetadata();

  await parseBoxes(metadata, reader);
  return metadata;
}
