export interface Tone {
  id: string;
  label: string;
  description: string;
  positiveRules: string[];
  negativeRules: string[];
}

export const TONES: Tone[] = [
  {
    id: "founder-direct",
    label: "Founder direct",
    description: "Strong takes, unhedged. Opinion first, reasoning second.",
    positiveRules: [
      "First line is the take — no preamble, no scene-setting.",
      "Short sentences. One idea per sentence.",
      "Opinion comes first; evidence or reasoning follows.",
      "Concrete specifics over vague generalisations.",
    ],
    negativeRules: [
      "Never opens with 'I've been thinking about…', 'I wanted to share…', or 'Something I've noticed lately…'",
      "No qualifier phrases: 'I think', 'in my opinion', 'I believe', 'personally' — the take must stand unhedged.",
      "No emoji of any kind.",
      "No engagement-baiting closer: 'What do you think?', 'Thoughts?', 'Drop a comment below', 'Would love to hear from you'",
    ],
  },
  {
    id: "educational",
    label: "Educational",
    description: "Teach one thing clearly. Hook, structured points, single takeaway.",
    positiveRules: [
      "Open with a surprising fact, counterintuitive claim, or question that creates immediate curiosity.",
      "3–5 tight points, each as its own short paragraph.",
      "Plain language — define any jargon the moment it appears.",
      "Ends with one clear actionable takeaway, not a question.",
    ],
    negativeRules: [
      "Never starts with 'In today's post…', 'Today I want to talk about…', or 'I wanted to break down…' — open with the hook.",
      "No bullet lists — LinkedIn collapses them; write each point as a short paragraph instead.",
      "No closing phrases: 'I hope this was helpful', 'Thanks for reading', 'Let me know your thoughts in the comments'",
      "No padding: 'it's important to note that', 'needless to say', 'as you probably know', 'the truth is' used as filler.",
    ],
  },
  {
    id: "behind-the-scenes",
    label: "Behind the scenes",
    description: "Process transparency. Something internal the reader wouldn't normally see.",
    positiveRules: [
      "Reveals something internal — a process, a decision, a failure — the reader genuinely wouldn't see from outside.",
      "Tells it chronologically: what happened, then what it meant.",
      "Allowed to be longer (up to 250 words); pacing matters more than brevity here.",
      "Ends with the realisation or shift — not a call to action.",
    ],
    negativeRules: [
      "No false-modesty openers: 'I'm not sure if I should share this…', 'This might be oversharing…', 'I don't usually post like this…'",
      "No manufactured drama: 'What happened next surprised even me', 'The result shocked us', 'You won't believe what we found'",
      "No 'this is why I do what I do' or 'it reminded me of my why' — instantly signals performative content.",
      "No sequence of events without a clear point — every detail in the story must serve the realisation at the end.",
    ],
  },
];

export function getToneById(id: string): Tone | undefined {
  return TONES.find((t) => t.id === id);
}
