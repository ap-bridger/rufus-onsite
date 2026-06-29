import { prisma } from "@/lib/db";

const mapTxn = (t: any) => ({ ...t, date: t.date.toISOString() });

// Bulk-approve the selected transactions.
export const acceptAll = async (_parent: unknown, { ids }: { ids: string[] }) => {
  await prisma.transaction.updateMany({ where: { id: { in: ids } }, data: { status: "ACCEPTED" } });
  const rows = await prisma.transaction.findMany({ where: { id: { in: ids } } });
  return rows.map(mapTxn);
};
