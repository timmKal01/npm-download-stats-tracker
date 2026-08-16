const BASE_URL = 'https://api.npmjs.org/downloads/point';

function toDateOnly(date) {
    return date.toISOString().slice(0, 10);
}

/** npm's bulk endpoint returns a flat {downloads,...} object for exactly one package,
 *  but {pkgName: {downloads,...}, ...} for two or more. Normalize to the latter shape. */
function normalizeResponse(body, packages) {
    if (packages.length === 1) return { [packages[0]]: body };
    return body;
}

async function fetchDownloads(packages, startDate, endDate) {
    const period = `${toDateOnly(startDate)}:${toDateOnly(endDate)}`;
    const url = `${BASE_URL}/${period}/${packages.map(encodeURIComponent).join(',')}`;

    const res = await fetch(url, { headers: { Connection: 'close' } });
    if (!res.ok) {
        throw new Error(`npm downloads API request failed: ${res.status} ${res.statusText}`);
    }
    const body = await res.json();
    return normalizeResponse(body, packages);
}

export async function fetchDownloadStats({ packages, daysBack }) {
    const currentEnd = new Date();
    const currentStart = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const previousEnd = new Date(currentStart.getTime() - 24 * 60 * 60 * 1000);
    const previousStart = new Date(previousEnd.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const [current, previous] = await Promise.all([
        fetchDownloads(packages, currentStart, currentEnd),
        fetchDownloads(packages, previousStart, previousEnd),
    ]);

    return packages.map((pkg) => {
        const curr = current[pkg];
        const prev = previous[pkg];
        // npm returns an error object per-package (not a top-level failure) for unknown/unpublished packages.
        const currentDownloads = curr?.downloads ?? null;
        const previousDownloads = prev?.downloads ?? null;
        const percentChange =
            currentDownloads !== null && previousDownloads
                ? Number((((currentDownloads - previousDownloads) / previousDownloads) * 100).toFixed(2))
                : null;

        return {
            package: pkg,
            currentPeriodDownloads: currentDownloads,
            currentPeriodStart: curr?.start ?? toDateOnly(currentStart),
            currentPeriodEnd: curr?.end ?? toDateOnly(currentEnd),
            previousPeriodDownloads: previousDownloads,
            previousPeriodStart: prev?.start ?? toDateOnly(previousStart),
            previousPeriodEnd: prev?.end ?? toDateOnly(previousEnd),
            percentChange,
        };
    });
}
