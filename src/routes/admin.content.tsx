import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { WinnerTicketBuilder } from "@/components/admin/WinnerTicketBuilder";
import { SlideForm } from "@/components/admin/SlideForm";
import { Btn, Field, Panel, Stat, inputCls, money } from "@/components/admin/ui";
import type { WinnerTicketLeg } from "@/lib/admin-types";

export const Route = createFileRoute("/admin/content")({ component: ContentPage });

const emptyWinner = {
  name: "",
  image: "",
  quote: "",
  location: "",
  game: "Sports multibet",
  betId: "",
  stake: 1000,
  bonusPct: 0,
};

function ContentPage() {
  const { state, saveSlide, deleteSlide, saveWinner, deleteWinner } = useAdmin();
  const [winner, setWinner] = useState(emptyWinner);
  const [legs, setLegs] = useState<WinnerTicketLeg[]>([]);

  const totalOdds = useMemo(() => legs.reduce((a, l) => a * (l.odds || 1), 1), [legs]);
  const potential = winner.stake * totalOdds;
  const bonus = (potential * (winner.bonusPct || 0)) / 100;
  const payout = potential + bonus;


  const slides = (place: "home" | "slot") => place === "home" ? state.content.heroSlides : state.content.slotSlides;

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Home slides" value={String(slides("home").length)} tone="blue" big />
        <Stat label="Slot slides" value={String(slides("slot").length)} big />
        <Stat label="Lucky winners" value={String(state.content.winners.length)} tone="green" big />
        <Stat label="Total content items" value={String(state.content.heroSlides.length + state.content.slotSlides.length + state.content.winners.length)} />
      </div>

      {(["home", "slot"] as const).map((place) => (
        <Panel key={place} title={place === "home" ? "Homepage hero carousel" : "Slot page hero carousel"}>
          <SlideForm
            onPublish={(slide) => {
              saveSlide(place === "home" ? "heroSlides" : "slotSlides", slide);
              toast.success("Slide published");
            }}
          />
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {slides(place).map((s) => (
              <div key={s.id} className="overflow-hidden rounded-lg border border-xb-line bg-xb-panel-alt">
                <img src={s.image} alt={s.title} className="h-24 w-full object-cover" loading="lazy" />
                <div className="p-2">
                  <p className="truncate text-xs font-black text-xb-text">{s.title}</p>
                  <p className="truncate text-[11px] text-xb-text-muted">{s.subtitle}</p>
                  <p className="truncate text-[10px] text-xb-text-muted">
                    {s.link ? `→ ${s.link}` : "No link"}
                    {s.expiresAt ? ` • expires ${new Date(s.expiresAt).toLocaleString()}` : ""}
                  </p>
                  <div className="mt-1 flex gap-1">
                    <Btn size="xs" tone="red" onClick={() => { deleteSlide(place === "home" ? "heroSlides" : "slotSlides", s.id); toast.success("Slide deleted"); }}>
                      Delete
                    </Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ))}

      <Panel title="Lucky winner stories">
        <div className="grid gap-2 rounded-lg bg-xb-panel-alt p-2 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Winner name">
            <input className={inputCls} value={winner.name} onChange={(e) => setWinner({ ...winner, name: e.target.value })} />
          </Field>
          <Field label="Photo URL">
            <input className={inputCls} value={winner.image} onChange={(e) => setWinner({ ...winner, image: e.target.value })} />
          </Field>
          <Field label="Location">
            <input className={inputCls} value={winner.location} onChange={(e) => setWinner({ ...winner, location: e.target.value })} />
          </Field>
          <Field label="Product / game">
            <input className={inputCls} value={winner.game} onChange={(e) => setWinner({ ...winner, game: e.target.value })} />
          </Field>
          <Field label="Winner talk / quote">
            <input className={inputCls} value={winner.quote} onChange={(e) => setWinner({ ...winner, quote: e.target.value })} />
          </Field>
          <Field label="Bet ID (printed on ticket)">
            <input className={inputCls} value={winner.betId} onChange={(e) => setWinner({ ...winner, betId: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Stake (UGX)">
            <input type="number" className={inputCls} value={winner.stake} onChange={(e) => setWinner({ ...winner, stake: Number(e.target.value) })} />
          </Field>
          <Field label="Win bonus %">
            <input type="number" className={inputCls} value={winner.bonusPct} onChange={(e) => setWinner({ ...winner, bonusPct: Number(e.target.value) })} />
          </Field>
          <div className="rounded-lg bg-xb-panel p-2 text-[11px] text-xb-text-muted">
            <p>Total odds: <span className="font-black text-xb-text">{totalOdds.toFixed(2)}</span></p>
            <p>Potential: <span className="font-black text-xb-text">{money(potential)} UGX</span></p>
            <p>Bonus: <span className="font-black text-xb-text">{money(bonus)} UGX</span></p>
            <p>Payout: <span className="font-black text-xb-green">{money(payout)} UGX</span></p>
          </div>
        </div>

        <div className="mt-2">
          <WinnerTicketBuilder legs={legs} onChange={setLegs} />
        </div>

        <div className="mt-2">
          <Btn
            tone="green"
            onClick={() => {
              if (!winner.name.trim()) {
                toast.error("Winner name required");
                return;
              }
              if (legs.length === 0) {
                toast.error("Add at least one match from results");
                return;
              }
              saveWinner({
                id: `WN${Date.now()}`,
                at: Date.now(),
                active: true,
                name: winner.name,
                image: winner.image,
                location: winner.location,
                quote: winner.quote,
                game: winner.game || "Sports multibet",
                amount: Math.round(payout),
                ticket: {
                  betId: winner.betId.trim() || `BP${Date.now().toString(36).toUpperCase()}`,
                  stake: winner.stake,
                  bonusPct: winner.bonusPct,
                  legs,
                },
              });
              setWinner(emptyWinner);
              setLegs([]);
              toast.success("Winner published");
            }}
          >
            Publish winner
          </Btn>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {state.content.winners.map((w) => (
            <div key={w.id} className="overflow-hidden rounded-lg border border-xb-line bg-xb-panel-alt">
              {w.image ? <img src={w.image} alt={w.name} className="h-24 w-full object-cover" loading="lazy" /> : null}
              <div className="p-2">
                <p className="text-xs font-black text-xb-text">{w.name}</p>
                <p className="text-[11px] text-xb-green">{w.amount.toLocaleString()} UGX</p>
                <p className="line-clamp-2 text-[11px] text-xb-text-muted">{w.quote}</p>
                <Btn size="xs" tone="red" onClick={() => { deleteWinner(w.id); toast.success("Winner removed"); }}>
                  Delete
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
