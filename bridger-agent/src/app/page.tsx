"use client";

import { apolloClient } from "@/client/graphql/apollo-client";
import { TransactionsTable } from "@/components/TransactionsTable/TransactionsTable";
import { ApolloProvider } from "@apollo/client";

const CLIENT_ID = "client_acme"; // seeded SpaceX client

export default function Home() {
  return (
    <ApolloProvider client={apolloClient}>
      <div className="min-h-screen bg-slate-50 font-[family-name:var(--font-geist-sans)]">
        {/* Top bar */}
        <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900">Bridger</span>
            <span className="text-slate-300">/</span>
            <span className="text-lg font-semibold text-slate-700">SpaceX</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Avery</span>
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold">A</span>
          </div>
        </header>

        <main className="flex flex-col gap-6 items-center p-8 sm:p-10">
          <div className="w-full max-w-6xl">
            <h1 className="text-2xl font-bold text-slate-900">Transaction Review</h1>
            <p className="text-sm text-slate-500 mt-1">Review and categorize SpaceX&rsquo;s transactions, or request more info from the client.</p>
          </div>
          <TransactionsTable clientId={CLIENT_ID} />
        </main>
      </div>
    </ApolloProvider>
  );
}
