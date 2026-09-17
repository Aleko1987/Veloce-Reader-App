type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
};

type PlayerResponse = {
  playabilityStatus?: { status?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
};

type InnerTubeClient = {
  clientName: string;
  clientVersion: string;
  userAgent: string;
  clientId: string;
  extra?: Record<string, string>;
};

const PLAYER_URLS = [
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
  "https://youtubei.googleapis.com/youtubei/v1/player?key=AIzaSyB-63vPrdPVUKCJUH8DQ3rLa7gOJ1IUOsU",
];

const CLIENTS: InnerTubeClient[] = [
  {
    clientName: "IOS",
    clientVersion: "20.10.4",
    clientId: "5",
    userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
    extra: {
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      osName: "iPhone",
      osVersion: "18.3.2.22D82",
    },
  },
  {
    clientName: "ANDROID",
    clientVersion: "20.10.38",
    clientId: "3",
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
  },
  {
    clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    clientVersion: "2.0",
    clientId: "85",
    userAgent:
      "Mozilla/5.0 (ChromiumStylePlatform) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
  {
    clientName: "WEB_EMBEDDED_PLAYER",
    clientVersion: "1.20241201.00.00",
    clientId: "56",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function isYoutubeHost(hostname: string): boolean {
  return hostname === "youtube.com" || hostname.endsWith(".youtube.com");
}

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  return (
    tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode === "en") ??
    tracks.find((t) => t.languageCode?.startsWith("en")) ??
    tracks[0]
  );
}

function parseTranscriptXml(xml: string): string[] {
  const lines: string[] = [];
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  for (const match of xml.matchAll(pRegex)) {
    const inner = match[3];
    let text = "";
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    for (const sMatch of inner.matchAll(sRegex)) {
      text += sMatch[1];
    }
    if (!text) text = inner.replace(/<[^>]+>/g, "");
    text = decodeEntities(text).replace(/\s+/g, " ").trim();
    if (text) lines.push(text);
  }
  if (lines.length > 0) return lines;

  const classic = [...xml.matchAll(/<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g)];
  return classic
    .map((result) => decodeEntities(result[3]).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseTranscriptJson3(body: string): string[] | null {
  try {
    const json = JSON.parse(body) as {
      events?: { segs?: { utf8?: string }[] }[];
    };
    if (!Array.isArray(json.events)) return null;
    const lines: string[] = [];
    for (const event of json.events) {
      const text = (event.segs ?? [])
        .map((seg) => seg.utf8 ?? "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (text) lines.push(text);
    }
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}

function parseJsonObject(source: string, startIndex: number): unknown | null {
  let depth = 0;
  for (let i = startIndex; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(startIndex, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parseJsonArray(source: string, startIndex: number): unknown | null {
  let depth = 0;
  for (let i = startIndex; i < source.length; i++) {
    if (source[i] === "[") depth++;
    else if (source[i] === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(startIndex, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function tracksFromPlayer(data: PlayerResponse | null | undefined): CaptionTrack[] {
  return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}

function extractCaptionTracksFromHtml(html: string): CaptionTrack[] {
  const markers = ["ytInitialPlayerResponse = ", "var ytInitialPlayerResponse = "];
  for (const marker of markers) {
    const startIndex = html.indexOf(marker);
    if (startIndex === -1) continue;
    const parsed = parseJsonObject(html, startIndex + marker.length) as PlayerResponse | null;
    const tracks = tracksFromPlayer(parsed);
    if (tracks.length > 0) return tracks;
  }

  const captionMarker = '"captionTracks":';
  const captionIndex = html.indexOf(captionMarker);
  if (captionIndex !== -1) {
    const arrayStart = html.indexOf("[", captionIndex);
    if (arrayStart !== -1) {
      const tracks = parseJsonArray(html, arrayStart);
      if (Array.isArray(tracks) && tracks.length > 0) {
        return tracks as CaptionTrack[];
      }
    }
  }

  return [];
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 6000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTracksForClient(
  videoId: string,
  client: InnerTubeClient,
  playerUrl: string,
): Promise<CaptionTrack[]> {
  const response = await fetchWithTimeout(playerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": client.userAgent,
      "X-YouTube-Client-Name": client.clientId,
      "X-YouTube-Client-Version": client.clientVersion,
      Origin: "https://www.youtube.com",
      Referer: `https://www.youtube.com/watch?v=${videoId}`,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: client.clientName,
          clientVersion: client.clientVersion,
          hl: "en",
          gl: "US",
          ...client.extra,
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });

  const data = (await response.json()) as PlayerResponse;
  return tracksFromPlayer(data);
}

async function fetchCaptionTracksViaInnerTube(
  videoId: string,
): Promise<{ tracks: CaptionTrack[]; userAgent: string }> {
  const attempts = CLIENTS.flatMap((client) =>
    PLAYER_URLS.map(async (playerUrl) => {
      try {
        const tracks = await fetchTracksForClient(videoId, client, playerUrl);
        return { tracks, userAgent: client.userAgent };
      } catch {
        return { tracks: [] as CaptionTrack[], userAgent: client.userAgent };
      }
    }),
  );

  const results = await Promise.all(attempts);
  return results.find((result) => result.tracks.length > 0) ?? { tracks: [], userAgent: BROWSER_UA };
}

async function fetchCaptionTracksViaWatchPage(videoId: string): Promise<CaptionTrack[]> {
  try {
    const resp = await fetchWithTimeout(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+1; SOCS=CAI",
      },
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    return extractCaptionTracksFromHtml(html);
  } catch {
    return [];
  }
}

async function downloadTrackText(track: CaptionTrack, userAgent = BROWSER_UA): Promise<string> {
  if (!track.baseUrl) return "";
  const captionUrl = new URL(track.baseUrl);
  if (!isYoutubeHost(captionUrl.hostname)) return "";

  const formats = ["json3", "srv3", "srv1", ""];
  for (const fmt of formats) {
    const url = new URL(captionUrl);
    if (fmt) url.searchParams.set("fmt", fmt);
    else url.searchParams.delete("fmt");
    try {
      const resp = await fetchWithTimeout(url.toString(), {
        headers: {
          "User-Agent": userAgent,
          Referer: "https://www.youtube.com/",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (!resp.ok) continue;
      const body = await resp.text();
      if (!body.trim()) continue;
      const jsonLines = parseTranscriptJson3(body);
      if (jsonLines?.length) return jsonLines.join(" ");
      const xmlLines = parseTranscriptXml(body);
      if (xmlLines.length) return xmlLines.join(" ");
    } catch {
      // try next format
    }
  }

  return "";
}

export async function fetchYoutubeCaptionText(videoId: string): Promise<string> {
  const inner = await fetchCaptionTracksViaInnerTube(videoId);
  let tracks = inner.tracks;
  let userAgent = inner.userAgent;
  if (tracks.length === 0) {
    tracks = await fetchCaptionTracksViaWatchPage(videoId);
    userAgent = BROWSER_UA;
  }
  if (tracks.length === 0) {
    throw new Error(
      "YouTube blocked caption access from this server. Try again in a moment, or use a video with official (not auto) captions.",
    );
  }

  const track = pickTrack(tracks);
  const text = (await downloadTrackText(track!, userAgent)).replace(/\s+/g, " ").trim();
  if (!text) {
    throw new Error("Caption tracks were found, but YouTube returned an empty transcript file.");
  }
  return text;
}
