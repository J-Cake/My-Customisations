#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run --allow-net --allow-sys --unstable

import { type WalkEntry } from 'https://deno.land/std/fs/walk.ts';
import * as fs from 'https://deno.land/std/fs/mod.ts';
import * as arg from 'https://deno.land/std/flags/mod.ts';
import { mergeReadableStreams } from "https://deno.land/std@0.173.0/streams/merge_readable_streams.ts";
import { readableStreamFromIterable } from "https://deno.land/std@0.173.0/streams/readable_stream_from_iterable.ts";
import { TextLineStream } from "https://deno.land/std@0.164.0/streams/mod.ts";
import * as nfs from "https://deno.land/std@0.173.0/node/fs.ts";
import * as nnet from "https://deno.land/std@0.173.0/node/net.ts";

import { JSONParser }  from 'npm:@streamparser/json-whatwg';
import { Iter, iter } from 'npm:@j-cake/jcake-utils/iter';

const args = arg.parse(Deno.args);

export const searchDirs = Deno.env.get("PATH").split(':');

export async function* walk(path: string): AsyncGenerator<WalkEntry> {
    for await (const entry of Deno.readDir(path)) {
        yield {
            ...entry,
            path: `${path}/${entry.name}`
        };

        if (entry.isDirectory)
            yield* walk(`${path}/${entry.name}`);
    }
}

export async function* locate(executableName: string[], search: string[] = searchDirs): AsyncGenerator<string> {
    for await (const path of Iter(search)
        .filter(i => i)
        .map(async path => [await fs.exists(path), path])
        .await()
        .filter(i => i[0])
        .map(i => i[1]))
        yield* Iter(walk(path))
            .filter(dir => executableName.includes(dir.name))
}

const last = async function<T>(iter: AsyncIterator<T>): Promise<T> {
    let last: T;

    for await (const i of iter)
        last = i;

    return last;
}

const parser = new JSONParser();

const configFile = (await Iter(locate(["theme.json"], [Deno.cwd(), `${Deno.env.get("HOME")}/.config`]))
    .collect())
    .shift()
    .path;

const config = await Deno.open(configFile, {read: true})
    .then(file => file.readable)
    .then(stream => stream.pipeThrough(parser))
    .then(stream => last(stream))
    .then(res => res.value);

const plasmaThemeSwitcher = (await Iter(locate([config.switcher ?? 'plasma-theme']))
    .collect())
    .shift()
    ?.path;

const switchTime = config.switch?.match(/^((?:[01][0-9]|2[0-3]):(?:[0-5][0-9]))-((?:[01][0-9]|2[0-3]):(?:[0-5][0-9]))$/);

// TODO: Pipe through line prefixer
export const setLight = async () => {
    console.log('Setting Light');
    const { stdout, stderr } = new Deno.Command(plasmaThemeSwitcher, {
        args: ['-w', 'kvantum', '-c', config.light],
        stdout: 'piped',
        stderr: 'piped'
    }).spawn();

    const out = mergeReadableStreams(stdout, stderr)
        .pipeThrough(new TextDecoderStream());

    console.log(await iter.collect(out)
        .then(res => res.join('')));
}

// TODO: Pipe through line prefixer
export const setDark = async () => {
    console.log('Setting Dark');
    const { stdout, stderr } = new Deno.Command(plasmaThemeSwitcher, {
        args: ['-w', 'kvantum-dark', '-c', config.dark],
        stdout: 'piped',
        stderr: 'piped'
    }).spawn();

    const out = mergeReadableStreams(stdout, stderr)
        .pipeThrough(new TextDecoderStream());

    console.log(await iter.collect(out)
        .then(res => res.join('')));
}

export const setAuto = async () => {
    const {morning, evening} = switchTime ? {morning: switchTime[1], evening: switchTime[2]} : await getSunTimes()
        .then(res => ({morning: res.sunrise, evening: res.sunset}));

    const now = new Date();

    if (now > morning)
        await setLight();
    else
        await setDark();
};

export function scheduleAt(time: Date, callback: () => void) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const roundToMinute = x => Math.floor(x / 60_000) * 60_000;

    let msToStart = roundToMinute(time.getTime()) % msPerDay - Date.now() % msPerDay;

    setTimeout(() => callback(), msToStart <= 0 ? msToStart + msPerDay : msToStart);
}

export const toDateString = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export async function getSunTimes(): Promise<{sunrise: Date, sunset: Date}> {
    if (!config.ipinfoToken)
        throw `Required API token for http://ipinfo.io`;

    try {
        const loc = await fetch(`https://ipinfo.io?token=${encodeURIComponent(config.ipinfoToken)}`)
            .then(res => res.json())
            .then(res => res.loc.split(','))
            .then(res => ({lat: res[0], long: res[1]}));

        const times = await fetch(`https://api.sunrise-sunset.org/json?date=${toDateString(new Date())}&lat=${loc.lat}&lng=${loc.long}&formatted=0`)
            .then(res => res.json())
            .then(res => ({sunrise: new Date(res.results.sunrise), sunset: new Date(res.results.sunset)}));

        const cache = await Deno.readTextFile(config.cache)
            .then(res => JSON.parse(res))
            .catch(() => ({}));
        await Deno.writeTextFile(config.cache, JSON.stringify({
            ...cache,
            sunrise: times.sunrise.toIsoString(),
            sunset: times.sunset.toIsoString(),
        }));

        return times;
    } catch (err) {
        return await Deno.readTextFile(config.cache)
            .then(res => JSON.parse(res))
            .then(res => ({
                sunrise: new Date(cache.sunrise ?? '7:00:00'),
                sunset: new Date(cache.sunset ?? '19:00:00'),
            }))
            .catch(() => ({
                sunrise: new Date('7:00:00'),
                sunset: new Date('19:00:00'),
            }));
    }
}

if (args.mode && ['light', 'dark', 'auto'].includes(args.mode))
    await ({
        dark: async () => await setDark(),
        light: async () => await setLight(),
        auto: async () => await setAuto()
    })?.[args.mode]();
else {
    if (switchTime) {
        const [,morning, evening] = switchTime.map(i => {
            const [hour,minute]=i.split(':');
            const d = new Date();
            d.setHours(Number(hour));
            d.setMinutes(Number(minute));
            d.setSeconds(0);
            d.setMilliseconds(0);
            return d;
        });

        console.log(`Switching themes at ${morning} and ${evening}`);

        scheduleAt(morning, () => setInterval(() => setLight(), 1000 * 60 * 60 * 24));
        scheduleAt(evening, () => setInterval(() => setDark(), 1000 * 60 * 60 * 24));
    } else
        scheduleAt(new Date('0:00:00'), () => setInterval(async () => {
            const sunTimes = await getSunTimes();

            console.log(`Fetched new Suntimes: ${sunTimes.sunrise}, ${sunTimes.sunset}`);

            scheduleAt(sunTimes.sunrise, () => setLight());
            scheduleAt(sunTimes.sunset, () => setDark());
        }, 1000 * 60 * 60 * 24));
}

const pipe = `/run/user/${Deno.uid()}/theme`;
await new Deno.Command('mkfifo', { args: [pipe] }).spawn();
// Deno doesn't have a clean way to create FIFOs

const cmdInput = await nfs.promises.open(pipe, nfs.constants.O_NONBLOCK | nfs.constants.O_RDWR)
    .then(fd => nfs.createReadStream('', { fd }))
    .then(stream => readableStreamFromIterable(stream));

console.log(`Listening for commands`);
// for await (const line of Deno.stdin.readable
for await (const line of mergeReadableStreams(Deno.stdin.readable, cmdInput)
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())) {

    if (line.trim() == 'auto')
        await setAuto();
    else if (line.trim() == 'light')
        await setLight();
    else if (line.trim() == 'dark')
        await setDark();
}
