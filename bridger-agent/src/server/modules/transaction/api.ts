import { prisma } from "@/lib/db";
import { GraphQLError } from "graphql";
import { Prisma } from "@prisma/client";

// `date` is a Prisma DateTime; expose it as an ISO string over GraphQL.
const serialize = <T extends { date: Date }>(t: T) => ({
  ...t,
  date: t.date.toISOString(),
});

export const transactions = async (
  _parent: unknown,
  { bankAccountId }: { bankAccountId: string }
) => {
  const rows = await prisma.transaction.findMany({
    where: { bankAccountId },
    orderBy: { date: "desc" },
  });

  return rows.map(serialize);
};

type UpdateTransactionArgs = {
  id: string;
  status: "DRAFT" | "ACCEPTED" | "SENT";
  category?: string | null;
  vendor?: string | null;
  newVendorName?: string | null;
};

export const updateTransaction = async (
  _parent: unknown,
  { id, status, category, vendor, newVendorName }: UpdateTransactionArgs
) => {
  const hasFinalInputs =
    category != null || vendor != null || newVendorName != null;

  // category/vendor/newVendorName may only accompany an ACCEPTED transition.
  if (status !== "ACCEPTED" && hasFinalInputs) {
    throw new GraphQLError(
      `category, vendor, and newVendorName are only allowed when status is ACCEPTED (received status ${status}).`
    );
  }

  // A transaction maps to either an existing vendor or a proposed new vendor —
  // not both.
  if (vendor != null && newVendorName != null) {
    throw new GraphQLError(
      "Provide either vendor or newVendorName, not both."
    );
  }

  let data: Prisma.TransactionUpdateInput;
  switch (status) {
    case "ACCEPTED": {
      // When the accountant typed a brand-new vendor, create it as a real
      // Vendor row (and "create it in QBO" — mocked per scope) so it appears in
      // the vendor dropdown going forward, then link it as the final vendor.
      let finalVendor: Prisma.TransactionUpdateInput["finalVendor"];
      if (newVendorName != null) {
        const txn = await prisma.transaction.findUnique({
          where: { id },
          include: { bankAccount: true },
        });
        if (!txn) throw new GraphQLError(`Transaction not found: ${id}`);
        const { clientId } = txn.bankAccount;
        const name = newVendorName.trim();
        // Reuse a same-named vendor for this client if one already exists.
        const created =
          (await prisma.vendor.findFirst({ where: { clientId, name } })) ??
          (await prisma.vendor.create({
            data: { clientId, name, qboId: `QBO-NEW-${Date.now()}` },
          }));
        finalVendor = { connect: { id: created.id } };
      } else {
        finalVendor = vendor
          ? { connect: { id: vendor } }
          : { disconnect: true };
      }

      data = {
        status,
        finalCategory: category
          ? { connect: { id: category } }
          : { disconnect: true },
        finalVendor,
        // The new vendor is now a real record, so clear the free-text field.
        finalNewVendorName: null,
      };
      break;
    }
    case "DRAFT":
      // Undo: clear everything the human had finalized.
      data = {
        status,
        finalCategory: { disconnect: true },
        finalVendor: { disconnect: true },
        finalNewVendorName: null,
      };
      break;
    case "SENT":
      // Lock in: status only, leave the already-finalized fields untouched.
      data = { status };
      break;
    default:
      throw new GraphQLError(`Unknown status: ${status}`);
  }

  try {
    const updated = await prisma.transaction.update({ where: { id }, data });
    return serialize(updated);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      throw new GraphQLError(`Transaction not found: ${id}`);
    }
    throw e;
  }
};
