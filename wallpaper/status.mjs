import cp from 'node:child_process';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';

const isRunning = await new Promise(ok => cp.spawn(`systemctl`, ['status', '--user', 'wallpaper.service']).once('exit', code => ok(code === 0)));
const description = await fs.promises.readFile('/var/cache/wallpaper/description', 'utf8')
	.then(res => res.replaceAll(/\([^)(]*(?:\([^)(]*(?:\([^)(]*(?:\([^)(]*\)[^)(]*)*\)[^)(]*)*\)[^)(]*)*\)/g, '').trim());

if (isRunning)
	console.log(description);
else
	console.log(`⛔ ${description}`);
