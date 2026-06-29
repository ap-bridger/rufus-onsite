import { prisma } from "@/lib/db";

export const vendors = async (
  _parent: unknown,
  { clientId }: { clientId: string }
) => {
  return prisma.vendor.findMany({
    where: { clientId },
    orderBy: { name: "asc" },
  });
};
