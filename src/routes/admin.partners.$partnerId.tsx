import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import {
  BackLink,
  Badge,
  Btn,
  Field,
  Panel,
  Stat,
  dateTime,
  inputCls,
  ugx,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/partners/$partnerId")({
  component: PartnerDetailPage,
});

function PartnerDetailPage() {
  const { partnerId } = Route.useParams();
  const navigate = useNavigate();
  const { state, updatePartner, deletePartner } = useAdmin();
  const partner = state.partners.find((p) => p.id === partnerId);
  const [confirm, setConfirm] = useState(false);

  if (!partner) {
    return (
      <Panel title="Partner not found">
        <BackLink to="/admin/partners" label="Back to partners" />
      </Panel>
    );
  }

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <BackLink to="/admin/partners" label="All partners" />
          <h2 className="text-lg font-black leading-tight text-xb-text">{partner.company}</h2>
          <p className="text-[11px] text-xb-text-muted">
            {partner.id} · {partner.name} · {partner.location}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge value={partner.type} />
          <Badge value={partner.status} />
          {(["active", "pending", "ended"] as const).map((s) => (
            <Btn key={s} size="xs" onClick={() => updatePartner(partner.id, { status: s })}>
              {s}
            </Btn>
          ))}
          {confirm ? (
            <Btn
              size="xs"
              tone="red"
              onClick={() => {
                deletePartner(partner.id);
                toast.success("Partner deleted");
                navigate({ to: "/admin/partners" });
              }}
            >
              Confirm delete
            </Btn>
          ) : (
            <Btn size="xs" tone="red" onClick={() => setConfirm(true)}>
              Delete partner
            </Btn>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Contract value" value={ugx(partner.contractValue)} tone="green" big />
        <Stat label="Type" value={partner.type} />
        <Stat label="Country" value={partner.country} />
        <Stat label="Since" value={dateTime(partner.createdAt).split(",")[0]!} />
      </div>

      <div className="grid gap-2 md:gap-3 xl:grid-cols-2">
        <Panel title="Company details">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["company", "Company name"],
                ["name", "Contact person"],
                ["location", "Location"],
                ["contact", "Contact number"],
                ["email", "Email"],
                ["country", "Country"],
                ["registrationNo", "Registration no."],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <input
                  className={inputCls}
                  value={partner[k]}
                  onChange={(e) => updatePartner(partner.id, { [k]: e.target.value })}
                />
              </Field>
            ))}
            <Field label="Type">
              <select
                className={inputCls}
                value={partner.type}
                onChange={(e) =>
                  updatePartner(partner.id, { type: e.target.value as "Sale" | "Partnership" })
                }
              >
                <option value="Partnership">Partnership</option>
                <option value="Sale">Sale</option>
              </select>
            </Field>
            <Field label="Contract value">
              <input
                type="number"
                className={inputCls}
                value={partner.contractValue}
                onChange={(e) => updatePartner(partner.id, { contractValue: Number(e.target.value) })}
              />
            </Field>
          </div>
        </Panel>
        <Panel title="Management notes">
          <Field label="Notes">
            <textarea
              rows={6}
              className={inputCls}
              value={partner.notes}
              onChange={(e) => updatePartner(partner.id, { notes: e.target.value })}
            />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn onClick={() => toast.success("Contract emailed to partner")}>Email contract</Btn>
            <Btn onClick={() => toast.success("Review scheduled")}>Schedule review</Btn>
            <Btn tone="green" onClick={() => toast.success("Changes saved")}>
              Save changes
            </Btn>
          </div>
        </Panel>
      </div>
    </div>
  );
}
