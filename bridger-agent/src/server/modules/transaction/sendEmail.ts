import { prisma } from "@/lib/db";

const mapTxn = (t: any) => ({ ...t, date: t.date.toISOString() });

// Mark the selected transactions as having an info request sent to the client.
// (Email delivery is mocked for the prototype; this flips status to SENT.)
export const sendEmail = async (_parent: unknown, { ids }: { ids: string[] }) => {
  await prisma.transaction.updateMany({ where: { id: { in: ids } }, data: { status: "SENT" } });
  const rows = await prisma.transaction.findMany({ where: { id: { in: ids } } });
  return rows.map(mapTxn);
};
