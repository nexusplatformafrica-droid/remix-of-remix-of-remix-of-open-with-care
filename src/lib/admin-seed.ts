import type {
  Activity,
  AdminState,
  AdminUser,
  Affiliate,
  Agent,
  Bet,
  Partner,
  SiteContent,
  SiteSettings,
  Transaction,
  UserSettings,
} from "./admin-types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const uid = (p = "") =>
  p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

let seedCounter = 0;
const rnd = () => {
  seedCounter = (seedCounter * 1103515245 + 12345) % 2147483648;
  return (seedCounter >>> 8) / 8388608;
};
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length) % arr.length]!;
const int = (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1));

const firstNames = [
  "Joseph","Sarah","Moses","Grace","Brian","Aisha","Ronald","Patricia","Kevin","Esther",
  "Isaac","Winnie","Denis","Sharon","Tony","Rebecca","Samuel","Faith","Peter","Joan",
  "Emmanuel","Doreen","Allan","Miriam","Robert","Sylvia","Ivan","Nakato","Fred","Hadijah",
];
const lastNames = [
  "Okello","Nabbosa","Mugisha","Achieng","Ssemakula","Namuli","Kato","Atim","Byaruhanga",
  "Nakiganda","Tumusiime","Kirabo","Wasswa","Nalubega","Odongo","Kyomuhendo","Lubega","Amanya",
];
const countries = ["Uganda", "Kenya", "Tanzania", "Rwanda", "South Sudan"];
const cities = ["Kampala", "Entebbe", "Jinja", "Mbarara", "Gulu", "Mbale", "Arua", "Masaka"];
const methods = ["MTN Mobile Money", "Airtel Money", "Bank Transfer", "Agent Cash", "Visa Card"];
const leagues = ["Premier League", "La Liga", "Serie A", "Bundesliga", "UEFA Champions League", "CAF CL"];
const teams = [
  "Arsenal","Chelsea","Liverpool","Man City","Man Utd","Tottenham","Real Madrid","Barcelona",
  "Atletico","Juventus","Inter","Milan","Bayern","Dortmund","PSG","Vipers SC","KCCA FC","Express FC",
];
const markets = ["1X2", "Double Chance", "Over/Under 2.5", "Both Teams To Score", "Correct Score"];
const picks = ["Home", "Draw", "Away", "1X", "X2", "Over 2.5", "Under 2.5", "Yes", "No"];
const devices = ["Android / Chrome", "iPhone / Safari", "Windows / Chrome", "Android App", "Mac / Safari"];
const actions = [
  "Viewed match page","Placed a bet","Opened bet slip","Deposited funds","Requested withdrawal",
  "Logged in","Logged out","Opened Aviator","Spun a slot","Changed password","Updated profile",
  "Viewed results","Cashed out bet","Opened lucky winner page","Clicked promotion banner",
];

const defaultUserSettings = (): UserSettings => ({
  emailAlerts: true,
  smsAlerts: true,
  pushAlerts: false,
  twoFactor: false,
  betConfirmation: true,
  oddsChangeAccept: true,
  depositLimit: 2_000_000,
  stakeLimit: 500_000,
  selfExcluded: false,
  language: "English",
  timezone: "Africa/Kampala",
});

function makeUser(i: number): AdminUser {
  const name = `${pick(firstNames)} ${pick(lastNames)}`;
  const totalIn = int(50, 4000) * 1000;
  const totalOut = int(10, Math.max(11, totalIn / 2000)) * 1000;
  const lost = int(5, 900) * 1000;
  return {
    id: `USR-${(1000 + i).toString()}`,
    name,
    phone: `+2567${int(0, 9)}${int(1000000, 9999999)}`,
    idNumber: `CM${int(10, 99)}${int(100000, 999999)}UG${int(10, 99)}`,
    email: `${name.toLowerCase().replace(/[^a-z]/g, ".")}@mail.com`,
    country: pick(countries),
    currency: "UGX",
    balance: int(0, 2500) * 1000,
    totalIn,
    totalOut,
    lostBalance: lost,
    lastSeen: Date.now() - int(1, 6000) * MIN,
    joinedAt: Date.now() - int(20, 700) * DAY,
    status: rnd() > 0.9 ? "blocked" : "active",
    verified: rnd() > 0.3,
    city: pick(cities),
    settings: defaultUserSettings(),
    messages: [],
  };
}

function makeAgent(i: number): Agent {
  const name = `${pick(firstNames)} ${pick(lastNames)}`;
  return {
    id: `AGT-${200 + i}`,
    name,
    idNumber: `CM${int(10, 99)}${int(100000, 999999)}UG`,
    phone: `+2567${int(0, 9)}${int(1000000, 9999999)}`,
    shopName: `BET PLUS+ ${pick(cities)} ${pick(["Central", "Plaza", "Arcade", "Mall", "Stage"])}`,
    shopBranch: pick(cities),
    country: pick(countries),
    status: rnd() > 0.85 ? "blocked" : "active",
    lastSeen: Date.now() - int(1, 4000) * MIN,
    balance: int(50, 6000) * 1000,
    commissionRate: int(3, 9),
    username: name.split(" ")[0]!.toLowerCase() + int(10, 99),
    password: "agent1234",
    createdAt: Date.now() - int(30, 600) * DAY,
  };
}

function makePartner(i: number): Partner {
  const company = `${pick(["Kampala", "Pearl", "Nile", "Savannah", "Equator", "Rwenzori"])} ${pick(["Media", "Sports", "Holdings", "Digital", "Logistics", "Telecom"])} Ltd`;
  return {
    id: `PTR-${300 + i}`,
    name: `${pick(firstNames)} ${pick(lastNames)}`,
    location: `${pick(cities)}, ${pick(["Plot 12 Kampala Rd", "Acacia Avenue", "Industrial Area", "Ntinda Complex"])}`,
    contact: `+2564${int(0, 9)}${int(1000000, 9999999)}`,
    email: `info@${company.split(" ")[0]!.toLowerCase()}.co.ug`,
    country: pick(countries),
    type: rnd() > 0.5 ? "Partnership" : "Sale",
    company,
    registrationNo: `URSB-${int(100000, 999999)}`,
    contractValue: int(500, 12000) * 1000,
    status: pick(["active", "pending", "ended"] as const),
    notes: "Signed agreement on file. Quarterly review scheduled.",
    createdAt: Date.now() - int(10, 500) * DAY,
  };
}

function makeBet(users: AdminUser[]): Bet {
  const user = pick(users);
  const legs = int(1, 5);
  const status = pick(["pending", "pending", "won", "lost", "lost", "cancelled"] as const);
  const matches = Array.from({ length: legs }, () => {
    const a = pick(teams);
    let b = pick(teams);
    if (b === a) b = teams[(teams.indexOf(a) + 3) % teams.length]!;
    return {
      id: uid("LEG-"),
      match: `${a} vs ${b}`,
      league: pick(leagues),
      market: pick(markets),
      pick: pick(picks),
      odds: Number((1.2 + rnd() * 3.4).toFixed(2)),
      startsAt: Date.now() + int(-48, 72) * HOUR,
      status:
        status === "pending"
          ? ("pending" as const)
          : status === "won"
            ? ("won" as const)
            : pick(["won", "lost"] as const),
    };
  });
  return {
    id: uid("BET-"),
    code: `B${int(100000, 999999)}`,
    userId: user.id,
    stake: int(1, 200) * 1000,
    status,
    placedAt: Date.now() - int(5, 9000) * MIN,
    matches,
  };
}

export function betOdds(bet: Bet): number {
  return Number(
    bet.matches
      .filter((m) => m.status !== "void")
      .reduce((acc, m) => acc * m.odds, 1)
      .toFixed(2),
  );
}

export function betPayout(bet: Bet): number {
  return Math.round(bet.stake * betOdds(bet));
}

const defaultSettings = (): SiteSettings => ({
  siteName: "BET PLUS+",
  tagline: "Live sports betting, top odds and casino games.",
  supportEmail: "support@betplus.ug",
  supportPhone: "+256 700 000 000",
  whatsapp: "+256 700 000 001",
  currency: "UGX",
  country: "Uganda",
  timezone: "Africa/Kampala",
  minDeposit: 1000,
  maxDeposit: 5_000_000,
  minWithdrawal: 5000,
  maxWithdrawal: 3_000_000,
  minStake: 500,
  maxStake: 1_000_000,
  maxPayout: 100_000_000,
  maxSelections: 40,
  signupBonus: 5000,
  referralBonus: 2500,
  withdrawalFeePct: 1.5,
  maintenanceMode: false,
  registrationOpen: true,
  liveBetting: true,
  casinoEnabled: true,
  virtualEnabled: true,
  aviatorEnabled: true,
  kycRequired: true,
  agentPortal: true,
  affiliateProgram: true,
  mobileMoneyProviders: "MTN Mobile Money, Airtel Money",
  license: "NLGRB/OP/0142",
  allsportsApiKey: "9e1d457ef257f5c370a7d19fc5b2b2746a3e6b9058a0e60f8ce40cb58fadb966",
  address: "Plot 24 Kampala Road, Kampala, Uganda",
});

const defaultContent = (): SiteContent => ({
  heroSlides: [],
  slotSlides: [],
  winners: [],
});

export function seedState(): AdminState {
  seedCounter = 987654321;
  const users = Array.from({ length: 46 }, (_, i) => makeUser(i));
  const agents = Array.from({ length: 14 }, (_, i) => makeAgent(i));
  const partners = Array.from({ length: 10 }, (_, i) => makePartner(i));
  const bets = Array.from({ length: 60 }, () => makeBet(users)).sort(
    (a, b) => b.placedAt - a.placedAt,
  );

  const affiliates: Affiliate[] = Array.from({ length: 9 }, (_, i) => {
    const name = `${pick(firstNames)} ${pick(lastNames)}`;
    const earnings = int(50, 3000) * 1000;
    return {
      id: `AFF-${400 + i}`,
      name,
      phone: `+2567${int(0, 9)}${int(1000000, 9999999)}`,
      email: `${name.split(" ")[0]!.toLowerCase()}@affiliate.ug`,
      country: pick(countries),
      code: `BP${int(1000, 9999)}`,
      referrals: int(3, 240),
      commissionRate: int(10, 30),
      earnings,
      paidOut: Math.round(earnings * (rnd() * 0.7)),
      status: rnd() > 0.85 ? "suspended" : "active",
      createdAt: Date.now() - int(20, 500) * DAY,
    };
  });

  const activities: Activity[] = Array.from({ length: 120 }, () => {
    const roll = rnd();
    if (roll > 0.78) {
      const a = pick(agents);
      return {
        id: uid("ACT-"),
        at: Date.now() - int(1, 8000) * MIN,
        actorType: "agent" as const,
        actorId: a.id,
        actorName: a.name,
        action: pick(["Deposited for customer", "Cashed out ticket", "Logged in", "Printed ticket"]),
        target: a.shopName,
        ip: `41.${int(60, 220)}.${int(1, 254)}.${int(1, 254)}`,
        device: pick(devices),
      };
    }
    const u = pick(users);
    return {
      id: uid("ACT-"),
      at: Date.now() - int(1, 8000) * MIN,
      actorType: "user" as const,
      actorId: u.id,
      actorName: u.name,
      action: pick(actions),
      target: pick(["/", "/aviator", "/slot", "/results", "/virtual", "/lucky-winner", "Bet slip"]),
      ip: `41.${int(60, 220)}.${int(1, 254)}.${int(1, 254)}`,
      device: pick(devices),
    };
  }).sort((a, b) => b.at - a.at);

  const transactions: Transaction[] = Array.from({ length: 110 }, () => {
    const u = pick(users);
    const kind = pick([
      "Deposit","Deposit","Withdrawal","Bet","Payout","Bonus","Commission","Adjustment",
    ] as const);
    const gross = int(1, 900) * 1000;
    const negative = kind === "Withdrawal" || kind === "Bet";
    return {
      id: uid("TRX-"),
      at: Date.now() - int(1, 9000) * MIN,
      kind,
      amount: negative ? -gross : gross,
      method: pick(methods),
      actorType: "user" as const,
      actorId: u.id,
      actorName: u.name,
      status: pick(["completed", "completed", "completed", "pending", "failed"] as const),
      reference: `REF${int(100000, 999999)}`,
    };
  }).sort((a, b) => b.at - a.at);

  return {
    users,
    agents,
    partners,
    bets,
    activities,
    transactions,
    affiliates,
    content: defaultContent(),
    settings: defaultSettings(),
    siteFloat: 148_500_000,
  };
}

export { defaultUserSettings };
