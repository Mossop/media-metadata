const path = require("path");
const { promises: fs } = require("fs");
const expect = require("expect");

const { parseBuffer } = require("../lib");

const DATA_DIR = path.join(__dirname, "data");

async function verifyData(basename) {
  let file = path.join(DATA_DIR, `${basename}.jpg`);
  let buffer = await fs.readFile(file);

  let metadata = await parseBuffer(buffer.buffer);

  file = path.join(DATA_DIR, `${basename}-thumb.jpg`);

  let hasThumb;
  try {
    let stats = await fs.stat(file);
    hasThumb = stats.isFile();
  } catch (e) {
    hasThumb = false;
  }

  expect(!!metadata.thumbnail).toEqual(hasThumb);
  if (metadata.thumbnail && hasThumb) {
    let thumb = await fs.readFile(file);
    expect(thumb.compare(Buffer.from(metadata.thumbnail))).toEqual(0);
  }

  delete metadata.thumbnail;
  delete metadata.raw.thumbnailData;

  let expected = await fs.readFile(path.join(DATA_DIR, `${basename}.json`), { encoding: `utf-8` });
  expected = JSON.parse(expected);

  expect(metadata).toEqual(expected);
}

describe("Test files", () => {
  it("iptc reference", async () => {
    await verifyData("iptc");
  });

  it("hierarchical tags", async () => {
    await verifyData("hierarchy");
  });

  it("orentiation", async () => {
    await verifyData("orientation");
  });

  it("lightroom reference", async () => {
    await verifyData("lightroom");
  });

  it("chair", async () => {
    await verifyData("chair");
  });
});
