# media-metadata
[![Build Status](https://travis-ci.org/FractalBrew/media-metadata.svg?branch=master)](https://travis-ci.org/FractalBrew/media-metadata)

A pure JS library to parse EXIF and IPTC metadata out of media files. Currently
only JPEG images are supported but I hope to improve on that in the future.

A few other similar projects exist but this one aims to be usable both in node
and (when bundled with something like webpack) in a webpage.

## Examples

Basic usage is to just pass an [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer)
to the parseBuffer function:

```javascript
const { parseBuffer } = require("media-metadata");

let buffer = ... // an ArrayBuffer of image data
let metadata = parseBuffer(buffer);
```

In a webpage you can get an appropriate buffer with a [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API):

```javascript
const { parseBuffer } = require("media-metadata");

let response = await fetch(url);
let buffer = response.arrayBuffer();
let metadata = parseBuffer(buffer);
```

Or from a [File](https://developer.mozilla.org/en-US/docs/Web/API/File):

```javascript
const { parseBuffer } = require("media-metadata");

let file = ... // a File instance
let reader = new FileReader();
reader.onload = (event) => {
  let buffer = event.target.result;
  let metadata = parseBuffer(buffer);
};
reader.readAsArrayBuffer(file);
```

## Metadata format

The metadata is returned as a JS object with sections for each source of
metadata and date inside those. Something like this:

```javascript
{
  "exif": {
    "ImageDescription": "The description"
  },
  "xmp": {
    "http://purl.org/dc/elements/1.1/description": [
      "The description"
    ],
  }
}
```

A fuller example can be seen in the [tests](https://github.com/FractalBrew/media-metadata/blob/master/test/data/iptc.json).

Dates etc. are not decoded by this module, it is up to you to decode the actual
values when needed.
