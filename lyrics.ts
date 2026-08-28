import type { LyricLine } from "./types";

const LRCLIB_URL = "https://lrclib.net/api";
const LYRICSIFY_URL = "https://www.lyricsify.com";
const cache = new Map<string, LyricLine[] | null>();

let networkAccess: "unknown" | "allowed" | "blocked" = "unknown";
let lyricsifyNetworkAccess: "unknown" | "allowed" | "blocked" = "unknown";
let permissionRequested = false;
let lyricsifyPermissionRequested = false;
let blockedWarned = false;
let debugEnabled = false;

type NetworkAccessState = "unknown" | "allowed" | "blocked";

function debugLog(message: string, extra?: unknown) {
  if (!debugEnabled) return;
  if (extra === undefined) {
    console.info(`[SpotifyLyricsToDiscordStatus] ${message}`);
    return;
  }
  console.info(`[SpotifyLyricsToDiscordStatus] ${message}`, extra);
}

export function setLyricsDebugMode(enabled: boolean) {
  debugEnabled = enabled;
}

export function clearLyricsCache(trackId?: string) {
  if (trackId) {
    cache.delete(trackId);
    debugLog(`Cleared lyrics cache for track ${trackId}`);
    return;
  }
  cache.clear();
  debugLog("Cleared full lyrics cache");
}

function setNetworkAccess(state: NetworkAccessState) {
  networkAccess = state;
}

function setLyricsifyNetworkAccess(state: NetworkAccessState) {
  lyricsifyNetworkAccess = state;
}

function cacheAndReturn(trackId: string, value: LyricLine[] | null) {
  cache.set(trackId, value);
  return value;
}

export async function initLyricsNetworkAccess() {
  if (networkAccess === "unknown") {
    const url = "https://lrclib.net";
    const directives = ["connect-src"];
    const allowed = await VencordNative.csp.isDomainAllowed(url, directives).catch(() => false);
    if (allowed) {
      setNetworkAccess("allowed");
    } else {
      if (!permissionRequested) {
        permissionRequested = true;
        const result = await VencordNative.csp.requestAddOverride(url, directives, "SpotifyLyricsToDiscordStatus").catch(() => "cancelled");
        if (result === "ok") {
          console.info("[SpotifyLyricsToDiscordStatus] CSP permission granted for lrclib.net. Please fully restart Discord to apply it.");
        }
      }
      setNetworkAccess("blocked");
    }
  }

  if (lyricsifyNetworkAccess === "unknown") {
    const url = "https://www.lyricsify.com";
    const directives = ["connect-src"];
    const allowed = await VencordNative.csp.isDomainAllowed(url, directives).catch(() => false);
    if (allowed) {
      setLyricsifyNetworkAccess("allowed");
    } else {
      if (!lyricsifyPermissionRequested) {
        lyricsifyPermissionRequested = true;
        const result = await VencordNative.csp.requestAddOverride(url, directives, "SpotifyLyricsToDiscordStatus").catch(() => "cancelled");
        if (result === "ok") {
          console.info("[SpotifyLyricsToDiscordStatus] CSP permission granted for lyricsify.com. Please fully restart Discord to apply it.");
        }
      }
      setLyricsifyNetworkAccess("blocked");
    }
  }
}

function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)$/;

  for (const rawLine of lrc.split("\n")) {
    const match = rawLine.trim().match(regex);
    if (!match) continue;

    const [, mm, ss, cs, text] = match;
    const ms =
      parseInt(mm, 10) * 60_000 +
      parseInt(ss, 10) * 1_000 +
      (cs.length === 3 ? parseInt(cs, 10) : parseInt(cs, 10) * 10);

    lines.push({ timeMs: ms, text: text.trim() });
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchLyricsify(trackName: string, artistName: string): Promise<string | null> {
  if (lyricsifyNetworkAccess === "blocked") {
    debugLog("Lyricsify skipped: CSP blocked");
    return null;
  }

  const directUrl = `${LYRICSIFY_URL}/lyrics/${slugify(artistName)}/${slugify(trackName)}`;
  debugLog("Lyricsify: trying direct URL", { directUrl });

  try {
    const directRes = await fetch(directUrl, {
      headers: { "User-Agent": "SpotifyLyricsToDiscordStatus/1.0" },
    });

    if (directRes.ok) {
      const html = await directRes.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const entry = doc.querySelector("#entry");

      if (entry) {
        const text = entry.textContent || "";
        const lines = text
          .split("\n")
          .map(l => l.trim())
          .filter(l => /^\[\d{2}:\d{2}\.\d{2,3}\]/.test(l));

        if (lines.length) {
          debugLog("Lyricsify: direct URL succeeded", { lines: lines.length });
          return lines.join("\n");
        }
      }
    } else {
      debugLog("Lyricsify: direct URL failed", { status: directRes.status, statusText: directRes.statusText });
    }
  } catch (err) {
    debugLog("Lyricsify: direct URL error", err);
  }

  debugLog("Lyricsify: falling back to search");
  try {
    const query = encodeURIComponent(`${artistName} ${trackName}`);
    const searchRes = await fetch(`${LYRICSIFY_URL}/search?q=${query}`, {
      headers: { "User-Agent": "SpotifyLyricsToDiscordStatus/1.0" },
    });

    if (!searchRes.ok) {
      debugLog("Lyricsify: search request failed", { status: searchRes.status });
      return null;
    }

    const searchHtml = await searchRes.text();
    const parser = new DOMParser();
    const searchDoc = parser.parseFromString(searchHtml, "text/html");

    const resultLinks = searchDoc.querySelectorAll(
      ".li a[href], .search-results a[href], a[href^='/lyrics/']"
    );

    let bestPath: string | null = null;
    const tNorm = trackName.toLowerCase();
    const aNorm = artistName.toLowerCase();

    for (const link of resultLinks) {
      const href = link.getAttribute("href");
      const text = (link.textContent || "").toLowerCase();
      if (!href || !href.startsWith("/lyrics/")) continue;

      const hasTrack = text.includes(tNorm) || href.includes(slugify(trackName));
      const hasArtist = text.includes(aNorm) || href.includes(slugify(artistName));
      if (hasTrack && hasArtist) {
        bestPath = href;
        break;
      }
    }

    if (!bestPath) {
      debugLog("Lyricsify: no matching search result", { trackName, artistName });
      return null;
    }

    debugLog("Lyricsify: following search result", { path: bestPath });
    const lyricsRes = await fetch(`${LYRICSIFY_URL}${bestPath}`, {
      headers: { "User-Agent": "SpotifyLyricsToDiscordStatus/1.0" },
    });

    if (!lyricsRes.ok) {
      debugLog("Lyricsify: lyrics page failed", { status: lyricsRes.status });
      return null;
    }

    const lyricsHtml = await lyricsRes.text();
    const lyricsDoc = parser.parseFromString(lyricsHtml, "text/html");
    const entry = lyricsDoc.querySelector("#entry");

    if (!entry) {
      debugLog("Lyricsify: no #entry div found on lyrics page");
      return null;
    }

    const text = entry.textContent || "";
    const lines = text
      .split("\n")
      .map(l => l.trim())
      .filter(l => /^\[\d{2}:\d{2}\.\d{2,3}\]/.test(l));

    if (!lines.length) {
      debugLog("Lyricsify: no LRC lines found in #entry");
      return null;
    }

    debugLog("Lyricsify: search fallback succeeded", { lines: lines.length });
    return lines.join("\n");
  } catch (err) {
    debugLog("Lyricsify: search fallback error", err);
    return null;
  }
}

async function searchLrclib(trackName: string, artistName: string): Promise<string | null> {
  if (networkAccess !== "allowed") return null;

  try {
    const params = new URLSearchParams({
      q: `${trackName} ${artistName}`,
    });

    const res = await fetch(`${LRCLIB_URL}/search?${params}`);
    if (!res.ok) {
      debugLog("LRCLIB search HTTP error", { status: res.status });
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      debugLog("LRCLIB search: no results");
      return null;
    }

    for (const item of data) {
      if (item?.syncedLyrics) {
        debugLog("LRCLIB search: found match", { id: item.id, name: item.name });
        return item.syncedLyrics as string;
      }
    }

    debugLog("LRCLIB search: results exist but none have synced lyrics");
    return null;
  } catch (err) {
    debugLog("LRCLIB search error", err);
    return null;
  }
}

export async function getLyrics(
  trackId: string,
  trackName: string,
  artistName: string,
  albumName = "",
  durationMs = 0,
  forceRefresh = false,
  useLyricsifyFallback = true,
): Promise<LyricLine[] | null> {
  if (forceRefresh) {
    cache.delete(trackId);
    debugLog(`Force refresh lyrics for ${trackName} - ${artistName}`);
  }

  if (cache.has(trackId)) return cache.get(trackId) ?? null;

  if (networkAccess === "unknown" || lyricsifyNetworkAccess === "unknown") {
    await initLyricsNetworkAccess();
  }

  if (networkAccess !== "allowed" && lyricsifyNetworkAccess !== "allowed") {
    if (!blockedWarned) {
      blockedWarned = true;
      console.warn("[SpotifyLyricsToDiscordStatus] Both LRCLIB and Lyricsify are blocked by CSP. Grant permission prompts and fully restart Discord.");
    }
    cacheAndReturn(trackId, null);
    debugLog("Lyrics fetch blocked by CSP", { trackId, trackName, artistName });
    return null;
  }

  let lrcText: string | null = null;
  let source: "lrclib-get" | "lrclib-search" | "lyricsify" | null = null;

  if (networkAccess === "allowed") {
    try {
      const params = new URLSearchParams({
        track_name: trackName,
        artist_name: artistName,
      });
      if (albumName) params.set("album_name", albumName);
      if (durationMs > 0) params.set("duration", Math.round(durationMs / 1000).toString());

      const res = await fetch(`${LRCLIB_URL}/get?${params}`);

      if (res.status === 404) {
        debugLog("LRCLIB /api/get 404", { trackId, trackName, artistName });
      } else if (res.ok) {
        const data = await res.json();
        if (data?.syncedLyrics) {
          lrcText = data.syncedLyrics;
          source = "lrclib-get";
        }
      } else {
        debugLog(`LRCLIB /api/get HTTP ${res.status}`, { trackId, trackName, artistName });
      }
    } catch (err) {
      debugLog("LRCLIB /api/get error", err);
    }
  }

  if (!lrcText && networkAccess === "allowed") {
    debugLog("LRCLIB: trying broader /api/search");
    lrcText = await searchLrclib(trackName, artistName);
    if (lrcText) source = "lrclib-search";
  }

  if (!lrcText && useLyricsifyFallback && lyricsifyNetworkAccess === "allowed") {
    debugLog("Lyricsify: attempting fallback");
    lrcText = await fetchLyricsify(trackName, artistName);
    if (lrcText) source = "lyricsify";
  }

  if (!lrcText) {
    cacheAndReturn(trackId, null);
    debugLog("No lyrics found from any source", { trackId, trackName, artistName });
    return null;
  }

  const lines = parseLrc(lrcText);
  cacheAndReturn(trackId, lines);
  debugLog("Lyrics loaded", { trackId, source, lines: lines.length });
  return lines;
}