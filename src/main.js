import { Actor, log } from 'apify';
import { fetchDownloadStats } from './npm.js';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const { packages, daysBack = 7 } = input;

if (!packages || packages.length === 0) {
    throw new Error('"packages" must contain at least one npm package name.');
}

/** Must match the event name configured in this Actor's pay-per-event pricing on Apify. */
const DOWNLOAD_STATS_EVENT = 'download-stats-check';

const stats = await fetchDownloadStats({ packages, daysBack });

for (const stat of stats) {
    await Actor.pushData(stat);
}

await Actor.charge({ eventName: DOWNLOAD_STATS_EVENT });

log.info(`Pushed download stats for ${stats.length} package(s)`);

await Actor.exit();
