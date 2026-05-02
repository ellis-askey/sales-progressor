export interface VoiceQuestion {
  key: string;
  text: string;
  placeholder: string;
}

export const VOICE_QUESTIONS: VoiceQuestion[] = [
  {
    key: "q1_near_miss",
    text: "Walk me through a real situation where a sale almost fell apart. What happened and what did you do?",
    placeholder: "Pick a specific deal — not a generalised answer. What was the moment you knew it was in trouble?",
  },
  {
    key: "q2_contrarian",
    text: "What's a belief most people in your industry hold that you think is wrong?",
    placeholder: "The more specific the belief, and the stronger your disagreement, the better.",
  },
  {
    key: "q3_proud_moment",
    text: "What's a recent moment in your business you were proud of? Tell it like you'd tell a friend.",
    placeholder: "Not a polished case study — the rough version you'd say over a coffee.",
  },
  {
    key: "q4_ideal_client",
    text: "What kind of estate agency owner do you most want to work with? Describe them specifically.",
    placeholder: "Think of your best client relationship. What made them the right fit?",
  },
  {
    key: "q5_repeated_advice",
    text: "What's a piece of advice you find yourself giving over and over?",
    placeholder: "The thing you've said so many times you're almost tired of saying it.",
  },
  {
    key: "q6_changed_mind",
    text: "What's something you've changed your mind about in the last 6 months?",
    placeholder: "Could be about your business, the industry, how you work — anything real.",
  },
];
