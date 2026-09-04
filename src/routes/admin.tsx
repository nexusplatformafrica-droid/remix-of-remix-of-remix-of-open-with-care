import { createFileRoute } from "@tanstack/react-router";
import { AdminDataProvider } from "@/components/admin/AdminDataContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/components/xbet/AuthContext";
import { ADMIN_PHONE } from "@/lib/identity";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Dashboard — BET PLUS+" },
      { name: "description", content: "Manage users, agents, partners, bets and payouts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRoot,
});

function AdminRoot() {
  const { loading, isAdmin, user, openLogin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-xb-page text-[13px] text-xb-text-muted">
        Checking your admin access…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-xb-page p-6">
        <div className="w-full max-w-sm rounded-2xl bg-xb-panel p-6 text-center shadow-lg">
          <h1 className="text-[17px] font-black text-xb-text">Admin access only</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-xb-text-muted">
            {user
              ? "This account is not an administrator."
              : `Log in with the administrator phone number (${ADMIN_PHONE}) to open the dashboard.`}
          </p>
          {!user && (
            <button
              onClick={openLogin}
              className="mt-4 w-full rounded-xl bg-xb-green py-2.5 text-[13px] font-bold text-xb-on-dark hover:bg-xb-green-dark"
            >
              LOG IN
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <AdminDataProvider>
      <AdminLayout />
    </AdminDataProvider>
  );
}

