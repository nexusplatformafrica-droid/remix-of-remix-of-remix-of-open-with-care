import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Btn, Field, inputCls } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { matchesQuery } from "@/lib/sports-queries";
import { ugDateTime } from "@/lib/time";
import type { Slide } from "@/lib/admin-types";

type Target =
  | "none"
  | "lucky"
  | "winner"
  | "aviator"
  | "slot"
  | "virtual"
  | "match"
  | "custom";

const TARGETS: { key: Target; label: string; to?: string }[] = [
  { key: "none", label: "No link" },
  { key: "lucky", label: "Lucky winner page", to: "/lucky-winner" },
  { key: "winner", label: "A specific winner page" },
  { key: "aviator", label: "Aviator game", to: "/aviator" },
  { key: "slot", label: "Slots page", to: "/slot" },
  { key: "virtual", label: "Virtual games", to: "/virtual" },
  { key: "match", label: "Upcoming real match" },
  { key: "custom", label: "Custom URL" },
];

const emptyForm = { title: "", subtitle: "", image: "" };

/** Slide upload form with a real link target picker and an expiry date. */
export function SlideForm({ onPublish }: { onPublish: (slide: Slide) => void }) {
  const [form, setForm] = useState(emptyForm);
  const [target, setTarget] = useState<Target>("none");
  const [custom, setCustom] = useState("");
  const [matchId, setMatchId] = useState("");
  const [winnerId, setWinnerId] = useState("");
  const [sport, setSport] = useState<"football" | "basketball" | "tennis">("football");
  const [expires, setExpires] = useState("");

  const { state } = useAdmin();
  const winners = state.content.winners ?? [];

  const matches = useQuery({
    ...matchesQuery({ sport, scope: "upcoming" }),
    enabled: target === "match",
  });

  const options = useMemo(() => (matches.data ?? []).slice(0, 200), [matches.data]);

  const link = useMemo(() => {
    if (target === "custom") return custom.trim();
    if (target === "match") return matchId ? `/match/${matchId}?sport=${sport}` : "";
    if (target === "winner") return winnerId ? `/winner/${winnerId}` : "";
    return TARGETS.find((t) => t.key === target)?.to ?? "";
  }, [target, custom, matchId, sport, winnerId]);

  return (
    <div className="grid gap-2 rounded-lg bg-xb-panel-alt p-2 sm:grid-cols-2">
      <Field label="Title">
        <input
          className={inputCls}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </Field>
      <Field label="Subtitle">
        <input
          className={inputCls}
          value={form.subtitle}
          onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
        />
      </Field>
      <Field label="Image URL">
        <input
          className={inputCls}
          value={form.image}
          onChange={(e) => setForm({ ...form, image: e.target.value })}
        />
      </Field>

      <Field label="Link to">
        <select
          className={inputCls}
          value={target}
          onChange={(e) => setTarget(e.target.value as Target)}
        >
          {TARGETS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      {target === "winner" && (
        <Field label="Published winner">
          <select
            className={inputCls}
            value={winnerId}
            onChange={(e) => setWinnerId(e.target.value)}
          >
            <option value="">
              {winners.length === 0 ? "No winners published yet" : "Select a winner"}
            </option>
            {winners.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} — {w.amount.toLocaleString()} ({w.location})
              </option>
            ))}
          </select>
        </Field>
      )}


      {target === "custom" && (
        <Field label="Custom URL or path">
          <input
            className={inputCls}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="/promotions or https://…"
          />
        </Field>
      )}

      {target === "match" && (
        <>
          <Field label="Sport">
            <select
              className={inputCls}
              value={sport}
              onChange={(e) => {
                setSport(e.target.value as typeof sport);
                setMatchId("");
              }}
            >
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
              <option value="tennis">Tennis</option>
            </select>
          </Field>
          <Field label="Upcoming match (live API)">
            <select className={inputCls} value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              <option value="">
                {matches.isLoading ? "Loading upcoming matches…" : "Select a match"}
              </option>
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {ugDateTime(m.date, m.time)} — {m.home} vs {m.away} ({m.league})
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      <Field label="Expires on (optional)">
        <input
          type="datetime-local"
          className={inputCls}
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
        />
      </Field>

      <div className="flex items-end">
        <Btn
          tone="green"
          onClick={() => {
            if (!form.title.trim() || !form.image.trim()) {
              toast.error("Title and image URL are required");
              return;
            }
            if (target === "match" && !matchId) {
              toast.error("Pick an upcoming match to link to");
              return;
            }
            if (target === "custom" && !custom.trim()) {
              toast.error("Enter the custom URL");
              return;
            }
            if (target === "winner" && !winnerId) {
              toast.error("Pick the winner this slide should open");
              return;
            }
            const expiresAt = expires ? new Date(expires).getTime() : undefined;
            if (expires && Number.isNaN(expiresAt)) {
              toast.error("Invalid expiry date");
              return;
            }
            onPublish({
              id: `SL${Date.now()}`,
              cta: "Bet now",
              active: true,
              title: form.title,
              subtitle: form.subtitle,
              image: form.image,
              link,
              ...(expiresAt ? { expiresAt } : {}),
            });
            setForm(emptyForm);
            setTarget("none");
            setCustom("");
            setMatchId("");
            setWinnerId("");
            setExpires("");
          }}
        >
          Upload slide
        </Btn>
      </div>
    </div>
  );
}
