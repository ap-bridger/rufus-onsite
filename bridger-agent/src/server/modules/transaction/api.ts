import { prisma } from "@/lib/db";

export const transactions = async (
  _parent: unknown,
  { bankAccountId }: { bankAccountId: string }
) => {
  const rows = await prisma.transaction.findMany({
    where: { bankAccountId },
    orderBy: { date: "desc" },
  });

  // `date` is a Prisma DateTime; expose it as an ISO string over GraphQL.
  return rows.map((t) => ({ ...t, date: t.date.toISOString() }));
};
