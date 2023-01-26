#!/usr/bin/node
import http from 'node:http';
import os from 'node:os';
import path from 'node:path'
import timer from 'node:timers/promises';
import fss, {promises as fs} from 'node:fs'
import {XMLParser} from 'fast-xml-parser';

const parse = data => new XMLParser({isArray: name => name === 'images'}).parse(data);

const arg = name => process.argv.slice(1)[process.argv.indexOf(name)] ?? null;

let image = Number(arg('--image')) ?? 0;
let interval = Math.max(1, Number(arg('--refresh') ?? '3600')) * 1000;

console.log('Image:', image, ', Refresh:', interval);

const url = `http://www.bing.com/HPImageArchive.aspx?idx=${image}&n=1`;

/**
 * @param url
 * @returns {Promise<Buffer[]>}
 */
const get = url => new Promise((ok, err) => http.get(url, res => collect(res).then(data => ok(data))).on('error', error => err(error)));
const collect = async function (iterator) {
    const data = []

    for await (const i of iterator)
        data.push(i);

    return data;
};

const tmp = 		'/var/cache/wallpaper/.cache.jpg';
const final = 		'/var/cache/wallpaper/wallaper.jpg';
const final_link = 	'/var/cache/wallpaper/wallaper2.jpg';
const description = '/var/cache/wallpaper/description';

export async function* setInterval(interval) {
    yield;
    for await (const i of timer.setInterval(interval))
        yield;
}

for await (const i of setInterval(interval)) {
    const img = parse(Buffer.concat(await get(url)).toString()).images[0].image;

    const download = await new Promise((next, fail) => http.get(`http://www.bing.com${img.url}`, res => next(res)).on('error', err => fail(err)))
    	.catch(err => null);

    if (!download)
    	continue;

	await new Promise(function (next) {
		const dest = fss.createWriteStream(tmp);
		
		download.pipe(dest);
		download.once('end', function() {
			fss.createReadStream(tmp)
				.once('close', () => next())
				.pipe(fss.createWriteStream(final));
		});
		
	});

    // download.pipe(fss.createWriteStream(tmp).once('end', () => fss.createReadStream(tmp).pipe(fss.createWriteStream(final))));

    await fs.writeFile(description, img.copyright);
}
