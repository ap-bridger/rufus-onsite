import { prisma } from "@/lib/db";

const mapTxn = (t: any) => ({ ...t, date: t.date.toISOString() });

// Accountant sets the final category/vendor/status on a transaction.
export const updateTransaction = async (
  _parent: unknown,
  a: { id: string; finalCategoryId?: string; finalVendorId?: string; finalNewVendorName?: string; status?: string }
) => {
  const data: any = {};
  if (a.finalCategoryId) data.finalCategoryId = a.finalCategoryId;
  if (a.finalVendorId) { data.finalVendorId = a.finalVendorId; data.finalNewVendorName = null; }
  if (a.finalNewVendorName) { data.finalNewVendorName = a.finalNewVendorName; data.finalVendorId = null; }
  if (a.status) data.status = a.status;
  const t = await prisma.transaction.update({ where: { id: a.id }, data });
  return mapTxn(t);
};
