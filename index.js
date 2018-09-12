const fileType = require("file-type");
const { parseJpegData } = require("./jpeg");

exports.parseBuffer = function(buffer) {
  let type = fileType(buffer);
  if (!type) {
    throw new Error("Unknown file type.");
  }

  let metadata = {};

  switch (type.mime) {
    case "image/jpeg":
      parseJpegData(new DataView(buffer), metadata);
      break;
    default:
      throw new Error(`Unsupported file type "${type.mime}".`);
  }

  return metadata;
}
