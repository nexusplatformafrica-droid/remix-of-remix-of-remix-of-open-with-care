export type ID = string;

export type UserSettings = {
  emailAlerts: boolean;
  smsAlerts: boolean;
  pushAlerts: boolean;
  twoFactor: boolean;
  betConfirmation: boolean;
  oddsChangeAccept: boolean;
  depositLimit: number;
  stakeLimit: number;
  selfExcluded: boolean;
  language: string;
  timezone: string;
};

export type UserMessage = {
  id: ID;
  at: number;
  channel: "Message" | "Alert" | "Notification";
  title: string;
  body: string;
};

export type AdminUser = {
  id: ID;
  name: string;
  phone: string;
  idNumber: string;
  email: string;
  country: string;
  currency: string;
  balance: number;
  /** Non-withdrawable sign-up bonus. Usable for stakes only. */
  bonusBalance?: number;
  /** Shareable referral code, e.g. BP123456. */
  referralCode?: string;
  /** Referral code this account signed up with. */
  referredBy?: string;
  /** Number of friends who joined with this account's code. */
  referralCount?: number;
  role?: "admin" | "user";
  totalIn: number;
  totalOut: number;
  lostBalance: number;
  lastSeen: number;
  joinedAt: number;
  status: "active" | "blocked";
  verified: boolean;
  city: string;
  settings: UserSettings;
  messages: UserMessage[];
};

export type Agent = {
  id: ID;
  name: string;
  idNumber: string;
  phone: string;
  shopName: string;
  shopBranch: string;
  country: string;
  status: "active" | "blocked";
  lastSeen: number;
  balance: number;
  commissionRate: number;
  username: string;
  password: string;
  createdAt: number;
};

export type Partner = {
  id: ID;
  name: string;
  location: string;
  contact: string;
  email: string;
  country: string;
  type: "Sale" | "Partnership";
  company: string;
  registrationNo: string;
  contractValue: number;
  status: "active" | "pending" | "ended";
  notes: string;
  createdAt: number;
};

export type BetMatch = {
  id: ID;
  /** Provider fixture id — lets tickets pull the live/final score. */
  matchId?: string | undefined;
  sport?: string | undefined;
  match: string;
  league: string;
  market: string;
  pick: string;
  odds: number;
  startsAt: number;
  status: "pending" | "won" | "lost" | "void";
  /** Latest known score line for this leg, e.g. "2 - 1 FT". */
  score?: string | undefined;
};

export type Bet = {
  id: ID;
  code: string;
  userId: ID;
  stake: number;
  status: "pending" | "won" | "lost" | "cancelled";
  placedAt: number;
  matches: BetMatch[];
};

export type Activity = {
  id: ID;
  at: number;
  actorType: "user" | "agent" | "admin" | "affiliate" | "partner";
  actorId: ID;
  actorName: string;
  action: string;
  target: string;
  ip: string;
  device: string;
  meta?: string;
};

export type Transaction = {
  id: ID;
  at: number;
  kind: "Deposit" | "Withdrawal" | "Bet" | "Payout" | "Bonus" | "Commission" | "Adjustment";
  amount: number;
  method: string;
  actorType: "user" | "agent" | "affiliate" | "admin";
  actorId: ID;
  actorName: string;
  status: "completed" | "pending" | "failed";
  reference: string;
};

export type Affiliate = {
  id: ID;
  name: string;
  phone: string;
  email: string;
  country: string;
  code: string;
  referrals: number;
  commissionRate: number;
  earnings: number;
  paidOut: number;
  status: "active" | "suspended";
  createdAt: number;
};

export type Slide = {
  id: ID;
  title: string;
  subtitle: string;
  image: string;
  cta: string;
  link: string;
  active: boolean;
  /** Epoch ms after which the slide stops showing on the site. */
  expiresAt?: number;
};

export type WinnerTicketLeg = {
  /** Real match id from the results feed (when picked from results). */
  matchId?: string;
  time: string;
  teams: string;
  league: string;
  market: string;
  odds: number;
  score: string;
  status: "won" | "lost" | "pending";
};

export type WinnerTicket = {
  betId: string;
  stake: number;
  /** Extra win bonus applied on top of the potential winnings, in percent. */
  bonusPct: number;
  legs: WinnerTicketLeg[];
};

export type Winner = {
  id: ID;
  name: string;
  image: string;
  amount: number;
  location: string;
  quote: string;
  at: number;
  active: boolean;
  /** Product the win came from, e.g. "Sports multibet". */
  game?: string;
  /** Real ticket built by the admin from settled results. */
  ticket?: WinnerTicket;
};


export type SiteContent = {
  heroSlides: Slide[];
  slotSlides: Slide[];
  winners: Winner[];
};

export type SiteSettings = {
  siteName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  whatsapp: string;
  currency: string;
  country: string;
  timezone: string;
  minDeposit: number;
  maxDeposit: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  minStake: number;
  maxStake: number;
  maxPayout: number;
  maxSelections: number;
  signupBonus: number;
  referralBonus: number;
  withdrawalFeePct: number;
  maintenanceMode: boolean;
  registrationOpen: boolean;
  liveBetting: boolean;
  casinoEnabled: boolean;
  virtualEnabled: boolean;
  aviatorEnabled: boolean;
  kycRequired: boolean;
  agentPortal: boolean;
  affiliateProgram: boolean;
  mobileMoneyProviders: string;
  license: string;
  address: string;
  allsportsApiKey: string;
};

export type AdminState = {
  users: AdminUser[];
  agents: Agent[];
  partners: Partner[];
  bets: Bet[];
  activities: Activity[];
  transactions: Transaction[];
  affiliates: Affiliate[];
  content: SiteContent;
  settings: SiteSettings;
  siteFloat: number;
};
