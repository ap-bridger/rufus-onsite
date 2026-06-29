import Anthropic from "@anthropic-ai/sdk";
import { GraphQLError } from "graphql";
import { z } from "zod";
import { prisma } from "@/lib/db";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from .env.local

const mapTxn = (t: any) => ({ ...t, date: t.date.toISOString() });

// How many of the client's previously-approved transactions to show Claude as
// few-shot examples — real accountant decisions that teach it the house style.
const FEWSHOT_LIMIT = 12;

// Validate Claude's response shape before we trust it (the json_schema below
// constrains generation; this guards against anything slipping through).
const ResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      vendor: z.string(),
      isNewVendor: z.boolean(),
      confidence: z.enum(["HIGH", "LOW"]),
    })
  ),
});

/**
 * AI categorization: for the given transactions, ask Claude to assign a category
 * and vendor (both constrained to the client's lists, or a proposed new vendor)
 * plus a confidence level, then persist the suggestions on the AI fields.
 *
 * Improvements over the baseline:
 *  - Feedback loop: the client's already-approved transactions are passed as
 *    few-shot examples, so suggestions match the accountant's prior decisions.
 *  - Robust output: Zod-validated structured output + error handling.
 *  - Vendor safety: an unmatched "existing" vendor is kept as a proposed new
 *    vendor instead of being silently dropped.
 *  - Atomic writes: all suggestions persist in a single transaction.
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
  const [categories, vendors, approved] = await Promise.all([
    prisma.category.findMany({ where: { clientId } }),
    prisma.vendor.findMany({ where: { clientId } }),
    // The feedback loop: recent transactions this accountant already approved.
    prisma.transaction.findMany({
      where: {
        status: "ACCEPTED",
        finalCategoryId: { not: null },
        bankAccount: { clientId },
        id: { notIn: ids },
      },
      include: { finalCategory: true, finalVendor: true },
      orderBy: { date: "desc" },
      take: FEWSHOT_LIMIT,
    }),
  ]);

  const categoryNames = categories.map((c) => c.name);
  const vendorNames = vendors.map((v) => v.name);

  const examples = approved
    .map((t) => {
      const vendor = t.finalVendor?.name ?? t.finalNewVendorName ?? "—";
      return `- "${t.description}" (${t.amountCents}c) -> category: ${t.finalCategory!.name}, vendor: ${vendor}`;
    })
    .join("\n");
  const examplesBlock = examples
    ? `\nThis accountant has already approved these similar transactions — follow their judgment:\n${examples}\n`
    : "";

  const prompt = `You are an expert bookkeeping assistant categorizing bank transactions.

Allowed categories: ${categoryNames.join(", ")}
Allowed vendors: ${vendorNames.join(", ")}
${examplesBlock}
Transactions to categorize (amounts in cents; negative = debit):
${JSON.stringify(
  txns.map((t) => ({ id: t.id, description: t.description, amountCents: t.amountCents })),
  null,
  2
)}

For each transaction:
- "category": exactly one of the allowed categories.
- "vendor": if an allowed vendor clearly matches, use its EXACT name from the allowed list with "isNewVendor": false. Otherwise propose a concise new vendor name with "isNewVendor": true.
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

  let parsed: z.infer<typeof ResultSchema>;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema } },
    } as any);

    const textBlock = response.content.find((b: any) => b.type === "text") as any;
    parsed = ResultSchema.parse(JSON.parse(textBlock?.text ?? '{"results":[]}'));
  } catch (err) {
    console.error("[categorize] Claude call or response validation failed:", err);
    throw new GraphQLError("AI categorization failed. Please try again.");
  }

  const catByName = new Map(categories.map((c) => [c.name, c.id]));
  const venByName = new Map(vendors.map((v) => [v.name, v.id]));

  // Persist atomically — either every suggestion lands or none do.
  const updated = await prisma.$transaction(
    parsed.results.map((r) => {
      const matchedVendorId = venByName.get(r.vendor) ?? null;
      // If Claude marked the vendor as existing but the name doesn't match an
      // allowed vendor, keep it as a proposed new vendor rather than dropping it.
      const treatAsNew = r.isNewVendor || matchedVendorId === null;
      return prisma.transaction.update({
        where: { id: r.id },
        data: {
          aiCategoryId: catByName.get(r.category) ?? null,
          aiVendorId: treatAsNew ? null : matchedVendorId,
          aiNewVendorName: treatAsNew ? r.vendor : null,
          confidence: r.confidence,
        },
      });
    })
  );

  return updated.map(mapTxn);
};
