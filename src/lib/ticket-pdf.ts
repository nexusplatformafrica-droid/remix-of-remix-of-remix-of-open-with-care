export type LegStatus = "won" | "lost" | "pending";

export type TicketLeg = {
  time: string;
  teams: string;
  league: string;
  market: string;
  odds: string;
  score: string;
  /** Settlement state — drives the colour of the small status box. */
  status?: LegStatus;
};

export type TicketPdfInput = {
  betId: string;
  winner: string;
  game: string;
  date: string;
  odds: string;
  stake: string;
  potential: string;
  bonus: string;
  payout: string;
  legs: TicketLeg[];
  /** Overall ticket state. Defaults to "won". */
  status?: LegStatus;
  /** Absolute URL the barcode should resolve to (opens the ticket preview). */
  ticketUrl: string;
  /** Barcode payload (short, alphanumeric) used by shop scanners. */
  barcodeValue: string;
};

const safeName = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "ticket";

/** Brand palette (matches the app design tokens). */
const C = {
  blue: [34, 102, 164] as const,
  blueLight: [52, 141, 207] as const,
  green: [114, 172, 54] as const,
  silver: [163, 172, 181] as const,
  red: [199, 58, 58] as const,
  redSoft: [253, 233, 233] as const,
  text: [33, 42, 51] as const,
  muted: [105, 115, 125] as const,
  line: [213, 219, 227] as const,
  panelAlt: [240, 244, 249] as const,
  white: [255, 255, 255] as const,
};

const statusColor = (s: LegStatus | undefined) =>
  s === "lost" ? C.red : s === "pending" ? C.silver : C.green;


async function toDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function barcodeDataUrl(value: string): Promise<string | null> {
  try {
    const mod = await import("jsbarcode");
    const JsBarcode = (mod as unknown as { default: (el: unknown, v: string, o?: unknown) => void })
      .default;
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, {
      format: "CODE128",
      width: 2,
      height: 90,
      displayValue: true,
      fontSize: 16,
      font: "helvetica",
      textMargin: 4,
      margin: 8,
      lineColor: "#212a33",
      background: "#ffffff",
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

async function qrDataUrl(value: string): Promise<string | null> {
  try {
    const QR = await import("qrcode");
    return await QR.toDataURL(value, { margin: 1, width: 320, color: { dark: "#212a33ff", light: "#ffffffff" } });
  } catch {
    return null;
  }
}

/** Builds a receipt-style PDF of a ticket and floats it inside the app. */
export async function openTicketPdf(t: TicketPdfInput): Promise<void> {
  const ticketStatus: LegStatus = t.status ?? "won";
  const mainColor = statusColor(ticketStatus);

  const { jsPDF } = await import("jspdf");

  const W = 420;
  const M = 16;
  const LEG_H = 62;
  const H =
    56 /* header */ +
    76 /* congrats */ +
    120 /* summary */ +
    t.legs.length * LEG_H +
    155 /* scan block */ +
    40;

  const doc = new jsPDF({ unit: "pt", format: [W, H] });
  const inner = W - M * 2;
  let y = 0;

  const setColor = (c: readonly number[]) => doc.setTextColor(c[0]!, c[1]!, c[2]!);
  const fill = (c: readonly number[]) => doc.setFillColor(c[0]!, c[1]!, c[2]!);
  const clip = (s: string, size: number, max: number) => {
    doc.setFontSize(size);
    let out = s;
    while (doc.getTextWidth(out) > max && out.length > 4) out = out.slice(0, -2);
    return out === s ? s : `${out}…`;
  };

  const [imgData, barData, qrData] = await Promise.all([
    toDataUrl("/games/winner-celebration.png"),
    barcodeDataUrl(t.barcodeValue),
    qrDataUrl(t.ticketUrl),
  ]);

  /* ---------- header bar (brand colour) ---------- */
  fill(C.blue);
  doc.rect(0, 0, W, 46, "F");
  doc.setFont("helvetica", "bold").setFontSize(15);
  setColor(C.white);
  doc.text("BET", M, 28);
  const betW = doc.getTextWidth("BET");
  setColor(C.blueLight);
  doc.text("PLUS+", M + betW + 2, 28);
  doc.setFontSize(12);
  setColor(C.white);
  doc.text(`BET ID #${t.betId}`, W - M, 28, { align: "right" });
  y = 46;

  /* ---------- congratulations banner ---------- */
  fill(C.panelAlt);
  doc.rect(0, y, W, 72, "F");
  if (imgData) {
    try {
      doc.addImage(imgData, "PNG", M, y + 6, 60, 60);
    } catch {
      /* ignore */
    }
  }
  const tx = M + (imgData ? 70 : 0);
  doc.setFont("helvetica", "normal").setFontSize(10);
  setColor(C.muted);
  doc.text(
    ticketStatus === "won"
      ? "Congratulations on"
      : ticketStatus === "pending"
        ? "Your ticket is"
        : "Unfortunately this ticket is",
    tx,
    y + 28,
  );
  doc.setFont("helvetica", "bold").setFontSize(13);
  setColor(C.text);
  doc.text(
    ticketStatus === "won" ? "WINNING BIG" : ticketStatus === "pending" ? "STILL RUNNING" : "NOT A WINNER",
    tx,
    y + 46,
  );
  setColor(mainColor);
  doc.text(`UGX ${t.payout}`, tx, y + 62);
  y += 72;


  /* ---------- summary box ---------- */
  y += 10;
  const boxTop = y;
  const rows: [string, string, boolean][] = [
    ["Odds:", t.odds, false],
    ["Stake:", `UGX ${t.stake}`, false],
    ["Potential Winnings:", `UGX ${t.potential}`, true],
    ["Win Bonus:", `UGX ${t.bonus}`, true],
    [
      "Payout:",
      `${ticketStatus === "won" ? "WON" : ticketStatus === "pending" ? "POSSIBLE" : "LOST"} UGX ${t.payout}`,
      true,
    ],
  ];
  const boxH = rows.length * 19 + 14;
  doc.setDrawColor(C.blueLight[0], C.blueLight[1], C.blueLight[2]).setLineWidth(1.2);
  fill(C.white);
  doc.roundedRect(M, boxTop, inner, boxH, 4, 4, "FD");
  let ry = boxTop + 21;
  for (const [k, v, strong] of rows) {
    const payout = k === "Payout:";
    doc.setFont("helvetica", strong ? "bold" : "normal").setFontSize(10);
    setColor(payout ? C.text : strong ? C.text : C.muted);
    doc.text(k, M + 10, ry);
    setColor(payout ? mainColor : C.text);
    doc.text(v, W - M - 10, ry, { align: "right" });
    ry += 19;
  }
  y = boxTop + boxH + 10;

  /* ---------- winner meta strip ---------- */
  doc.setFont("helvetica", "normal").setFontSize(9);
  setColor(C.muted);
  doc.text(`${t.winner} • ${t.game}`, M, y + 4);
  doc.text(t.date, W - M, y + 4, { align: "right" });
  y += 16;
  doc.setDrawColor(C.line[0], C.line[1], C.line[2]).setLineWidth(0.8);
  doc.line(M, y, W - M, y);

  /* ---------- legs ---------- */
  for (const leg of t.legs) {
    const legStatus: LegStatus = leg.status ?? "won";
    const legColor = statusColor(legStatus);
    // Lost legs get a soft red highlight behind the whole row.
    if (legStatus === "lost") {
      fill(C.redSoft);
      doc.rect(M - 6, y + 3, inner + 12, LEG_H - 4, "F");
    }
    y += 15;
    doc.setFont("helvetica", "bold").setFontSize(9.5);
    setColor(legStatus === "lost" ? C.red : C.text);
    doc.text(leg.time, M, y);
    setColor(legColor);
    doc.text(leg.odds, W - M - 16, y, { align: "right" });
    fill(legColor);
    doc.rect(W - M - 10, y - 8, 10, 10, "F");
    y += 14;
    doc.setFont("helvetica", "normal").setFontSize(9.5);
    setColor(legStatus === "lost" ? C.red : C.text);
    doc.text(clip(leg.teams, 9.5, inner - 40), M, y);
    doc.setFont("helvetica", "bold").setFontSize(9.5);
    doc.text(leg.score, W - M, y, { align: "right" });
    y += 12;
    doc.setFont("helvetica", "normal").setFontSize(8);
    setColor(legStatus === "lost" ? C.red : C.muted);
    doc.text(clip(leg.league, 8, inner), M, y);
    y += 11;
    doc.setFont("helvetica", "bold").setFontSize(8);
    setColor(legStatus === "lost" ? C.red : C.text);
    doc.text(clip(leg.market, 8, inner), M, y);
    y += 10;
    doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
    doc.line(M, y, W - M, y);
  }


  /* ---------- barcode block ---------- */
  y += 18;
  fill(C.panelAlt);
  doc.rect(0, y, W, H - y, "F");
  y += 20;
  doc.setFont("helvetica", "bold").setFontSize(10);
  setColor(C.blue);
  doc.text("SCAN TO OPEN TICKET & PAY", W / 2, y, { align: "center" });
  y += 8;
  const qrSize = 92;
  const barW = inner - 20 - qrSize - 12;
  const barH = 74;
  fill(C.white);
  doc.roundedRect(M + 10, y, barW, barH + 12, 4, 4, "F");
  if (barData) {
    try {
      doc.addImage(barData, "PNG", M + 14, y + 6, barW - 8, barH);
    } catch {
      /* ignore */
    }
  }
  fill(C.white);
  doc.roundedRect(W - M - 10 - qrSize, y, qrSize, barH + 12, 4, 4, "F");
  if (qrData) {
    try {
      doc.addImage(qrData, "PNG", W - M - 10 - qrSize + 8, y + 8, qrSize - 16, qrSize - 16);
    } catch {
      /* ignore */
    }
  }
  y += barH + 26;

  doc.setFont("helvetica", "normal").setFontSize(7.5);
  setColor(C.muted);
  doc.text(clip(t.ticketUrl, 7.5, inner), W / 2, y, { align: "center" });
  y += 14;
  doc.setFontSize(7.5);
  doc.text("Present this ticket in any BET PLUS+ shop to be paid.", W / 2, y, { align: "center" });

  const blob = doc.output("blob");
  const name = `${safeName(t.winner)}-${safeName(t.betId)}.pdf`;
  const file = new File([blob], name, { type: "application/pdf" });
  const url = URL.createObjectURL(file);
  // Float the ticket inside the app instead of opening a new browser tab.
  window.dispatchEvent(
    new CustomEvent(TICKET_PDF_EVENT, {
      detail: { url, name, title: `BET ID #${t.betId}`, status: ticketStatus },
    }),
  );
}

export const TICKET_PDF_EVENT = "xb:ticket-pdf";

export type TicketPdfEventDetail = {
  url: string;
  name: string;
  title: string;
  status: LegStatus;
};

