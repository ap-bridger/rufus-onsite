import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  BANK_ACCOUNTS,
  TRANSACTIONS,
  CATEGORIES,
  VENDORS,
  CATEGORIZE_ALL,
  UPDATE_TRANSACTION,
  ACCEPT_ALL,
  SEND_EMAIL,
} from "./TransactionsTable.api";

const fmt = (cents: number) => {
  const v = (Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `-$${v}` : `$${v}`;
};

// Left-accent + subtle tint: email sent (amber) wins, else confidence (green/red).
const rowAccent = (t: any) => {
  if (t.status === "SENT") return "border-l-amber-400 bg-amber-50/40";
  if (t.confidence === "HIGH") return "border-l-emerald-400 bg-emerald-50/30";
  if (t.confidence === "LOW") return "border-l-rose-400 bg-rose-50/30";
  return "border-l-transparent";
};

const statusPill: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  SENT: "bg-amber-100 text-amber-700",
};

const selectCls =
  "border border-slate-300 rounded-md px-2 py-1 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition";

export const TransactionsTable = ({ clientId }: { clientId: string }) => {
  const { data: bankData } = useQuery(BANK_ACCOUNTS, { variables: { clientId } });
  const accounts = bankData?.bankAccounts ?? [];
  const [accountId, setAccountId] = useState<string | null>(null);
  const activeAccount = accountId ?? accounts[0]?.id ?? null;

  const { data: catData } = useQuery(CATEGORIES, { variables: { clientId } });
  const { data: venData } = useQuery(VENDORS, { variables: { clientId } });
  const { data, loading, error } = useQuery(TRANSACTIONS, {
    variables: { bankAccountId: activeAccount },
    skip: !activeAccount,
  });

  const refetchQueries = activeAccount ? [{ query: TRANSACTIONS, variables: { bankAccountId: activeAccount } }] : [];
  const swallow = (m: any) => (...a: any[]) => m(...a).catch(() => {}); // mutations are backend-pending
  const [categorizeAll, { loading: categorizing }] = useMutation(CATEGORIZE_ALL, { refetchQueries });
  const [acceptAll, { loading: accepting }] = useMutation(ACCEPT_ALL, { refetchQueries });
  const [sendEmail, { loading: sending }] = useMutation(SEND_EMAIL, { refetchQueries });
  const [updateTransaction] = useMutation(UPDATE_TRANSACTION, { refetchQueries });

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const categories = catData?.categories ?? [];
  const vendors = venData?.vendors ?? [];
  const catName = (id: string | null) => categories.find((c: any) => c.id === id)?.name ?? null;
  const venName = (id: string | null) => vendors.find((v: any) => v.id === id)?.name ?? null;

  const txns = data?.transactions ?? [];
  const allIds = txns.map((t: any) => t.id);
  const selectedIds = [...selected];

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => (s.size === txns.length ? new Set() : new Set(allIds)));

  const vendorValue = (t: any) => {
    if (t.finalVendorId) return t.finalVendorId;
    if (t.finalNewVendorName) return `new:${t.finalNewVendorName}`;
    if (t.aiVendorId) return t.aiVendorId;
    if (t.aiNewVendorName) return `new:${t.aiNewVendorName}`;
    return "";
  };
  const onVendorChange = (id: string, value: string) =>
    value.startsWith("new:")
      ? swallow(updateTransaction)({ variables: { id, finalNewVendorName: value.slice(4) } })
      : swallow(updateTransaction)({ variables: { id, finalVendorId: value } });

  const dot = (cls: string) => <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;

  return (
    <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Transactions</h2>
          <select className={selectCls} value={activeAccount ?? ""} onChange={(e) => { setAccountId(e.target.value); setSelected(new Set()); }}>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => swallow(categorizeAll)({ variables: { ids: allIds } })}
            disabled={categorizing || allIds.length === 0}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm disabled:opacity-40 transition">
            {categorizing ? "Categorizing…" : "Categorize All"}
          </button>
          <button onClick={() => swallow(acceptAll)({ variables: { ids: selectedIds } }).then?.(() => setSelected(new Set()))}
            disabled={accepting || selectedIds.length === 0}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm disabled:opacity-40 transition">
            Approve ({selectedIds.length})
          </button>
          <button onClick={() => swallow(sendEmail)({ variables: { ids: selectedIds } }).then?.(() => setSelected(new Set()))}
            disabled={sending || selectedIds.length === 0}
            className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium shadow-sm disabled:opacity-40 transition">
            Request Info ({selectedIds.length})
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-2 bg-slate-50 text-xs text-slate-500 border-b border-slate-100">
        <span className="flex items-center gap-1.5">{dot("bg-emerald-400")} High confidence</span>
        <span className="flex items-center gap-1.5">{dot("bg-rose-400")} Low — needs review</span>
        <span className="flex items-center gap-1.5">{dot("bg-amber-400")} Info requested</span>
      </div>

      {loading && <div className="p-10 text-center text-slate-400">Loading…</div>}
      {error && <div className="p-10 text-center text-rose-600">Error: {error.message}</div>}

      {!loading && !error && (
        <table className="w-full text-sm">
          <thead className="bg-white text-slate-400 text-left text-xs uppercase tracking-wide">
            <tr className="border-b border-slate-100">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" className="accent-indigo-600" checked={txns.length > 0 && selected.size === txns.length} onChange={toggleAll} />
              </th>
              <th className="px-3 py-3 font-medium">Description</th>
              <th className="px-3 py-3 font-medium text-right">Amount</th>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">AI Suggestion</th>
              <th className="px-3 py-3 font-medium">Category</th>
              <th className="px-3 py-3 font-medium">Vendor</th>
              <th className="px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {txns.map((t: any) => (
              <tr key={t.id} className={`border-l-4 ${rowAccent(t)} ${selected.has(t.id) ? "bg-indigo-50/50" : ""} hover:bg-slate-50/70 transition`}>
                <td className="px-4 py-3">
                  <input type="checkbox" className="accent-indigo-600" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                </td>
                <td className="px-3 py-3 font-mono text-xs text-slate-600">{t.description}</td>
                <td className="px-3 py-3 text-right tabular-nums font-medium text-slate-800">{fmt(t.amountCents)}</td>
                <td className="px-3 py-3 text-slate-400">{String(t.date).slice(0, 10)}</td>
                <td className="px-3 py-3 text-slate-500">
                  {catName(t.aiCategoryId) ?? <span className="text-slate-300">—</span>}
                  {t.aiNewVendorName && <div className="text-xs text-indigo-500">new vendor: {t.aiNewVendorName}</div>}
                </td>
                <td className="px-3 py-3">
                  <select className={selectCls} value={t.finalCategoryId ?? t.aiCategoryId ?? ""}
                    onChange={(e) => swallow(updateTransaction)({ variables: { id: t.id, finalCategoryId: e.target.value } })}>
                    <option value="" disabled>Pick…</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3">
                  <select className={selectCls} value={vendorValue(t)} onChange={(e) => onVendorChange(t.id, e.target.value)}>
                    <option value="" disabled>Pick…</option>
                    {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    {t.aiNewVendorName && <option value={`new:${t.aiNewVendorName}`}>New: {t.aiNewVendorName}</option>}
                  </select>
                </td>
                <td className="px-3 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusPill[t.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && txns.length === 0 && <div className="p-10 text-center text-slate-400">No transactions.</div>}
    </div>
  );
};
