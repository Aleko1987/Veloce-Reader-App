import {
  parseCaptionBody,
  pickCaptionTrack,
  tracksFromPlayer,
  type CaptionTrack,
  type PlayerResponse,
} from "./youtube-caption-parse";

const PLAYER_URLS = [
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
  "https://youtubei.googleapis.com/youtubei/v1/player?key=AIzaSyB-63vPrdPVUKCJUH8DQ3rLa7gOJ1IUOsU",
];

function iosPlayerBody(videoId: string): string {
  return JSON.stringify({
    context: {
      client: {
        clientName: "IOS",
        clientVersion: "20.10.4",
        deviceMake: "Apple",
        deviceModel: "iPhone16,2",
        osName: "iPhone",
        osVersion: "18.3.2.22D82",
        hl: "en",
        gl: "US",
      },
    },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  });
}

async function fetchTracksFromPlayer(videoId: string): Promise<CaptionTrack[]> {
  const body = iosPlayerBody(videoId);
  for (const url of PLAYER_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        // text/plain avoids a CORS preflight that YouTube rejects.
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
      });
      if (!response.ok) continue;
      const data = (await response.json()) as PlayerResponse;
      const tracks = tracksFromPlayer(data);
      if (tracks.length > 0) return tracks;
    } catch {
      // CORS or network; try the next endpoint
    }
  }
  return [];
}

async function downloadTrackText(track: CaptionTrack): Promise<string> {
  if (!track.baseUrl) return "";
  const captionUrl = new URL(track.baseUrl, "https://www.youtube.com");
  const formats = ["json3", "srv3", ""];
  for (const fmt of formats) {
    const url = new URL(captionUrl);
    if (fmt) url.searchParams.set("fmt", fmt);
    else url.searchParams.delete("fmt");
    try {
      const response = await fetch(url.toString(), { credentials: "omit" });
      if (!response.ok) continue;
      const body = await response.text();
      const text = parseCaptionBody(body).replace(/\s+/g, " ").trim();
      if (text) return text;
    } catch {
      // try next format
    }
  }
  return "";
}

async function fetchUnsignedTimedText(videoId: string): Promise<string> {
  const variants = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-US&kind=asr&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=srv3`,
  ];
  for (const url of variants) {
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) continue;
      const text = parseCaptionBody(await response.text()).replace(/\s+/g, " ").trim();
      if (text) return text;
    } catch {
      // try next variant
    }
  }
  return "";
}

export async function fetchYoutubeCaptionTextInBrowser(videoId: string): Promise<string> {
  const tracks = await fetchTracksFromPlayer(videoId);
  if (tracks.length > 0) {
    const track = pickCaptionTrack(tracks);
    if (track) {
      const fromTrack = await downloadTrackText(track);
      if (fromTrack) return fromTrack;
    }
  }

  const unsigned = await fetchUnsignedTimedText(videoId);
  if (unsigned) return unsigned;

  throw new Error("Browser caption fetch failed");
}
