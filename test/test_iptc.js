const path = require("path");
const fs = require("fs");
const expect = require("expect");

const { parseBuffer } = require("..");

const DATA_DIR = path.join(__dirname, "data");

describe("IPTC", () => {
  it("Should parse", () => {
    let file = path.join(DATA_DIR, "iptc.jpg");
    let buffer = fs.readFileSync(file).buffer;

    let metadata = parseBuffer(buffer);

    let expected = fs.readFileSync(path.join(DATA_DIR, "iptc.json"), { encoding: "utf-8" });
    expected = JSON.parse(expected);

    expect(metadata).toEqual(expected);
  });
});
