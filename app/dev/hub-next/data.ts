// Sample data for the /dev/hub-next experiment. Realistic TSP shapes so the page
// reads like a working application. NO live data, NO mutations — experiment only.

export type Stage = "Instructed" | "Searches" | "Enquiries" | "Exchange" | "Completion";
export type Tone = "danger" | "warn" | "info" | "ok" | "muted";

export type FileItem = {
  id: string;
  line: string;
  loc: string;
  stage: Stage;
  status: string;
  statusTone: Tone;
  next: string;
  due: string | null;
  dueTone: Tone;
  feePence: number;
  chain: number;
  photo: string; // a css gradient stand-in for a property photo
  party: { name: string; role: string }[];
  progressPct: number;
  milestones: { label: string; done: boolean; current?: boolean }[];
};

const g = (a: string, b: string) => `linear-gradient(140deg, ${a}, ${b})`;
function milestones(cur: string) {
  const order = ["Instructed", "Searches ordered", "Enquiries raised", "Replies received", "Exchange", "Completion"];
  const i = order.indexOf(cur);
  return order.map((label, idx) => ({ label, done: idx < i, current: idx === i }));
}

export const FILES: FileItem[] = [
  { id: "f1", line: "3 Maple Court", loc: "Hertford · SG14 1QF", stage: "Exchange", status: "Ready to exchange", statusTone: "warn", next: "Exchange was due 28 Oct", due: "Overdue · 5 days", dueTone: "danger", feePence: 185000, chain: 3, photo: g("#ffb98a", "#ff7a59"), party: [{ name: "Priya Shah", role: "Seller" }, { name: "Duggan & Co", role: "Buyer's solicitor" }], progressPct: 88, milestones: milestones("Exchange") },
  { id: "f2", line: "14 Bushey Avenue", loc: "Watford · WD23 2AA", stage: "Enquiries", status: "Enquiry stalled", statusTone: "warn", next: "No reply from solicitor", due: "Quiet · 12 days", dueTone: "warn", feePence: 142000, chain: 2, photo: g("#9fd3ff", "#5b8def"), party: [{ name: "James Okafor", role: "Buyer" }, { name: "Harper Legal", role: "Seller's solicitor" }], progressPct: 54, milestones: milestones("Enquiries raised") },
  { id: "f3", line: "41 Oak Lane", loc: "St Albans · AL1 3RT", stage: "Searches", status: "Survey to confirm", statusTone: "info", next: "Booking needs confirming", due: "Today", dueTone: "warn", feePence: 168000, chain: 1, photo: g("#b8f0cf", "#49c08a"), party: [{ name: "Grace Bennett", role: "Buyer" }], progressPct: 42, milestones: milestones("Searches ordered") },
  { id: "f4", line: "18 Riverside", loc: "Ware · SG12 9AB", stage: "Instructed", status: "On hold — chain wait", statusTone: "muted", next: "Return in 4 weeks", due: "In 24 days", dueTone: "muted", feePence: 120000, chain: 4, photo: g("#d9c7ff", "#8b6fd6"), party: [{ name: "Tom Reid", role: "Seller" }], progressPct: 18, milestones: milestones("Instructed") },
  { id: "f5", line: "2 Nathaniels Walk", loc: "Harlow · CM17 9FG", stage: "Completion", status: "Completing Thursday", statusTone: "ok", next: "Funds confirmed", due: "In 3 days", dueTone: "ok", feePence: 156000, chain: 2, photo: g("#ffd79e", "#f2a65a"), party: [{ name: "Aisha Khan", role: "Buyer" }, { name: "Field & Sons", role: "Buyer's solicitor" }], progressPct: 96, milestones: milestones("Completion") },
  { id: "f6", line: "7 Chapel Street", loc: "Hitchin · SG5 1AB", stage: "Enquiries", status: "Replies received", statusTone: "info", next: "Review replies", due: "In 2 days", dueTone: "info", feePence: 134000, chain: 3, photo: g("#a0e8e0", "#2fb3a8"), party: [{ name: "Liam Carter", role: "Buyer" }], progressPct: 60, milestones: milestones("Replies received") },
  { id: "f7", line: "88 Victoria Road", loc: "Stevenage · SG1 3BA", stage: "Exchange", status: "Signed, ready", statusTone: "ok", next: "Awaiting buyer's side", due: "In 4 days", dueTone: "info", feePence: 148000, chain: 2, photo: g("#ffc2d1", "#f4719a"), party: [{ name: "Nadia Islam", role: "Seller" }], progressPct: 82, milestones: milestones("Exchange") },
  { id: "f8", line: "25 Elm Grove", loc: "Welwyn · AL6 9EH", stage: "Searches", status: "Searches back", statusTone: "info", next: "No adverse entries", due: "In 6 days", dueTone: "muted", feePence: 162000, chain: 1, photo: g("#c9e8a0", "#86c441"), party: [{ name: "Oliver Wood", role: "Buyer" }], progressPct: 46, milestones: milestones("Searches ordered") },
  { id: "f9", line: "11 Garden Close", loc: "Berkhamsted · HP4 2RT", stage: "Instructed", status: "Contract pack sent", statusTone: "info", next: "Buyer to raise enquiries", due: "In 8 days", dueTone: "muted", feePence: 175000, chain: 2, photo: g("#ffe08a", "#f0b429"), party: [{ name: "Sophie Lane", role: "Seller" }], progressPct: 26, milestones: milestones("Instructed") },
  { id: "f10", line: "4 Kingsmead", loc: "Tring · HP23 5HG", stage: "Completion", status: "Completed", statusTone: "ok", next: "Register at Land Registry", due: null, dueTone: "muted", feePence: 139000, chain: 1, photo: g("#bfe3ff", "#6aa9e0"), party: [{ name: "Ravi Patel", role: "Buyer" }], progressPct: 100, milestones: milestones("Completion") },
  { id: "f11", line: "60 Willow Way", loc: "Harpenden · AL5 2QT", stage: "Enquiries", status: "Further enquiries", statusTone: "info", next: "Second round raised", due: "In 5 days", dueTone: "muted", feePence: 158000, chain: 3, photo: g("#ffd0b0", "#ff9d6e"), party: [{ name: "Chloe Adams", role: "Buyer" }], progressPct: 58, milestones: milestones("Enquiries raised") },
  { id: "f12", line: "9 Priory Gardens", loc: "Royston · SG8 5AL", stage: "Searches", status: "Awaiting local authority", statusTone: "muted", next: "Searches ordered", due: "In 11 days", dueTone: "muted", feePence: 128000, chain: 2, photo: g("#c0d0ff", "#7f90e8"), party: [{ name: "Ben Shaw", role: "Buyer" }], progressPct: 38, milestones: milestones("Searches ordered") },
];

export const ATTENTION_IDS = ["f1", "f2", "f3"]; // the "needs you today" subset

export const STAGES: { stage: Stage; count: number }[] = [
  { stage: "Instructed", count: FILES.filter((f) => f.stage === "Instructed").length },
  { stage: "Searches", count: FILES.filter((f) => f.stage === "Searches").length },
  { stage: "Enquiries", count: FILES.filter((f) => f.stage === "Enquiries").length },
  { stage: "Exchange", count: FILES.filter((f) => f.stage === "Exchange").length },
  { stage: "Completion", count: FILES.filter((f) => f.stage === "Completion").length },
];

export const FORECAST = [
  { wk: "This wk", n: 2 }, { wk: "Next wk", n: 3 }, { wk: "+2", n: 1 }, { wk: "+3", n: 2 }, { wk: "+4", n: 4 }, { wk: "+5", n: 2 },
];

export type Activity = { who: string; role: "staff" | "sol" | "buyer" | "seller"; text: string; file: string; at: string };
export const ACTIVITY: Activity[] = [
  { who: "You", role: "staff", text: "Chased Duggan & Co for enquiry replies", file: "3 Maple Court", at: "12m ago" },
  { who: "Harper Legal", role: "sol", text: "Returned replies to enquiries", file: "7 Chapel Street", at: "48m ago" },
  { who: "Grace Bennett", role: "buyer", text: "Confirmed the survey date", file: "41 Oak Lane", at: "2h ago" },
  { who: "You", role: "staff", text: "Logged: seller ready to exchange", file: "88 Victoria Road", at: "3h ago" },
  { who: "Field & Sons", role: "sol", text: "Confirmed completion funds", file: "2 Nathaniels Walk", at: "Yesterday" },
  { who: "Aisha Khan", role: "buyer", text: "Signed the contract", file: "2 Nathaniels Walk", at: "Yesterday" },
];

export const fmtFee = (p: number) => `£${(p / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
export const pipelineValuePence = FILES.reduce((s, f) => s + f.feePence, 0);
export const activeCount = FILES.filter((f) => f.status !== "Completed").length;
export const exchangingCount = FILES.filter((f) => f.stage === "Exchange").length;
export const completingCount = FILES.filter((f) => f.stage === "Completion" && f.status !== "Completed").length;
