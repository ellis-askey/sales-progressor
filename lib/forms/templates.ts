// Template library for Boardwalk Forms — realistic estate-agency starting
// points, each a complete FormDefinition with sensible conditional logic.
// Static ids are fine: they only need to be unique within one form document,
// and every created form gets its own deep copy.

import type { FormDefinition, Question } from "./types";
import { blankDefinition } from "./defaults";

export type TemplateCategory = "Selling" | "Buying" | "Feedback" | "General";

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  category: TemplateCategory;
  build: () => FormDefinition;
}

function base(title: string, description: string, buttonText = "Start"): FormDefinition {
  const def = blankDefinition();
  def.welcome = { enabled: true, title, description, buttonText };
  return def;
}

const q = (partial: Partial<Question> & Pick<Question, "id" | "type" | "title">): Question => ({
  required: false,
  ...partial,
});

// ─── 1. Property valuation enquiry ──────────────────────────────────────────

function valuationEnquiry(): FormDefinition {
  const def = base(
    "Book your free property valuation",
    "Tell us a little about you and your property, and we'll arrange a visit at a time that suits you.",
    "Get started"
  );
  def.endings = [
    {
      id: "end_default",
      title: "Thanks. We'll be in touch within one working day.",
      description: "One of our valuers will call you to arrange a convenient time to visit.",
      isDefault: true,
    },
  ];
  def.questions = [
    q({ id: "q_name", type: "short_text", title: "What's your full name?", required: true, placeholder: "Jane Smith" }),
    q({ id: "q_email", type: "email", title: "And your email address?", required: true }),
    q({ id: "q_phone", type: "phone", title: "Best phone number to reach you on?", required: true }),
    q({
      id: "q_reason", type: "single_choice", title: "What's prompting the valuation?", required: true,
      choices: [
        { id: "c_selling", label: "I'm thinking of selling" },
        { id: "c_letting", label: "I'm thinking of letting" },
        { id: "c_curious", label: "I'm just curious about the value" },
      ],
    }),
    q({
      id: "q_timeline", type: "single_choice", title: "When are you hoping to move?",
      visibleIf: { combinator: "or", conditions: [
        { questionId: "q_reason", op: "equals", value: "c_selling" },
        { questionId: "q_reason", op: "equals", value: "c_letting" },
      ] },
      choices: [
        { id: "c_asap", label: "As soon as possible" },
        { id: "c_3m", label: "In the next 3 months" },
        { id: "c_6m", label: "In the next 6 months" },
        { id: "c_browsing", label: "No fixed plans yet" },
      ],
    }),
    q({ id: "q_address", type: "address", title: "What's the property address?", required: true, placeholder: "12 Orchard Lane, Beaconsfield, HP9 1AB" }),
    q({
      id: "q_type", type: "single_choice", title: "What type of property is it?",
      choices: [
        { id: "c_detached", label: "Detached house" },
        { id: "c_semi", label: "Semi-detached house" },
        { id: "c_terrace", label: "Terraced house" },
        { id: "c_flat", label: "Flat or apartment" },
        { id: "c_bungalow", label: "Bungalow" },
      ],
    }),
    q({ id: "q_beds", type: "opinion_scale", title: "How many bedrooms?", min: 1, max: 6, minLabel: "1", maxLabel: "6+" }),
    q({ id: "q_notes", type: "long_text", title: "Anything else we should know before we visit?", placeholder: "Extensions, recent work, access notes…" }),
    q({ id: "q_consent", type: "consent", title: "One last thing", consentText: "I'm happy for you to contact me about my valuation.", required: true }),
  ];
  return def;
}

// ─── 2. Buyer registration ──────────────────────────────────────────────────

function buyerRegistration(): FormDefinition {
  const def = base(
    "Register as a buyer",
    "Tell us what you're looking for and we'll match you with properties before they hit the portals.",
    "Register"
  );
  def.endings = [
    {
      id: "end_default",
      title: "You're registered.",
      description: "We'll be in touch the moment something matches your search.",
      isDefault: true,
    },
  ];
  def.questions = [
    q({ id: "q_name", type: "short_text", title: "What's your full name?", required: true }),
    q({ id: "q_email", type: "email", title: "What's your email address?", required: true }),
    q({ id: "q_phone", type: "phone", title: "And a contact number?", required: true }),
    q({
      id: "q_position", type: "single_choice", title: "What's your buying position?", required: true,
      choices: [
        { id: "c_ftb", label: "First-time buyer" },
        { id: "c_stc", label: "I have a property sold subject to contract" },
        { id: "c_tosell", label: "I have a property still to sell" },
        { id: "c_nothing", label: "Nothing to sell (investor / cash)" },
      ],
    }),
    q({
      id: "q_sell_address", type: "address", title: "Where's the property you still need to sell?",
      description: "We may be able to help with that too.",
      visibleIf: { combinator: "and", conditions: [{ questionId: "q_position", op: "equals", value: "c_tosell" }] },
    }),
    q({
      id: "q_funding", type: "single_choice", title: "How will you be funding the purchase?", required: true,
      choices: [
        { id: "c_cash", label: "Cash" },
        { id: "c_mortgage", label: "Mortgage" },
        { id: "c_mix", label: "A mix of both" },
      ],
    }),
    q({
      id: "q_aip", type: "yes_no", title: "Do you have a mortgage agreement in principle?",
      visibleIf: { combinator: "or", conditions: [
        { questionId: "q_funding", op: "equals", value: "c_mortgage" },
        { questionId: "q_funding", op: "equals", value: "c_mix" },
      ] },
    }),
    q({ id: "q_budget", type: "number", title: "What's your maximum budget?", description: "In pounds. A rough figure is fine.", min: 0, required: true }),
    q({
      id: "q_beds", type: "single_choice", title: "Minimum number of bedrooms?",
      choices: [
        { id: "c_1", label: "1" }, { id: "c_2", label: "2" }, { id: "c_3", label: "3" }, { id: "c_4", label: "4+" },
      ],
    }),
    q({
      id: "q_musthaves", type: "multiple_choice", title: "Any must-haves?", allowOther: true,
      choices: [
        { id: "c_garden", label: "Garden" },
        { id: "c_parking", label: "Parking" },
        { id: "c_garage", label: "Garage" },
        { id: "c_chainfree", label: "Chain-free only" },
        { id: "c_newbuild", label: "New build" },
      ],
    }),
    q({ id: "q_areas", type: "long_text", title: "Which areas are you searching in?", placeholder: "Towns, villages or postcodes" }),
  ];
  return def;
}

// ─── 3. Viewing feedback ────────────────────────────────────────────────────

function viewingFeedback(): FormDefinition {
  const def = base(
    "How was your viewing?",
    "Two minutes of honest feedback. It helps our sellers enormously.",
    "Give feedback"
  );
  def.endings = [
    { id: "end_offer", title: "Great, let's talk.", description: "We'll call you today to discuss your offer.", isDefault: false },
    { id: "end_default", title: "Thanks for the feedback.", description: "We'll pass it on to the owner. If anything changes, you know where we are.", isDefault: true },
  ];
  def.questions = [
    q({ id: "q_name", type: "short_text", title: "Your name?", required: true }),
    q({ id: "q_property", type: "short_text", title: "Which property did you view?", required: true, placeholder: "Address or road name" }),
    q({ id: "q_rating", type: "star_rating", title: "Overall, how did the property feel?", starCount: 5, required: true }),
    q({
      id: "q_interest", type: "single_choice", title: "Where are you at with it?", required: true,
      choices: [
        { id: "c_offer", label: "I'd like to make an offer" },
        { id: "c_second", label: "I'd like a second viewing" },
        { id: "c_thinking", label: "Still thinking it over" },
        { id: "c_notforme", label: "It's not for me" },
      ],
      jumps: [
        { id: "j_offer", combinator: "and", conditions: [{ questionId: "q_interest", op: "equals", value: "c_offer" }], target: { type: "question", questionId: "q_offer_amount" } },
        { id: "j_notforme", combinator: "and", conditions: [{ questionId: "q_interest", op: "equals", value: "c_notforme" }], target: { type: "question", questionId: "q_putoff" } },
      ],
    }),
    q({ id: "q_liked", type: "long_text", title: "What did you like most?" }),
    q({
      id: "q_price_opinion", type: "single_choice", title: "How does the asking price feel?",
      choices: [
        { id: "c_fair", label: "About right" },
        { id: "c_high", label: "A little high" },
        { id: "c_veryhigh", label: "Too high" },
        { id: "c_low", label: "Good value" },
      ],
      jumps: [
        { id: "j_done", combinator: "and", conditions: [{ questionId: "q_price_opinion", op: "is_answered" }], target: { type: "ending", endingId: "end_default" } },
      ],
    }),
    q({
      id: "q_offer_amount", type: "number", title: "What are you thinking of offering?", description: "In pounds. This stays between us and the owner.", min: 0,
      jumps: [
        { id: "j_to_offer_end", combinator: "and", conditions: [{ questionId: "q_offer_amount", op: "is_answered" }], target: { type: "ending", endingId: "end_offer" } },
      ],
    }),
    q({ id: "q_putoff", type: "long_text", title: "What put you off?", description: "Be honest. It genuinely helps." }),
  ];
  return def;
}

// ─── 4. Vendor onboarding ───────────────────────────────────────────────────

function vendorOnboarding(): FormDefinition {
  const def = base(
    "Let's get your sale moving",
    "A few details up front means we can prepare your marketing and paperwork without the back-and-forth.",
    "Begin"
  );
  def.endings = [
    { id: "end_default", title: "All done. Thank you.", description: "Your negotiator will confirm the next steps today.", isDefault: true },
  ];
  def.questions = [
    q({ id: "q_name", type: "short_text", title: "Your full name, as it appears on the title?", required: true }),
    q({ id: "q_email", type: "email", title: "Your email address?", required: true }),
    q({ id: "q_address", type: "address", title: "The property you're selling?", required: true }),
    q({
      id: "q_owners", type: "single_choice", title: "Who owns the property?", required: true,
      choices: [
        { id: "c_sole", label: "Just me" },
        { id: "c_joint", label: "Me and one other person" },
        { id: "c_multiple", label: "More than two owners" },
        { id: "c_estate", label: "I'm selling on behalf of an estate" },
      ],
    }),
    q({
      id: "q_tenure", type: "single_choice", title: "Is the property freehold or leasehold?", required: true,
      choices: [
        { id: "c_freehold", label: "Freehold" },
        { id: "c_leasehold", label: "Leasehold" },
        { id: "c_unsure", label: "Not sure" },
      ],
    }),
    q({
      id: "q_lease_years", type: "number", title: "Roughly how many years are left on the lease?", min: 0, max: 999,
      visibleIf: { combinator: "and", conditions: [{ questionId: "q_tenure", op: "equals", value: "c_leasehold" }] },
    }),
    q({ id: "q_solicitor", type: "yes_no", title: "Have you instructed a solicitor yet?", required: true }),
    q({
      id: "q_solicitor_details", type: "long_text", title: "Who's acting for you?", placeholder: "Firm name, contact and email if you have them",
      visibleIf: { combinator: "and", conditions: [{ questionId: "q_solicitor", op: "equals", value: "yes" }] },
    }),
    q({
      id: "q_mortgage", type: "yes_no", title: "Is there a mortgage on the property?", required: true,
    }),
    q({ id: "q_onward", type: "yes_no", title: "Are you buying somewhere else at the same time?" }),
    q({ id: "q_keys", type: "multiple_choice", title: "How should viewings work?", choices: [
      { id: "c_accompanied", label: "You hold keys and accompany viewings" },
      { id: "c_present", label: "I'd like to be present" },
      { id: "c_notice", label: "Fine either way, with notice" },
    ] }),
    q({ id: "q_id", type: "file_upload", title: "Upload a photo of your ID", description: "Passport or driving licence. Required for anti-money-laundering checks.", maxFiles: 2, maxFileSizeMb: 10, acceptedFileTypes: ["image", "pdf"] }),
    q({ id: "q_consent", type: "consent", title: "Nearly there", consentText: "I confirm the information above is accurate to the best of my knowledge.", required: true }),
  ];
  return def;
}

// ─── 5. Property marketing questionnaire ────────────────────────────────────

function marketingQuestionnaire(): FormDefinition {
  const def = base(
    "Help us market your home",
    "You know your home better than anyone. These answers feed straight into your listing copy.",
    "Start"
  );
  def.endings = [
    { id: "end_default", title: "Perfect. That's exactly what we need.", description: "We'll draft your listing and send it over for approval before anything goes live.", isDefault: true },
  ];
  def.questions = [
    q({ id: "q_address", type: "address", title: "Which property is this for?", required: true }),
    q({ id: "q_best", type: "long_text", title: "What do you love most about living here?", description: "The honest answer is usually the best marketing line we have.", required: true }),
    q({
      id: "q_features", type: "multiple_choice", title: "Which of these does the property have?", allowOther: true,
      choices: [
        { id: "c_garden", label: "Garden" },
        { id: "c_offstreet", label: "Off-street parking" },
        { id: "c_garage", label: "Garage" },
        { id: "c_ensuite", label: "En-suite" },
        { id: "c_utility", label: "Utility room" },
        { id: "c_office", label: "Home office" },
        { id: "c_period", label: "Period features" },
      ],
    }),
    q({ id: "q_work", type: "long_text", title: "Any recent improvements or renovations?", placeholder: "New boiler 2024, rewired 2022, loft conversion…" }),
    q({ id: "q_area", type: "long_text", title: "What makes the local area great?", placeholder: "Schools, transport, pubs, parks…" }),
    q({
      id: "q_photos_ready", type: "yes_no", title: "Is the property ready for photography?", required: true,
      jumps: [
        { id: "j_ready", combinator: "and", conditions: [{ questionId: "q_photos_ready", op: "equals", value: "yes" }], target: { type: "question", questionId: "q_photo_date" } },
      ],
    }),
    q({ id: "q_photos_when", type: "long_text", title: "What needs doing first, and when will it be ready?" }),
    q({ id: "q_photo_date", type: "date", title: "Best date for the photographer?", dateConstraint: "future_only" }),
    q({ id: "q_time", type: "time", title: "And roughly what time suits?" }),
  ];
  return def;
}

// ─── 6. Offer submission ────────────────────────────────────────────────────

function offerSubmission(): FormDefinition {
  const def = base(
    "Submit your offer",
    "Put your best foot forward. Everything here goes to the owner exactly as you write it.",
    "Make an offer"
  );
  def.endings = [
    { id: "end_default", title: "Your offer is in.", description: "We'll present it to the owner and come back to you as quickly as we can, usually the same day.", isDefault: true },
  ];
  def.questions = [
    q({ id: "q_name", type: "short_text", title: "Your full name?", required: true }),
    q({ id: "q_email", type: "email", title: "Email address?", required: true }),
    q({ id: "q_phone", type: "phone", title: "Phone number?", required: true }),
    q({ id: "q_property", type: "short_text", title: "Which property are you offering on?", required: true }),
    q({ id: "q_amount", type: "number", title: "Your offer, in pounds?", required: true, min: 1 }),
    q({
      id: "q_position", type: "single_choice", title: "Your current position?", required: true,
      choices: [
        { id: "c_ftb", label: "First-time buyer" },
        { id: "c_stc", label: "Sold subject to contract" },
        { id: "c_tosell", label: "Property still to sell" },
        { id: "c_cash", label: "Cash buyer, nothing to sell" },
        { id: "c_investor", label: "Investor" },
      ],
    }),
    q({
      id: "q_funding", type: "single_choice", title: "How is the purchase funded?", required: true,
      choices: [
        { id: "c_cash", label: "Cash" },
        { id: "c_mortgage", label: "Mortgage" },
        { id: "c_mix", label: "Cash and mortgage" },
      ],
    }),
    q({
      id: "q_aip", type: "yes_no", title: "Do you have an agreement in principle?", required: true,
      visibleIf: { combinator: "or", conditions: [
        { questionId: "q_funding", op: "equals", value: "c_mortgage" },
        { questionId: "q_funding", op: "equals", value: "c_mix" },
      ] },
    }),
    q({
      id: "q_aip_file", type: "file_upload", title: "Upload your agreement in principle", description: "Optional, but it strengthens your offer.", maxFiles: 1, maxFileSizeMb: 10, acceptedFileTypes: ["pdf", "image"],
      visibleIf: { combinator: "and", conditions: [{ questionId: "q_aip", op: "equals", value: "yes" }] },
    }),
    q({ id: "q_solicitor", type: "long_text", title: "Who's your solicitor?", placeholder: "Firm name and contact, or 'not instructed yet'" }),
    q({ id: "q_timescale", type: "single_choice", title: "Ideal timescale to exchange?", choices: [
      { id: "c_4w", label: "Within 4 weeks" },
      { id: "c_8w", label: "4–8 weeks" },
      { id: "c_12w", label: "8–12 weeks" },
      { id: "c_flexible", label: "Flexible" },
    ] }),
    q({ id: "q_message", type: "long_text", title: "Anything you'd like the owner to know?", description: "A personal note genuinely can make the difference." }),
    q({ id: "q_consent", type: "consent", title: "Confirming your offer", consentText: "I confirm this offer is genuine and made in good faith.", required: true }),
  ];
  return def;
}

// ─── 7. Customer satisfaction survey ────────────────────────────────────────

function satisfactionSurvey(): FormDefinition {
  const def = base(
    "How did we do?",
    "Two minutes. Straight answers. We read every single one.",
    "Start"
  );
  def.endings = [
    { id: "end_sorry", title: "Thank you, and we're sorry.", description: "Someone senior will look at this personally and come back to you within one working day.", isDefault: false },
    { id: "end_default", title: "Thank you.", description: "We really appreciate you taking the time.", isDefault: true },
  ];
  def.questions = [
    q({
      id: "q_service", type: "single_choice", title: "What did we help you with?", required: true,
      choices: [
        { id: "c_selling", label: "Selling a property" },
        { id: "c_buying", label: "Buying a property" },
        { id: "c_letting", label: "Letting" },
        { id: "c_renting", label: "Renting" },
      ],
    }),
    q({ id: "q_nps", type: "opinion_scale", title: "How likely are you to recommend us to a friend?", min: 0, max: 10, minLabel: "Not at all likely", maxLabel: "Extremely likely", required: true,
      jumps: [
        { id: "j_low", combinator: "and", conditions: [{ questionId: "q_nps", op: "less_than", value: 7 }], target: { type: "question", questionId: "q_wrong" } },
      ],
    }),
    q({ id: "q_comms", type: "star_rating", title: "How was our communication?", starCount: 5 }),
    q({ id: "q_knowledge", type: "star_rating", title: "And our local knowledge?", starCount: 5 }),
    q({ id: "q_best", type: "long_text", title: "What did we do well?",
      jumps: [
        { id: "j_done", combinator: "and", conditions: [{ questionId: "q_best", op: "is_answered" }], target: { type: "question", questionId: "q_review" } },
      ],
    }),
    q({ id: "q_wrong", type: "long_text", title: "What went wrong?", description: "Please be specific. It's the only way we fix it.", required: true }),
    q({ id: "q_contact", type: "yes_no", title: "Would you like someone senior to call you about this?",
      jumps: [
        { id: "j_sorry", combinator: "and", conditions: [{ questionId: "q_contact", op: "is_answered" }], target: { type: "ending", endingId: "end_sorry" } },
      ],
    }),
    q({ id: "q_review", type: "yes_no", title: "Would you be happy to leave us a public review?" }),
  ];
  return def;
}

// ─── 8. General contact ─────────────────────────────────────────────────────

function contactForm(): FormDefinition {
  const def = base(
    "Get in touch",
    "Tell us what you need and the right person will come back to you.",
    "Start"
  );
  def.endings = [
    { id: "end_default", title: "Message received.", description: "We aim to reply within one working day.", isDefault: true },
  ];
  def.questions = [
    q({ id: "q_name", type: "short_text", title: "Your name?", required: true }),
    q({ id: "q_email", type: "email", title: "Your email address?", required: true }),
    q({
      id: "q_topic", type: "single_choice", title: "What's it about?", required: true,
      choices: [
        { id: "c_selling", label: "Selling" },
        { id: "c_buying", label: "Buying" },
        { id: "c_lettings", label: "Lettings" },
        { id: "c_valuation", label: "A valuation" },
        { id: "c_other", label: "Something else" },
      ],
    }),
    q({ id: "q_message", type: "long_text", title: "What can we help with?", required: true }),
    q({ id: "q_callback", type: "yes_no", title: "Would you like a call back?" }),
    q({
      id: "q_phone", type: "phone", title: "Best number to call?", required: true,
      visibleIf: { combinator: "and", conditions: [{ questionId: "q_callback", op: "equals", value: "yes" }] },
    }),
  ];
  return def;
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "valuation-enquiry",
    category: "Selling",
    name: "Property valuation enquiry",
    description: "Capture valuation leads with contact details, property info and consent, branching for sellers vs the merely curious.",
    questionCount: 10,
    build: valuationEnquiry,
  },
  {
    id: "buyer-registration",
    category: "Buying",
    name: "Buyer registration",
    description: "Register applicants with position, funding, budget and must-haves. Asks about their sale only when they have one.",
    questionCount: 11,
    build: buyerRegistration,
  },
  {
    id: "viewing-feedback",
    category: "Feedback",
    name: "Viewing feedback",
    description: "Post-viewing feedback that routes hot buyers straight to an offer conversation and asks the honest 'what put you off' otherwise.",
    questionCount: 8,
    build: viewingFeedback,
  },
  {
    id: "vendor-onboarding",
    category: "Selling",
    name: "Vendor onboarding",
    description: "Everything you need from a new seller: ownership, tenure, solicitor, mortgage, viewing preferences and ID upload.",
    questionCount: 13,
    build: vendorOnboarding,
  },
  {
    id: "marketing-questionnaire",
    category: "Selling",
    name: "Property marketing questionnaire",
    description: "Pulls listing-copy gold from the owner: what they love, what's been improved, and when the photographer can come.",
    questionCount: 9,
    build: marketingQuestionnaire,
  },
  {
    id: "offer-submission",
    category: "Buying",
    name: "Offer submission",
    description: "A structured, verifiable offer: amount, position, funding, AIP upload and a personal note to the owner.",
    questionCount: 13,
    build: offerSubmission,
  },
  {
    id: "satisfaction-survey",
    category: "Feedback",
    name: "Customer satisfaction survey",
    description: "NPS-style survey that quietly routes unhappy clients to a 'what went wrong' path and a senior call-back.",
    questionCount: 8,
    build: satisfactionSurvey,
  },
  {
    id: "contact",
    category: "General",
    name: "General contact form",
    description: "A clean, branded way in, with topic routing and an optional call-back number.",
    questionCount: 6,
    build: contactForm,
  },
];

export function getTemplate(id: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((t) => t.id === id);
}
