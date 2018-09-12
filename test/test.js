const path = require("path");
const fs = require("fs");
const expect = require("expect");

const { parseBuffer } = require("..");

const DATA_DIR = path.join(__dirname, "data");

function verifyData(basename) {
  let file = path.join(DATA_DIR, `${basename}.jpg`);
  let buffer = fs.readFileSync(file).buffer;

  let metadata = parseBuffer(buffer);

  let expected = fs.readFileSync(path.join(DATA_DIR, `${basename}.json`), { encoding: `utf-8` });
  expected = JSON.parse(expected);

  expect(metadata).toEqual(expected);
}

describe("Test files", () => {
  it("iptc reference", () => {
    verifyData("iptc");
  });

  it("lightroom reference", () => {
    verifyData("lightroom");
  });
});
