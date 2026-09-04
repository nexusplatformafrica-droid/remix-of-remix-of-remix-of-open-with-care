import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { Btn, Empty, Panel, Stat, Table, downloadCsv, inputCls, timeAgo } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/activities/")({
  component: ActivitiesPage,
});

const types = ["all", "user", "agent", "admin", "affiliate"] as const;

function ActivitiesPage() {
  const { state, deleteActivity, clearActivities } = useAdmin();
  const [q, setQ] = useState("");
  const [type, setType] = useState<(typeof types)[number]>("all");

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return state.activities.filter((a) => {
      if (type !== "all" && a.actorType !== type) return false;
      if (!n) return true;
      return [a.actorName, a.action, a.target, a.ip, a.device].some((v) => v.toLowerCase().includes(n));
    });
  }, [state.activities, q, type]);

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Events logged" value={String(state.activities.length)} big />
        <Stat label="By players" value={String(state.activities.filter((a) => a.actorType === "user").length)} />
        <Stat label="By agents" value={String(state.activities.filter((a) => a.actorType === "agent").length)} />
        <Stat label="By admin" value={String(state.activities.filter((a) => a.actorType === "admin").length)} tone="blue" />
      </div>

      <Panel
        title={`Activity feed (${list.length})`}
        action={
          <div className="flex gap-1">
            <Btn
              size="xs"
              onClick={() =>
                downloadCsv("activities.csv", [
                  ["When", "Actor", "Type", "Action", "Target", "IP", "Device"],
                  ...list.map((a) => [
                    new Date(a.at).toISOString(),
                    a.actorName,
                    a.actorType,
                    a.action,
                    a.target,
                    a.ip,
                    a.device,
                  ]),
                ])
              }
            >
              Export
            </Btn>
            <Btn
              size="xs"
              tone="red"
              onClick={() => {
                clearActivities();
                toast.success("Activity log cleared");
              }}
            >
              Clear log
            </Btn>
          </div>
        }
      >
        <div className="mb-2 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor, action, page, IP…"
            className={`${inputCls} min-w-[200px] flex-1`}
          />
          <div className="flex flex-wrap gap-1">
            {types.map((t) => (
              <Btn key={t} size="xs" tone={type === t ? "primary" : "default"} onClick={() => setType(t)}>
                {t}
              </Btn>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <Empty text="Nothing logged yet." />
        ) : (
          <Table head={["When", "Actor", "Role", "Action", "Target", "Device", ""]}>
            {list.slice(0, 200).map((a) => (
              <tr key={a.id} className="border-b border-xb-line/60 last:border-0 hover:bg-xb-panel-alt">
                <td className="px-2 py-1.5 text-xb-text-muted">{timeAgo(a.at)}</td>
                <td className="px-2 py-1.5 font-bold">{a.actorName}</td>
                <td className="px-2 py-1.5 capitalize text-xb-text-muted">{a.actorType}</td>
                <td className="px-2 py-1.5">{a.action}</td>
                <td className="px-2 py-1.5 text-xb-text-muted">{a.target}</td>
                <td className="px-2 py-1.5 text-xb-text-muted">{a.device}</td>
                <td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    <Link
                      to="/admin/activities/$activityId"
                      params={{ activityId: a.id }}
                      className="rounded bg-xb-odds px-2 py-1 text-[10px] font-bold"
                    >
                      Open
                    </Link>
                    <Btn size="xs" tone="ghost" onClick={() => deleteActivity(a.id)}>
                      Delete
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
