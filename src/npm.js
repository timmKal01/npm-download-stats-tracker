const BASE_URL = 'https://api.npmjs.org/downloads/point';
const REQUEST_TIMEOUT_MS = 30_000;

function toDateOnly(date) {
    return date.toISOString().slice(0, 10);
}

/** npm's bulk endpoint returns a flat {downloads,...} object for exactly one package,
 *  but {pkgName: {downloads,...}, ...} for two or more. Normalize to the latter shape. */
function normalizeResponse(body, packages) {
    if (packages.length === 1) return { [packages[0]]: body };
    return body;
}

/** The registry API is occasionally slow or 429s/5xxs under load — retry with backoff rather
 *  than ever treating a throttle or timeout as "no data." */
async function fetchWithRetry(url, { retries = 4, baseDelayMs = 1500 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await fetch(url, { headers: { Connection: 'close' }, signal: controller.signal });
            if (res.ok) return res;
            if (![429, 500, 502, 503, 504].includes(res.status)) {
                throw new Error(`npm downloads API request failed: ${res.status} ${res.statusText}`);
            }
            lastErr = new Error(`npm downloads API returned ${res.status}`);
        } catch (err) {
            lastErr = err.name === 'AbortError' ? new Error('npm downloads API request timed out') : err;
        } finally {
            clearTimeout(timeout);
        }
        if (attempt < retries) {
            await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
        }
    }
    throw lastErr;
}

async function fetchDownloads(packages, startDate, endDate) {
    const period = `${toDateOnly(startDate)}:${toDateOnly(endDate)}`;
    const url = `${BASE_URL}/${period}/${packages.map(encodeURIComponent).join(',')}`;

    const res = await fetchWithRetry(url);
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
        try {
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
        } catch (err) {
            return { package: pkg, error: err.message };
        }
    });
}
