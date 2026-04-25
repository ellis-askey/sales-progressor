"use client";

import { useState, useMemo } from "react";
import { TransactionTable } from "./TransactionTable";
import type { TransactionStatus } from "@prisma/client";

type TransactionRow = {
  id: string;
  propertyAddress: string;
  status: TransactionStatus;
  expectedExchangeDate: Date | null;
  createdAt: Date;
  assignedUser: { id: string; name: string } | null;
  serviceType?: "self_managed" | "outsourced" | null;
  agentUser?: { id: string; name: string } | null;
};

export function TransactionListWithSearch({ transactions, basePath = "/transactions" }: { transactions: TransactionRow[]; basePath?: string }) {
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const uniqueUsers = useMemo(() => {
    const seen = new Set<string>();
    const users: { id: string; name: string }[] = [];
    for (const t of transactions) {
      if (t.agentUser && !seen.has(t.agentUser.id)) {
        seen.add(t.agentUser.id);
        users.push(t.agentUser);
      }
    }
    return users.sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions]);

  const showUserFilter = uniqueUsers.length > 1;

  const filtered = useMemo(() => {
    let result = transactions;
    if (selectedUserId) result = result.filter((t) => t.agentUser?.id === selectedUserId);
    const q = query.trim().toLowerCase();
    if (q) result = result.filter((t) => t.propertyAddress.toLowerCase().includes(q));
    return result;
  }, [transactions, selectedUserId, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-900/30 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by address…"
          className="glass-input w-full pl-9 pr-4 py-2.5 text-sm"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-900/30 hover:text-slate-900/60"
          >
            ×
          </button>
        )}
      </div>

      {showUserFilter && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-900/40 mr-0.5">Negotiator:</span>
          <button
            onClick={() => setSelectedUserId(null)}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
              !selectedUserId
                ? "bg-white/60 text-slate-900/80 shadow-sm"
                : "text-slate-900/50 hover:text-slate-900/70 hover:bg-white/20"
            }`}
          >
            All
          </button>
          {uniqueUsers.map((u) => {
            const initials = u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            const isActive = selectedUserId === u.id;
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(isActive ? null : u.id)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                  isActive
                    ? "bg-white/60 text-slate-900/80 shadow-sm"
                    : "text-slate-900/50 hover:text-slate-900/70 hover:bg-white/20"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ fontSize: 8 }}>
                  {initials}
                </span>
                {u.name}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="glass-card px-5 py-8 text-center">
          <p className="text-sm text-slate-900/40">
            {query ? `No transactions match "${query}"` : "No files for this negotiator."}
          </p>
        </div>
      ) : (
        <TransactionTable transactions={filtered} basePath={basePath} />
      )}
    </div>
  );
}
