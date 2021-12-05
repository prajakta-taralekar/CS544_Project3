import fs from 'fs';
import Path from 'path';
import util from 'util';

const { promisify } = util;

import { AppErrors} from 'cs544-js-utils';

export async function readJson(path, errors = new AppErrors()) {
  let text;
  try {
    text = await promisify(fs.readFile)(path, 'utf8');
  }
  catch (err) {
    return errors.add(`unable to read ${path}: ${err}`);
  }
  try {
    if (path.endsWith('.jsonl')) {
      text = '[' + text.trim().replace(/\n/g, ',') + ']';
    }
    return JSON.parse(text);
  }
  catch (err) {
    return errors.add(`unable to parse JSON from ${path}: ${err}`);
  }
}

export function cwdPath(path) {
  return (path.startsWith(Path.sep)) ? path : Path.join(process.cwd(), path);
}

export function scriptName() {
  return Path.basename(process.argv[1]);
}
