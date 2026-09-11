export const EVENT = {
  name: "Sovereign Summit",
  year: "2026",
  tagline: "Six cores. One kernel. Zero variance.",
  blurb:
    "The public launch of Sovereign Engine OS — 200 SaaS apps in 512 MB micro-containers, a double-entry ledger that never drifts, and the six-core fintech substrate.",
  dateLabel: "Saturday, 26 September 2026",
  timeLabel: "18:00–23:00 CDT",
  startsAt: "2026-09-26T23:00:00.000Z",
  city: "Dallas",
  venue: "Vice Park",
  address: "2601 Gaston Ave, Dallas, TX 75226",
  transit: "DART Green Line · Baylor University Medical Center Station, 8 min walk",
  parking: "Valet on Gaston · paid lot across the street",
  repo: "https://github.com/FreddyCreates/sovereign-engine",
  repoLabel: "FreddyCreates/sovereign-engine",
} as const;

export type TierId = "signal" | "kernel" | "core";

export type TicketTier = {
  id: TierId;
  name: string;
  price: string;
  capacity: number;
  seedClaimed: number;
  perks: string[];
  blurb: string;
};

export const TIERS: TicketTier[] = [
  {
    id: "signal",
    name: "Signal Floor",
    price: "Free",
    capacity: 80,
    seedClaimed: 48,
    blurb: "Open floor, keynotes, livestream overflow, afterhours.",
    perks: ["Keynotes & panel", "Demo pit access", "Afterhours on the rooftop"],
  },
  {
    id: "kernel",
    name: "Kernel Pass",
    price: "Free · limited",
    capacity: 36,
    seedClaimed: 29,
    blurb: "Workshop tracks on the six cores, closer to the pit.",
    perks: ["Everything in Signal", "XFIN / GRID workshop seat", "Printed substrate map"],
  },
  {
    id: "core",
    name: "Core Circle",
    price: "Invite",
    capacity: 12,
    seedClaimed: 12,
    blurb: "Dinner with the kernel team. Already at capacity — waitlist only.",
    perks: ["Everything in Kernel", "Founders dinner", "Priority demo time"],
  },
];

export const AGENDA = [
  {
    time: "18:00",
    title: "Doors · Substrate mixer",
    detail: "Badge pickup, first pour, the ledger wall goes live.",
    track: "All",
  },
  {
    time: "18:30",
    title: "Opening — The Ledger Invariant",
    detail: "A. Medina on why every engine in Sovereign OS posts to a single double-entry state vector.",
    track: "Main",
  },
  {
    time: "19:00",
    title: "Six cores, one kernel",
    detail: "XFIN, AURA, PULSE, MINT, GRID, NEXS — live architecture walk on the substrate bus.",
    track: "Main",
  },
  {
    time: "19:40",
    title: "Demo — 200 SaaS in 512 MB",
    detail: "Micro-container spin-up, RevenueCat bridge, $0 ledger variance on a live purchase.",
    track: "Main",
  },
  {
    time: "20:10",
    title: "Break · Core Circle seating",
    detail: "Short pause. Core Circle dinner begins in the Sky Club.",
    track: "All",
  },
  {
    time: "20:30",
    title: "Track A — Yield & mint",
    detail: "XFIN FX yield + MINT deflationary curves. φ-weighted staking walkthrough.",
    track: "A",
  },
  {
    time: "20:30",
    title: "Track B — Mesh & pulse",
    detail: "GRID IoT consensus + PULSE churn telemetry. Wear OS entitlement unlock live.",
    track: "B",
  },
  {
    time: "21:15",
    title: "Panel — Cloud organisms",
    detail: "From cloud intelligence to cloud organisms: governed emergence, not reward-maxing.",
    track: "Main",
  },
  {
    time: "22:00",
    title: "Afterhours",
    detail: "Vice Park stays open. Rooftop afterhours, pool terrace below.",
    track: "All",
  },
] as const;

export type Speaker = {
  id: string;
  name: string;
  role: string;
  core: string;
  bio: string;
  image: string | null;
  initials: string;
};

export const SPEAKERS: Speaker[] = [
  {
    id: "medina",
    name: "A. Medina",
    role: "Founder, ItsNotAILABS",
    core: "Kernel",
    bio: "Architect of Sovereign Engine OS. Ships the ledger invariant, the six-core substrate, and the lab that refuses a second name on the email.",
    image: null,
    initials: "AM",
  },
  {
    id: "voss",
    name: "Lina Voss",
    role: "Principal, XFIN",
    core: "XFIN",
    bio: "FX yield, Black-Scholes on the edge, and the first engine that has to balance before it is allowed to speak.",
    image: "/images/speakers/lina.jpg",
    initials: "LV",
  },
  {
    id: "ito",
    name: "Kenji Ito",
    role: "Principal, GRID",
    core: "GRID",
    bio: "Byzantine mesh for Wear OS and IoT. If the watch face unlocks, GRID already agreed.",
    image: "/images/speakers/kenji.jpg",
    initials: "KI",
  },
  {
    id: "solene",
    name: "Mira Solene",
    role: "Principal, AURA",
    core: "AURA",
    bio: "Bayesian underwriting and coherence gates. She decides who the kernel will insure — and who it will not.",
    image: "/images/speakers/mira.jpg",
    initials: "MS",
  },
  {
    id: "okonkwo",
    name: "Jules Okonkwo",
    role: "Principal, NEXS",
    core: "NEXS",
    bio: "Neural paywall compiler. Turns scroll velocity and Kuramoto order into a layout the store will actually ship.",
    image: "/images/speakers/jules.jpg",
    initials: "JO",
  },
  {
    id: "fox",
    name: "R. Fox",
    role: "Substrate systems",
    core: "Bus",
    bio: "Owns the decoupled substrate bus. Every core talks through Fox, or it does not talk.",
    image: "/images/speakers/fox.jpg",
    initials: "RF",
  },
];

export const NAV = [
  { id: "event", label: "Event" },
  { id: "agenda", label: "Agenda" },
  { id: "speakers", label: "Speakers" },
  { id: "tickets", label: "Tickets" },
  { id: "venue", label: "Venue" },
  { id: "rsvp", label: "RSVP" },
] as const;
