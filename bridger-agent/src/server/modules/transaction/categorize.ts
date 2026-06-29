import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from .env.local

const mapTxn = (t: any) => ({ ...t, date: t.date.toISOString() });

/**
 * AI categorization: for the given transactions, ask Claude to assign a category
 * and vendor (both constrained to the client's lists, or a proposed new vendor)
 * plus a confidence level, then persist the suggestions on the AI fields.
 */
export const categorizeTransactions = async (
  _parent: unknown,
  { ids }: { ids: string[] }
) => {
  if (!ids?.length) return [];

  const txns = await prisma.transaction.findMany({
    where: { id: { in: ids } },
    include: { bankAccount: true },
  });
  if (!txns.length) return [];

  const clientId = txns[0].bankAccount.clientId;
  const [categories, vendors] = await Promise.all([
    prisma.category.findMany({ where: { clientId } }),
    prisma.vendor.findMany({ where: { clientId } }),
  ]);
  const categoryNames = categories.map((c) => c.name);
  const vendorNames = vendors.map((v) => v.name);

  const prompt = `You are an expert bookkeeping assistant categorizing bank transactions.

Allowed categories: ${categoryNames.join(", ")}
Allowed vendors: ${vendorNames.join(", ")}

Transactions (amounts in cents; negative = debit):
${JSON.stringify(txns.map((t) => ({ id: t.id, description: t.description, amountCents: t.amountCents })), null, 2)}

For each transaction:
- "category": exactly one of the allowed categories.
- "vendor": if an allowed vendor clearly matches, use its exact name with "isNewVendor": false. Otherwise propose a concise new vendor name with "isNewVendor": true.
- "confidence": "HIGH" if confident, "LOW" if the description is ambiguous.`;

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "category", "vendor", "isNewVendor", "confidence"],
          properties: {
            id: { type: "string" },
            category: { type: "string", enum: categoryNames },
            vendor: { type: "string" },
            isNewVendor: { type: "boolean" },
            confidence: { type: "string", enum: ["HIGH", "LOW"] },
          },
        },
      },
    },
  };

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: { type: "json_schema", schema } },
  } as any);

  const textBlock = response.content.find((b: any) => b.type === "text") as any;
  const parsed = JSON.parse(textBlock?.text ?? '{"results":[]}');

  const catByName = new Map(categories.map((c) => [c.name, c.id]));
  const venByName = new Map(vendors.map((v) => [v.name, v.id]));

  const updated = await Promise.all(
    parsed.results.map((r: any) => {
      const aiVendorId = !r.isNewVendor ? venByName.get(r.vendor) ?? null : null;
      const aiNewVendorName = r.isNewVendor ? r.vendor : null;
      return prisma.transaction.update({
        where: { id: r.id },
        data: {
          aiCategoryId: catByName.get(r.category) ?? null,
          aiVendorId,
          aiNewVendorName,
          confidence: r.confidence,
        },
      });
    })
  );

  return updated.map(mapTxn);
};
