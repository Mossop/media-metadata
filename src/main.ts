import fs from "fs";

import { parseBuffer } from ".";

async function read(path: string): Promise<void> {
  let buffer = fs.readFileSync(path);
  console.log(JSON.stringify(await parseBuffer(buffer.buffer), undefined, 2));
}

read(process.argv[2]);
