export const SITE_NAME = "Veloce Reader";
export const SITE_DESCRIPTION =
  "Analyze YouTube transcripts and read them at 500+ WPM with rapid serial visual presentation.";
export const SITE_URL = "https://veloce-reader-app.vercel.app";

export function veloceHeadMeta() {
  return [
    { title: SITE_NAME },
    { name: "description", content: SITE_DESCRIPTION },
    { property: "og:title", content: SITE_NAME },
    { property: "og:description", content: SITE_DESCRIPTION },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:url", content: SITE_URL },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: SITE_NAME },
    { name: "twitter:description", content: SITE_DESCRIPTION },
  ];
}
