/**
 * Renewal scheduling utilities
 *
 * Supports N configurable blackout windows via RENEWAL_BLACKOUT_WINDOWS env var.
 * Format: comma-separated "START-END" pairs (hours 0-23, inclusive start, exclusive end).
 *
 * Example: RENEWAL_BLACKOUT_WINDOWS=7-20,22-23
 *   → no renewals from 07:00 to 20:00 (office hours)
 *   → no renewals from 22:00 to 23:00
 *
 * Cross-midnight windows are supported: e.g. 22-6 = 22:00 to 06:00.
 *
 * Backward compatibility: if RENEWAL_BLACKOUT_WINDOWS is not set, falls back to
 * RENEWAL_BLACKOUT_START + RENEWAL_BLACKOUT_END (single window, deprecated).
 */

export interface BlackoutWindow {
    start: number; // hour (0-23), inclusive
    end: number;   // hour (0-23), exclusive
}

/**
 * Parse RENEWAL_BLACKOUT_WINDOWS env var.
 * Falls back to legacy RENEWAL_BLACKOUT_START / RENEWAL_BLACKOUT_END if not set.
 */
export function getBlackoutWindows(): BlackoutWindow[] {
    const raw = process.env.RENEWAL_BLACKOUT_WINDOWS;
    if (raw) {
        return raw
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .map(range => {
                const parts = range.split('-').map(Number);
                return { start: parts[0], end: parts[1] };
            })
            .filter(w =>
                !isNaN(w.start) && !isNaN(w.end) &&
                w.start !== w.end &&
                w.start >= 0 && w.start <= 23 &&
                w.end >= 0 && w.end <= 23
            );
    }

    // Backward compatibility
    const start = parseInt(process.env.RENEWAL_BLACKOUT_START ?? '', 10);
    const end = parseInt(process.env.RENEWAL_BLACKOUT_END ?? '', 10);
    if (!isNaN(start) && !isNaN(end) && start !== end) {
        return [{ start, end }];
    }

    return [];
}

/**
 * Convert blackout windows (hours) to flat minute-based intervals [startMin, endMin).
 * Cross-midnight windows are split into two non-wrapping intervals.
 */
function toMinuteIntervals(windows: BlackoutWindow[]): Array<[number, number]> {
    const intervals: Array<[number, number]> = [];
    for (const w of windows) {
        const s = w.start * 60;
        const e = w.end * 60;
        if (s < e) {
            intervals.push([s, e]);
        } else {
            // Cross-midnight: split into [s, 1440) and [0, e)
            intervals.push([s, 1440]);
            if (e > 0) intervals.push([0, e]);
        }
    }
    return intervals;
}

/**
 * Merge overlapping / adjacent intervals (sorted by start).
 */
function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
    if (intervals.length === 0) return [];
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [[...intervals[0]]];
    for (let i = 1; i < intervals.length; i++) {
        const last = merged[merged.length - 1];
        if (intervals[i][0] <= last[1]) {
            last[1] = Math.max(last[1], intervals[i][1]);
        } else {
            merged.push([...intervals[i]]);
        }
    }
    return merged;
}

/**
 * Return the safe (non-blackout) intervals within [0, 1440).
 */
function safeIntervals(windows: BlackoutWindow[]): Array<[number, number]> {
    if (windows.length === 0) return [[0, 1440]];

    const blocked = mergeIntervals(toMinuteIntervals(windows));
    const safe: Array<[number, number]> = [];
    let cursor = 0;
    for (const [s, e] of blocked) {
        if (cursor < s) safe.push([cursor, s]);
        cursor = e;
    }
    if (cursor < 1440) safe.push([cursor, 1440]);
    return safe;
}

/**
 * Pick a uniformly random minute from a set of safe intervals.
 */
function randomMinuteFrom(intervals: Array<[number, number]>): number {
    const total = intervals.reduce((acc, [s, e]) => acc + (e - s), 0);
    if (total === 0) return 0;

    let rand = Math.floor(Math.random() * total);
    for (const [s, e] of intervals) {
        const len = e - s;
        if (rand < len) return s + rand;
        rand -= len;
    }
    return intervals[0][0];
}

/**
 * If `date` falls inside any blackout window, move it to a random safe time.
 * Returns the (possibly adjusted) date.
 */
export function applyBlackoutWindows(date: Date, windows: BlackoutWindow[]): Date {
    if (windows.length === 0) return date;

    const blocked = mergeIntervals(toMinuteIntervals(windows));
    const timeMinutes = date.getHours() * 60 + date.getMinutes();
    const isBlocked = blocked.some(([s, e]) => timeMinutes >= s && timeMinutes < e);
    if (!isBlocked) return date;

    const safe = safeIntervals(windows);
    const newMinutes = randomMinuteFrom(safe);

    const adjusted = new Date(date);
    adjusted.setHours(Math.floor(newMinutes / 60), newMinutes % 60, 0, 0);
    return adjusted;
}

/**
 * Generate a random renewal time outside all blackout windows.
 * Falls back to early-morning (00:00–07:00) if no blackout is configured.
 */
export function randomRenewalTime(windows: BlackoutWindow[]): { hours: number; minutes: number } {
    let safe: Array<[number, number]>;

    if (windows.length === 0) {
        // No blackout — prefer night hours (00:00–07:00)
        safe = [[0, 7 * 60]];
    } else {
        safe = safeIntervals(windows);
    }

    const newMinutes = randomMinuteFrom(safe);
    return { hours: Math.floor(newMinutes / 60), minutes: newMinutes % 60 };
}
