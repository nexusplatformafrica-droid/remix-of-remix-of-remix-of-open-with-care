import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import {
  Badge,
  Btn,
  Empty,
  Panel,
  Stat,
  Table,
  dateTime,
  downloadCsv,
  inputCls,
  timeAgo,
  ugx,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/users/")({
  component: UsersPage,
});

const filters = ["all", "active", "blocked", "online"] as const;

function UsersPage() {
  const { state, deleteUser, adjustUserBalance } = useAdmin();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAmount, setBulkAmount] = useState(10000);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.users.filter((u) => {
      if (filter === "active" && u.status !== "active") return false;
      if (filter === "blocked" && u.status !== "blocked") return false;
      if (filter === "online" && Date.now() - u.lastSeen > 15 * 60_000) return false;
      if (!needle) return true;
      return [u.name, u.phone, u.email, u.idNumber, u.id, u.country].some((v) =>
        v.toLowerCase().includes(needle),
      );
    });
  }, [state.users, q, filter]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const targets = selected.length ? selected : list.map((u) => u.id);

  const bulk = (sign: 1 | -1) => {
    if (!bulkAmount) return;
    targets.forEach((id) =>
      adjustUserBalance(id, sign * bulkAmount, "Admin bulk adjustment", "Bulk wallet update"),
    );
    toast.success(
      `${sign > 0 ? "Credited" : "Debited"} ${ugx(bulkAmount)} for ${targets.length} user(s)`,
    );
    setSelected([]);
  };

  const totalBalance = list.reduce((a, u) => a + u.balance, 0);

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Users shown" value={String(list.length)} />
        <Stat label="Wallet total" value={ugx(totalBalance)} tone="green" big />
        <Stat
          label="Online now"
          value={String(state.users.filter((u) => Date.now() - u.lastSeen < 15 * 60_000).length)}
          tone="blue"
        />
        <Stat
          label="Blocked"
          value={String(state.users.filter((u) => u.status === "blocked").length)}
          tone="red"
        />
      </div>

      <Panel
        title={`Users (${list.length})`}
        action={
          <Btn
            size="xs"
            onClick={() =>
              downloadCsv("users.csv", [
                ["ID", "Name", "Phone", "ID number", "Email", "Country", "Balance", "Last seen"],
                ...list.map((u) => [
                  u.id,
                  u.name,
                  u.phone,
                  u.idNumber,
                  u.email,
                  u.country,
                  u.balance,
                  dateTime(u.lastSeen),
                ]),
              ])
            }
          >
            <Download className="h-3 w-3" /> Export
          </Btn>
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-xb-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, email, ID number…"
              className={`${inputCls} pl-7`}
            />
          </div>
          <div className="flex gap-1">
            {filters.map((f) => (
              <Btn key={f} size="xs" tone={filter === f ? "primary" : "default"} onClick={() => setFilter(f)}>
                {f}
              </Btn>
            ))}
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-xb-panel-alt p-2">
          <span className="text-[10px] font-bold uppercase text-xb-text-muted">
            {selected.length ? `${selected.length} selected` : `All ${list.length} shown`}
          </span>
          <input
            type="number"
            value={bulkAmount}
            onChange={(e) => setBulkAmount(Number(e.target.value))}
            className={`${inputCls} w-28`}
          />
          <Btn size="xs" tone="green" onClick={() => bulk(1)}>
            Add money
          </Btn>
          <Btn size="xs" tone="red" onClick={() => bulk(-1)}>
            Remove money
          </Btn>
          {selected.length > 0 && (
            <Btn size="xs" tone="ghost" onClick={() => setSelected([])}>
              Clear selection
            </Btn>
          )}
        </div>

        {list.length === 0 ? (
          <Empty text="No users match your search." />
        ) : (
          <Table
            head={[
              "",
              "Name",
              "Phone",
              "ID number",
              "Email",
              "Country",
              "Balance",
              "Last seen",
              "Status",
              "",
            ]}
          >
            {list.map((u) => (
              <tr
                key={u.id}
                className="cursor-pointer border-b border-xb-line/60 last:border-0 hover:bg-xb-panel-alt"
                onClick={() => navigate({ to: "/admin/users/$userId", params: { userId: u.id } })}
              >
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.includes(u.id)}
                    onChange={() => toggle(u.id)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <span className="font-bold text-xb-text">{u.name}</span>
                  <span className="block text-[10px] text-xb-text-muted">{u.id}</span>
                </td>
                <td className="px-2 py-1.5">{u.phone}</td>
                <td className="px-2 py-1.5">{u.idNumber}</td>
                <td className="max-w-[180px] truncate px-2 py-1.5 text-xb-text-muted">{u.email}</td>
                <td className="px-2 py-1.5">{u.country}</td>
                <td className="px-2 py-1.5 font-bold text-xb-green">{ugx(u.balance)}</td>
                <td className="px-2 py-1.5 text-xb-text-muted">{timeAgo(u.lastSeen)}</td>
                <td className="px-2 py-1.5">
                  <Badge value={u.status} />
                </td>
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: u.id }}
                      className="rounded bg-xb-odds px-2 py-1 text-[10px] font-bold"
                    >
                      Open
                    </Link>
                    <Btn
                      size="xs"
                      tone="red"
                      onClick={() => {
                        deleteUser(u.id);
                        toast.success(`${u.name} deleted`);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
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
