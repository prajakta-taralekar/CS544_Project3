#!/usr/bin/env node

import makeDao from './accounts-dao.mjs';
import makeServices from './accounts-services.mjs';
import makeWs from './accounts-ws.mjs';
import loadRandomData from './rand-data.mjs';


import { cwdPath, readJson } from 'cs544-node-utils';

import fs from 'fs';
import https from 'https';
import Path from 'path';


function usage() {
  const prog = Path.basename(process.argv[1]);
  const msg =
    `usage: ${prog} [-c] CONFIG.mjs [N_ACCOUNTS N_TRANSACTIONS_PER_ACCOUNT]`;
  console.error(msg);
  process.exit(1);
}

export default async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 4) usage();
  try {
    let doClear = false;
    if (args[0] === '-c') { doClear = true; args.shift(); }
    const configPath = cwdPath(args.shift());
    const config = (await import(configPath)).default;
    const { port = 1234, base } = config.ws;
    const doLoad = args.length > 0;
    doClear ||= doLoad;
    const dao = await makeDao(config.db.url, { doClear });
    const services = makeServices(dao);
    if (doLoad) {
      if (!args.every(a => a.match(/^\d+$/))) usage();
      const [nAccounts, nActsPerAccount] = [Number(args[0]), Number(args[1])];
      await loadRandomData(services, nAccounts, nActsPerAccount);
    }
    const app = makeWs(services, base);
    const serverOpts = {
      key: fs.readFileSync(config.https.keyPath),
      cert: fs.readFileSync(config.https.certPath),
    };
    https.createServer(serverOpts, app)
      .listen(config.ws.port, function() {
	console.log(`listening on port ${config.ws.port}`);
      });
  }
  catch (err) {
    console.error(`cannot create server: ${err}`);
    process.exit(1);
  }
}

function exitErrors(errors) {
  for (const err of errors) {
    console.error(err.message ?? err.toString());
  }
  process.exit(1);
}