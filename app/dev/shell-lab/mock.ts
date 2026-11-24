// Mock "All Files" data for /dev/shell-lab. Presentation-only — no queries, no
// writes. Shapes loosely mirror a progression file row so the screen feels real
// while we judge the shell around it.

export type Stage =
  | "Instructed"
  | "Searches"
  | "Enquiries"
  | "Replies in"
  | "Report issued"
  | "Signed"
  | "Ready to exchange";

export type FileRow = {
  id: string;
  address: string;
  town: string;
  seller: string;
  buyer: string;
  stage: Stage;
  progress: number; // 0..100
  next: string;
  waitingDays: number;
  tone: "ok" | "warn" | "hot";
  price: string;
};

// A warm palette of placeholder tile colours (stand-in for property photos).
export const TILE_COLORS = [
  "#f0c7a1", "#cdd6c0", "#bcd0e0", "#e4c3cd", "#d7cbe8",
  "#c9dcc3", "#e9d4a8", "#c2d3dd", "#e3c9b6", "#cbd9e6",
];

export const FILES: FileRow[] = [
  { id: "f1", address: "14 Mallow Close", town: "Colchester, CO4 5TG", seller: "James & Sarah Hartley", buyer: "Priya Shah", stage: "Enquiries", progress: 54, next: "Chase seller's solicitor for replies", waitingDays: 9, tone: "warn", price: "£425,000" },
  { id: "f2", address: "Lower Maisonette, 49 Overnhill Rd", town: "Bristol, BS16 5DS", seller: "D. Mitchell", buyer: "The Okafors", stage: "Replies in", progress: 61, next: "Review replies, raise any further", waitingDays: 2, tone: "ok", price: "£680,000" },
  { id: "f3", address: "42 Penguin Parade", town: "Colchester, CO3 8BU", seller: "R. Lloyd", buyer: "M. Dawson", stage: "Searches", progress: 38, next: "Searches due back", waitingDays: 14, tone: "warn", price: "£310,000" },
  { id: "f4", address: "7 Christopher Garnett Chase", town: "Colchester, CO3 8BQ", seller: "A. Bright", buyer: "Harpers", stage: "Enquiries", progress: 50, next: "Enquiries raised 3 wks ago", waitingDays: 22, tone: "hot", price: "£540,000" },
  { id: "f5", address: "Applewood, Carters Hill", town: "Boxstead, CO4 5YN", seller: "The Timmses", buyer: "L. Monroe", stage: "Report issued", progress: 72, next: "Awaiting buyer to sign", waitingDays: 4, tone: "ok", price: "£725,000" },
  { id: "f6", address: "33 Milner Road", town: "Bristol, BS7 9PQ", seller: "C. Willis", buyer: "N. Patel", stage: "Signed", progress: 86, next: "Deposit to confirm", waitingDays: 1, tone: "ok", price: "£389,950" },
  { id: "f7", address: "18 Daisy Road", town: "Bristol, BS5 6JS", seller: "E. Ford", buyer: "G. & H. Blake", stage: "Ready to exchange", progress: 94, next: "Coordinating exchange", waitingDays: 0, tone: "ok", price: "£455,000" },
  { id: "f8", address: "21 Felix Road", town: "Bristol, BS5 0JP", seller: "Martin & Jo", buyer: "S. Reeves", stage: "Instructed", progress: 12, next: "Chase welcome pack", waitingDays: 6, tone: "warn", price: "£272,500" },
  { id: "f9", address: "30 Mallard Close", town: "Bristol, BS5 7TW", seller: "The Palmers", buyer: "A. Khan", stage: "Enquiries", progress: 48, next: "Replies outstanding", waitingDays: 11, tone: "warn", price: "£510,000" },
  { id: "f10", address: "50 Hill Street", town: "Bristol, BS3 4TS", seller: "O'Donnell", buyer: "T. Fisher", stage: "Searches", progress: 34, next: "Order searches", waitingDays: 3, tone: "ok", price: "£333,000" },
  { id: "f11", address: "727 Bishport Avenue", town: "Bristol, BS13 9EH", seller: "Rhia L.", buyer: "The Suttons", stage: "Replies in", progress: 64, next: "Review replies", waitingDays: 5, tone: "ok", price: "£298,000" },
  { id: "f12", address: "75 Bloomfield Road", town: "Bristol, BS4 3QP", seller: "C. Ash", buyer: "M. Doyle", stage: "Enquiries", progress: 52, next: "Chase for replies", waitingDays: 17, tone: "hot", price: "£405,000" },
  { id: "f13", address: "Flat 2, Old Shoe Factory", town: "Bristol, BS2 8RR", seller: "Garvey", buyer: "P. Nicholls", stage: "Report issued", progress: 70, next: "Final report with buyer", waitingDays: 2, tone: "ok", price: "£249,000" },
  { id: "f14", address: "34 Dunkerry Road", town: "Bristol, BS3 4LB", seller: "The Wilkies", buyer: "R. Osei", stage: "Signed", progress: 88, next: "Awaiting other side", waitingDays: 1, tone: "ok", price: "£367,500" },
  { id: "f15", address: "40 Sion Road", town: "Bristol, BS3 3BE", seller: "Bolshaw", buyer: "J. Marsh", stage: "Enquiries", progress: 46, next: "Enquiries sent to seller", waitingDays: 8, tone: "warn", price: "£612,000" },
  { id: "f16", address: "33 Overndale Road", town: "Bristol, BS16 2RU", seller: "Jelfs", buyer: "The Hydes", stage: "Searches", progress: 40, next: "Searches in progress", waitingDays: 12, tone: "warn", price: "£485,000" },
  { id: "f17", address: "10 Ventnor Road", town: "Bristol, BS5 7SG", seller: "A. Carter", buyer: "L. Begum", stage: "Instructed", progress: 9, next: "ID & AML outstanding", waitingDays: 7, tone: "warn", price: "£284,000" },
  { id: "f18", address: "206 Butlers Walk", town: "Bristol, BS5 7AX", seller: "The Reads", buyer: "S. Murray", stage: "Ready to exchange", progress: 96, next: "Exchange imminent", waitingDays: 0, tone: "ok", price: "£520,000" },
  { id: "f19", address: "5 Oakhill Drive", town: "Colchester, CO2 9PT", seller: "H. Morris", buyer: "The Ellistons", stage: "Replies in", progress: 60, next: "Review & report", waitingDays: 4, tone: "ok", price: "£398,000" },
  { id: "f20", address: "88 Cranbrook Road", town: "Bristol, BS6 7DD", seller: "P. Lambert", buyer: "N. & A. Hussain", stage: "Enquiries", progress: 55, next: "Chase replies", waitingDays: 19, tone: "hot", price: "£640,000" },
  { id: "f21", address: "3 Kingsway", town: "Bristol, BS5 8JF", seller: "The Grants", buyer: "D. Owusu", stage: "Report issued", progress: 74, next: "Buyer reviewing report", waitingDays: 3, tone: "ok", price: "£312,500" },
  { id: "f22", address: "61 North Street", town: "Bristol, BS3 1ES", seller: "Saunders", buyer: "E. Pope", stage: "Signed", progress: 90, next: "Deposit received", waitingDays: 1, tone: "ok", price: "£575,000" },
  { id: "f23", address: "12 Maple Avenue", town: "Colchester, CO1 2AB", seller: "T. Wright", buyer: "The Shahs", stage: "Searches", progress: 36, next: "Searches ordered", waitingDays: 10, tone: "warn", price: "£329,000" },
  { id: "f24", address: "9 Sunnyside, Long Rd West", town: "Colchester, CO7 6EP", seller: "The Askews", buyer: "R. Flynn", stage: "Enquiries", progress: 49, next: "Replies outstanding", waitingDays: 13, tone: "warn", price: "£462,000" },
];

export const ACCOUNT = { name: "Ellis Askey", agency: "Boardwalk Property Co", initials: "EA" };
