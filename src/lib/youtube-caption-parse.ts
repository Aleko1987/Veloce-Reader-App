export type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
};

export type PlayerResponse = {
  playabilityStatus?: { status?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
};

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

export function isYoutubeHost(hostname: string): boolean {
  return hostname === "youtube.com" || hostname.endsWith(".youtube.com");
}

export function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  return (
    tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode === "en") ??
    tracks.find((t) => t.languageCode?.startsWith("en")) ??
    tracks[0]
  );
}

export function tracksFromPlayer(data: PlayerResponse | null | undefined): CaptionTrack[] {
  return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}

export function parseCaptionBody(body: string): string {
  const jsonLines = parseTranscriptJson3(body);
  if (jsonLines?.length) return jsonLines.join(" ");
  return parseTranscriptXml(body).join(" ");
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
