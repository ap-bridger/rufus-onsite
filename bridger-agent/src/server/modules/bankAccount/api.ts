import { prisma } from "@/lib/db";

export const bankAccounts = async (
  _parent: unknown,
  { clientId }: { clientId: string }
) => {
  return prisma.bankAccount.findMany({
    where: { clientId },
    orderBy: { name: "asc" },
  });
};
