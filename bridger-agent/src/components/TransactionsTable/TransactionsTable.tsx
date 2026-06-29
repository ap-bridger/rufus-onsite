import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import confetti from "canvas-confetti";
import {
  BANK_ACCOUNTS,
  TRANSACTIONS,
  CATEGORIES,
  VENDORS,
  CATEGORIZE_ALL,
  UPDATE_TRANSACTION,
  SEND_EMAIL,
  SUBMIT_FEEDBACK,
} from "./TransactionsTable.api";

const fmt = (cents: number) => {
  const v = (Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `-$${v}` : `$${v}`;
};

const rowAccent = (t: any) => {
  if (t.status === "ACCEPTED") return "border-l-emerald-400 bg-emerald-50/30";
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

const statusRank: Record<string, number> = { DRAFT: 0, SENT: 1, ACCEPTED: 2 };
const sortForReview = (a: any, b: any) => {
  const s = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
  if (s !== 0) return s;
  const c = (a.confidence === "LOW" ? 0 : 1) - (b.confidence === "LOW" ? 0 : 1);
  if (c !== 0) return c;
  return String(b.date).localeCompare(String(a.date));
};

const selectCls =
  "border border-slate-300 rounded-md px-2 py-1 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition";

const REASON_CHIPS = ["Wrong category", "Wrong vendor", "Needs more context", "Duplicate", "Other"];

const FACTS = [
  "Double-entry bookkeeping dates to 1494 — Luca Pacioli, the “father of accounting.”",
  "“SQ *” on a statement means a Square payment; “TST*” is Toast.",
  "Hand-categorizing, businesses misfile roughly 1 in 5 transactions.",
  "The AI reads the messy bank descriptor so Avery doesn’t have to.",
  "Low-confidence items are floated to the top so nothing slips through.",
  "Every correction you make becomes training data for next time.",
];

type Pending = { txnId: string; field: "category" | "vendor"; value: string; aiName: string; newName: string };

export const TransactionsTable = ({ clientId }: { clientId: string }) => {
  const { data: bankData } = useQuery(BANK_ACCOUNTS, { variables: { clientId } });
  const accounts = bankData?.bankAccounts ?? [];
  const activeAccount = accounts[0]?.id ?? null;

  const { data: catData } = useQuery(CATEGORIES, { variables: { clientId } });
  const { data: venData } = useQuery(VENDORS, { variables: { clientId } });
  const { data, loading, error } = useQuery(TRANSACTIONS, {
    variables: { bankAccountId: activeAccount },
    skip: !activeAccount,
  });

  const refetchQueries = activeAccount ? [{ query: TRANSACTIONS, variables: { bankAccountId: activeAccount } }] : [];
  const swallow = (m: any) => (...a: any[]) => m(...a).catch(() => {});
  const [categorizeAll, { loading: categorizing }] = useMutation(CATEGORIZE_ALL, { refetchQueries });
  const [sendEmail, { loading: sending }] = useMutation(SEND_EMAIL, { refetchQueries });
  // Also refetch VENDORS: accepting a typed-in vendor creates a new Vendor row,
  // which must show up in the dropdown.
  const [updateTransaction] = useMutation(UPDATE_TRANSACTION, {
    refetchQueries: [...refetchQueries, { query: VENDORS, variables: { clientId } }],
  });
  const [submitFeedback] = useMutation(SUBMIT_FEEDBACK);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hideAccepted, setHideAccepted] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [showRequest, setShowRequest] = useState(false);
  const [requestMsg, setRequestMsg] = useState("");
  const [asks, setAsks] = useState<Record<string, { category: boolean; vendor: boolean }>>({});
  const [newVendor, setNewVendor] = useState<{ txnId: string } | null>(null);
  const [newVendorInput, setNewVendorInput] = useState("");
  const [factIdx, setFactIdx] = useState(0);
  const [sentToast, setSentToast] = useState(false);

  useEffect(() => {
    if (!categorizing) return;
    const id = setInterval(() => setFactIdx((i) => (i + 1) % FACTS.length), 2200);
    return () => clearInterval(id);
  }, [categorizing]);

  const fireConfetti = () =>
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 }, colors: ["#10b981", "#6366f1", "#f59e0b"] });

  const categories = catData?.categories ?? [];
  const vendors = venData?.vendors ?? [];
  const catName = (id: string | null) => categories.find((c: any) => c.id === id)?.name ?? null;
  const venName = (id: string | null) => vendors.find((v: any) => v.id === id)?.name ?? null;

  const all = data?.transactions ?? [];
  const txns = [...all].filter((t) => !(hideAccepted && t.status === "ACCEPTED")).sort(sortForReview);
  const allIds = txns.map((t: any) => t.id);
  const selectedIds = [...selected];

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => (s.size === txns.length ? new Set() : new Set(allIds)));

  // Accept a transaction, preserving the field we're NOT changing — Alex's
  // updateTransaction sets BOTH final category and vendor on every ACCEPTED call,
  // so we always pass the current value for the other one.
  const accept = (t: any, ov: { category?: string | null; vendor?: string | null; newVendorName?: string | null } = {}) => {
    const category = "category" in ov ? ov.category : (t.finalCategoryId ?? t.aiCategoryId ?? null);
    let vendor = "vendor" in ov ? ov.vendor : (t.finalVendorId ?? t.aiVendorId ?? null);
    let newVendorName = "newVendorName" in ov ? ov.newVendorName : (t.finalNewVendorName ?? t.aiNewVendorName ?? null);
    if ("vendor" in ov) newVendorName = null;
    if ("newVendorName" in ov) vendor = null;
    if (vendor && newVendorName) newVendorName = null;
    return swallow(updateTransaction)({ variables: { id: t.id, status: "ACCEPTED", category, vendor, newVendorName } });
  };

  const onCategoryChange = (t: any, value: string) => {
    if (value === t.aiCategoryId) return accept(t, { category: value });
    setReason("");
    setPending({ txnId: t.id, field: "category", value, aiName: catName(t.aiCategoryId) ?? "—", newName: catName(value) ?? value });
  };
  const onVendorChange = (t: any, value: string) => {
    if (value === "__new__") { setNewVendorInput(""); setNewVendor({ txnId: t.id }); return; }
    if (value.startsWith("new:")) return accept(t, { newVendorName: value.slice(4) });
    if (value === t.aiVendorId) return accept(t, { vendor: value });
    setReason("");
    setPending({ txnId: t.id, field: "vendor", value, aiName: venName(t.aiVendorId) ?? t.aiNewVendorName ?? "—", newName: venName(value) ?? value });
  };

  const applyPending = async () => {
    if (!pending) return;
    const t = all.find((x: any) => x.id === pending.txnId);
    if (t) {
      if (pending.field === "category") await accept(t, { category: pending.value });
      else if (pending.value.startsWith("new:")) await accept(t, { newVendorName: pending.value.slice(4) });
      else await accept(t, { vendor: pending.value });
    }
    const note = `${pending.field === "category" ? "Category" : "Vendor"} changed from "${pending.aiName}" to "${pending.newName}": ${reason}`;
    await swallow(submitFeedback)({ variables: { transactionId: pending.txnId, feedback: note } });
    setPending(null);
  };

  const approveSelected = async () => {
    const sel = all.filter((t: any) => selected.has(t.id));
    await Promise.all(sel.map((t: any) => accept(t)));
    setSelected(new Set());
    fireConfetti();
  };

  const openNewVendor = (t: any) => { setNewVendorInput(t.aiNewVendorName ?? ""); setNewVendor({ txnId: t.id }); };
  const approveNewVendor = async () => {
    if (!newVendor || !newVendorInput.trim()) return;
    const t = all.find((x: any) => x.id === newVendor.txnId);
    if (t) await accept(t, { newVendorName: newVendorInput.trim() });
    setNewVendor(null);
  };

  // Per-transaction: which field(s) the accountant is asking the client about.
  const buildEmail = (a: Record<string, { category: boolean; vendor: boolean }>) => {
    const sel = all.filter((t: any) => selected.has(t.id));
    const lines = sel.map((t: any) => {
      const ak = a[t.id] ?? { category: false, vendor: false };
      const wanted = [ak.category && "category", ak.vendor && "vendor"].filter(Boolean).join(" and ");
      const ask = wanted ? `Could you tell us the ${wanted}?` : "Could you share a bit more detail?";
      return `• On ${String(t.date).slice(0, 10)}, a payment of ${fmt(t.amountCents)} (${t.description}). ${ask}`;
    }).join("\n");
    return `Hey Dylan,\n\nWe're reviewing SpaceX's recent transactions and need a little more detail on the following so we can record them correctly:\n\n${lines}\n\nThanks so much!\nThe Bridger bookkeeping team`;
  };
  const openRequest = () => {
    const init: Record<string, { category: boolean; vendor: boolean }> = {};
    all.filter((t: any) => selected.has(t.id)).forEach((t: any) => {
      init[t.id] = { category: !t.finalCategoryId, vendor: !t.finalVendorId && !t.finalNewVendorName };
    });
    setAsks(init);
    setRequestMsg(buildEmail(init));
    setShowRequest(true);
  };
  const toggleAsk = (id: string, field: "category" | "vendor") =>
    setAsks((p) => {
      const next = { ...p, [id]: { ...p[id], [field]: !p[id]?.[field] } };
      setRequestMsg(buildEmail(next));
      return next;
    });
  const sendRequest = async () => {
    await swallow(sendEmail)({ variables: { ids: selectedIds } });
    setShowRequest(false);
    setSelected(new Set());
    setSentToast(true);
    setTimeout(() => setSentToast(false), 2800);
  };

  const vendorValue = (t: any) => {
    if (t.finalVendorId) return t.finalVendorId;
    if (t.finalNewVendorName) return `new:${t.finalNewVendorName}`;
    if (t.aiVendorId) return t.aiVendorId;
    if (t.aiNewVendorName) return `new:${t.aiNewVendorName}`;
    return "";
  };
  const dot = (cls: string) => <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
  const selTxns = all.filter((t: any) => selected.has(t.id));

  return (
    <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Transactions</h2>
          <label className="flex items-center gap-1.5 text-sm text-slate-500 select-none">
            <input type="checkbox" className="accent-indigo-600" checked={hideAccepted} onChange={(e) => setHideAccepted(e.target.checked)} />
            Hide accepted
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => swallow(categorizeAll)({ variables: { ids: allIds } })}
            disabled={categorizing || allIds.length === 0}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm disabled:opacity-40 transition">
            {categorizing ? "Categorizing…" : "Categorize All"}
          </button>
          <button onClick={approveSelected}
            disabled={selectedIds.length === 0}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm disabled:opacity-40 transition">
            Approve ({selectedIds.length})
          </button>
          <button onClick={openRequest}
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
        <span className="ml-auto text-slate-400">Sorted: needs review → sent → accepted</span>
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
              <th className="px-3 py-3 font-medium">AI Suggested Category</th>
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
                <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{String(t.date).slice(0, 10)}</td>
                <td className="px-3 py-3 text-slate-500">
                  {catName(t.aiCategoryId) ?? <span className="text-slate-300">—</span>}
                  {t.aiNewVendorName && <div className="text-xs text-indigo-500">new vendor: {t.aiNewVendorName}</div>}
                </td>
                <td className="px-3 py-3">
                  <select className={selectCls} value={t.finalCategoryId ?? t.aiCategoryId ?? ""} onChange={(e) => onCategoryChange(t, e.target.value)}>
                    <option value="" disabled>Pick…</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3">
                  {t.aiNewVendorName && !t.finalVendorId && !t.finalNewVendorName ? (
                    <button onClick={() => openNewVendor(t)}
                      className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition">
                      New vendor: {t.aiNewVendorName} — review
                    </button>
                  ) : (
                    <select className={selectCls} value={vendorValue(t)} onChange={(e) => onVendorChange(t, e.target.value)}>
                      <option value="" disabled>Pick…</option>
                      {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      {/* Selected final vendor not yet in the list (e.g. just created) —
                          render it so the dropdown shows the right name, not a fallback one. */}
                      {t.finalVendorId && !vendors.some((v: any) => v.id === t.finalVendorId) && (
                        <option value={t.finalVendorId}>{venName(t.finalVendorId) ?? t.finalNewVendorName ?? "Selected vendor"}</option>
                      )}
                      {t.finalNewVendorName && <option value={`new:${t.finalNewVendorName}`}>{t.finalNewVendorName} (new)</option>}
                      <option value="__new__">+ Create new vendor…</option>
                    </select>
                  )}
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

      {/* Categorizing — world-class wait UX */}
      {categorizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl text-center">
            <div className="mx-auto h-9 w-9 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
            <h3 className="mt-4 text-base font-semibold text-slate-800">Categorizing with AI…</h3>
            <p className="mt-2 text-sm text-slate-500 min-h-[2.5rem]">{FACTS[factIdx]}</p>
          </div>
        </div>
      )}

      {/* Feedback modal — AI override */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40" onClick={() => setPending(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800">Why the change?</h3>
            <p className="mt-1 text-sm text-slate-500">
              {pending.field === "category" ? "Category" : "Vendor"}: AI suggested{" "}
              <span className="font-medium text-slate-700">{pending.aiName}</span>, you chose{" "}
              <span className="font-medium text-slate-700">{pending.newName}</span>. This trains the model.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {REASON_CHIPS.map((c) => (
                <button key={c} onClick={() => setReason(c)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition ${reason === c ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                  {c}
                </button>
              ))}
            </div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Add a note (optional)…"
              className="mt-3 w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPending(null)} className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={applyPending} disabled={!reason.trim()}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40">
                Save change &amp; feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info-request — per-txn ask + editable email */}
      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setShowRequest(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800">Request info from client</h3>
            <p className="mt-1 text-sm text-slate-500">To: <span className="font-medium text-slate-700">Dylan (SpaceX)</span> · choose what to ask for each transaction</p>
            <div className="mt-3 space-y-1.5">
              {selTxns.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span className="text-slate-600 truncate">
                    <span className="text-slate-400">{String(t.date).slice(0, 10)}</span> · {t.description} · <span className="tabular-nums">{fmt(t.amountCents)}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0 text-xs text-slate-600">
                    <label className="flex items-center gap-1"><input type="checkbox" className="accent-amber-500" checked={!!asks[t.id]?.category} onChange={() => toggleAsk(t.id, "category")} /> Category</label>
                    <label className="flex items-center gap-1"><input type="checkbox" className="accent-amber-500" checked={!!asks[t.id]?.vendor} onChange={() => toggleAsk(t.id, "vendor")} /> Vendor</label>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Email (editable)</p>
            <textarea value={requestMsg} onChange={(e) => setRequestMsg(e.target.value)} rows={10}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowRequest(false)} className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={sendRequest} disabled={sending}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-40">
                Send request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New-vendor approval */}
      {newVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40" onClick={() => setNewVendor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800">New vendor</h3>
            <p className="mt-1 text-sm text-slate-500">
              Type the vendor name to create it in QuickBooks, then approve. (Pre-filled when the AI proposed one.)
            </p>
            <input value={newVendorInput} onChange={(e) => setNewVendorInput(e.target.value)} autoFocus
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setNewVendor(null)} className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={approveNewVendor} disabled={!newVendorInput.trim()}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-40">
                Approve &amp; create in QBO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast — info request sent */}
      {sentToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-white shadow-lg">
          <svg className="h-4 w-4 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7z" />
          </svg>
          <span className="text-sm font-medium">Info request sent to Dylan</span>
        </div>
      )}
    </div>
  );
};
