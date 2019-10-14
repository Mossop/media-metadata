const path = require("path");
const { promises: fs } = require("fs");
const expect = require("expect");

const { parseBuffer } = require("../lib");

const DATA_DIR = path.join(__dirname, "data");

async function verifyData(basename) {
  let file = path.join(DATA_DIR, `${basename}.jpg`);
  let buffer = await fs.readFile(file);

  let metadata = await parseBuffer(buffer.buffer);
  let expected = await fs.readFile(path.join(DATA_DIR, `${basename}.json`), { encoding: `utf-8` });
  expected = JSON.parse(expected);
  delete metadata.thumbnail;

  expect(metadata).toEqual(expected);
}

describe("Test files", () => {
  it("iptc reference", async () => {
    await verifyData("iptc");
  });

  it("lightroom reference", async () => {
    await verifyData("lightroom");
  });
});
