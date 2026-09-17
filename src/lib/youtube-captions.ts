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

const INNERTUBE_PLAYER_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

const CLIENTS: Array<{
  clientName: string;
  clientVersion: string;
  userAgent: string;
  extra?: Record<string, string>;
}> = [
  {
    clientName: "ANDROID",
    clientVersion: "20.10.38",
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
  },
  {
    clientName: "MWEB",
    clientVersion: "2.20241201.00.00",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },
  {
    clientName: "WEB_EMBEDDED_PLAYER",
    clientVersion: "1.20241201.00.00",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
  {
    clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    clientVersion: "2.0",
    userAgent: "Mozilla/5.0 (ChromiumStylePlatform) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
  {
    clientName: "WEB",
    clientVersion: "2.20260101.00.00",
    extra: { hl: "en", gl: "US" },
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
  const english =
    tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode === "en") ??
    tracks.find((t) => t.languageCode?.startsWith("en"));
  return english ?? tracks[0];
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
    return lines;
  } catch {
    return null;
  }
}

function parsePlayerResponseFromHtml(html: string): PlayerResponse | null {
  const markers = ["ytInitialPlayerResponse = ", "var ytInitialPlayerResponse = "];
  for (const marker of markers) {
    const startIndex = html.indexOf(marker);
    if (startIndex === -1) continue;
    const jsonStart = startIndex + marker.length;
    let depth = 0;
    for (let i = jsonStart; i < html.length; i++) {
      if (html[i] === "{") depth++;
      else if (html[i] === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(jsonStart, i + 1)) as PlayerResponse;
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const resp = await fetch(url, init);
  if (!resp.ok) return null;
  return resp.json();
}

async function fetchCaptionTracksViaInnerTube(videoId: string): Promise<CaptionTrack[]> {
  for (const client of CLIENTS) {
    try {
      const data = (await fetchJson(INNERTUBE_PLAYER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": client.userAgent,
          "X-YouTube-Client-Name": client.clientName === "WEB" ? "1" : "3",
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
      })) as PlayerResponse | null;
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      if (tracks.length > 0) return tracks;
    } catch {
      // try the next client
    }
  }
  return [];
}

async function fetchCaptionTracksViaWatchPage(videoId: string): Promise<CaptionTrack[]> {
  const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: "CONSENT=YES+1; SOCS=CAI",
    },
  });
  if (!resp.ok) return [];
  const html = await resp.text();
  const player = parsePlayerResponseFromHtml(html);
  return player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}

async function downloadTrackText(track: CaptionTrack): Promise<string> {
  if (!track.baseUrl) return "";
  const captionUrl = new URL(track.baseUrl);
  if (!isYoutubeHost(captionUrl.hostname)) return "";

  const formats = ["json3", "srv3", "srv1"];
  for (const fmt of formats) {
    const url = new URL(captionUrl);
    url.searchParams.set("fmt", fmt);
    const resp = await fetch(url.toString(), {
      headers: {
        "User-Agent": BROWSER_UA,
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
  }

  const rawResp = await fetch(captionUrl.toString(), {
    headers: {
      "User-Agent": BROWSER_UA,
      Referer: "https://www.youtube.com/",
    },
  });
  if (!rawResp.ok) return "";
  const raw = await rawResp.text();
  return parseTranscriptXml(raw).join(" ");
}

export async function fetchYoutubeCaptionText(videoId: string): Promise<string> {
  let tracks = await fetchCaptionTracksViaInnerTube(videoId);
  if (tracks.length === 0) {
    tracks = await fetchCaptionTracksViaWatchPage(videoId);
  }
  if (tracks.length === 0) {
    throw new Error(
      "YouTube did not return caption tracks for this video. The video may have captions only in the UI, or YouTube blocked the request.",
    );
  }

  const track = pickTrack(tracks);
  const text = (await downloadTrackText(track!)).replace(/\s+/g, " ").trim();
  if (!text) {
    throw new Error("Caption tracks were found, but the transcript file was empty.");
  }
  return text;
}
