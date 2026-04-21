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
};

export function TransactionListWithSearch({ transactions, basePath = "/transactions" }: { transactions: TransactionRow[]; basePath?: string }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) => t.propertyAddress.toLowerCase().includes(q));
  }, [query, transactions]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none"
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
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#e4e9f0] rounded-xl bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          >
            ×
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e4e9f0] px-5 py-8 text-center">
          <p className="text-sm text-gray-400">No transactions match "{query}"</p>
        </div>
      ) : (
        <TransactionTable transactions={filtered} basePath={basePath} />
      )}
    </div>
  );
}
