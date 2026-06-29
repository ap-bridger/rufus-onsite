import { prisma } from "@/lib/db";

export const categories = async (
  _parent: unknown,
  { clientId }: { clientId: string }
) => {
  return prisma.category.findMany({
    where: { clientId },
    orderBy: { name: "asc" },
  });
};
