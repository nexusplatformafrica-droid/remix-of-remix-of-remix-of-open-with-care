import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { BackLink, Btn, Field, Panel, dateTime, inputCls } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/activities/$activityId")({
  component: ActivityDetailPage,
});

function ActivityDetailPage() {
  const { activityId } = Route.useParams();
  const navigate = useNavigate();
  const { state, updateActivity, deleteActivity } = useAdmin();
  const act = state.activities.find((a) => a.id === activityId);

  if (!act) {
    return (
      <Panel title="Activity not found">
        <BackLink to="/admin/activities" label="Back to activities" />
      </Panel>
    );
  }

  const owner =
    act.actorType === "user"
      ? state.users.find((u) => u.id === act.actorId)
      : undefined;
  const agent = act.actorType === "agent" ? state.agents.find((a) => a.id === act.actorId) : undefined;

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <BackLink to="/admin/activities" label="All activities" />
          <h2 className="text-lg font-black text-xb-text">{act.action}</h2>
          <p className="text-[11px] text-xb-text-muted">
            {act.actorName} · {act.actorType} · {dateTime(act.at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {owner && (
            <Link
              to="/admin/users/$userId"
              params={{ userId: owner.id }}
              className="rounded-lg bg-xb-blue px-3 py-1.5 text-[11px] font-bold text-xb-on-dark"
            >
              Open owner profile
            </Link>
          )}
          {agent && (
            <Link
              to="/admin/agents/$agentId"
              params={{ agentId: agent.id }}
              className="rounded-lg bg-xb-blue px-3 py-1.5 text-[11px] font-bold text-xb-on-dark"
            >
              Open agent profile
            </Link>
          )}
          <Btn
            size="xs"
            tone="red"
            onClick={() => {
              deleteActivity(act.id);
              toast.success("Activity deleted");
              navigate({ to: "/admin/activities" });
            }}
          >
            Delete
          </Btn>
        </div>
      </div>

      <Panel title="Event details">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Action">
            <input
              className={inputCls}
              value={act.action}
              onChange={(e) => updateActivity(act.id, { action: e.target.value })}
            />
          </Field>
          <Field label="Target">
            <input
              className={inputCls}
              value={act.target}
              onChange={(e) => updateActivity(act.id, { target: e.target.value })}
            />
          </Field>
          <Field label="IP address">
            <input
              className={inputCls}
              value={act.ip}
              onChange={(e) => updateActivity(act.id, { ip: e.target.value })}
            />
          </Field>
          <Field label="Device">
            <input
              className={inputCls}
              value={act.device}
              onChange={(e) => updateActivity(act.id, { device: e.target.value })}
            />
          </Field>
        </div>
      </Panel>
    </div>
  );
}
