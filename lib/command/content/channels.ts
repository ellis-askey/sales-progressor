export interface Channel {
  id: string;
  label: string;
  charLimit: number;
  formatNotes: string;
}

export const CHANNELS: Channel[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    charLimit: 1500,
    formatNotes:
      "No bullet lists (LinkedIn collapses them). Each point as a short paragraph. Line breaks between paragraphs. No hashtags unless they add meaning. No emojis unless the tone explicitly allows them.",
  },
  {
    id: "twitter",
    label: "Twitter / X",
    charLimit: 280,
    formatNotes:
      "Single tweet only — 280 characters maximum including spaces. One clear point. No hashtags. No filler. Every word earns its place.",
  },
  {
    id: "tiktok_script",
    label: "TikTok script",
    charLimit: 800,
    formatNotes:
      "Written as a spoken script, not a text post. Short punchy sentences that work out loud. Hook in the first line — viewer decides in 2 seconds. End with a clear point or call to action. No formal language.",
  },
  {
    id: "instagram_caption",
    label: "Instagram caption",
    charLimit: 2200,
    formatNotes:
      "Hook in the first line — Instagram truncates after 3 lines. Conversational tone. Line breaks between ideas. Hashtags go at the very end, separated by a line break, 5 maximum.",
  },
  {
    id: "instagram_reel_script",
    label: "Instagram Reel script",
    charLimit: 800,
    formatNotes:
      "Spoken script for a short video (up to 90 seconds). Hook in the first sentence. Punchy, short sentences that sound natural when read aloud. Clear point by the end. No hashtags in the script itself.",
  },
];

export function getChannelById(id: string): Channel | undefined {
  return CHANNELS.find((c) => c.id === id);
}
