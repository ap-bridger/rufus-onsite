import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Allowed string-enum values (SQLite has no native enum support in Prisma).
const Status = { DRAFT: "DRAFT", ACCEPTED: "ACCEPTED", SENT: "SENT" } as const;
const Confidence = { HIGH: "HIGH", LOW: "LOW" } as const;

// Deterministic PRNG (mulberry32) so re-running the seed produces identical data.
function makeRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(42);

const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;

// Reference data --------------------------------------------------------------
const CATEGORIES = [
  { qboId: "QBO-CAT-1", name: "Office Supplies" },
  { qboId: "QBO-CAT-2", name: "Travel" },
  { qboId: "QBO-CAT-3", name: "Meals & Entertainment" },
  { qboId: "QBO-CAT-4", name: "Software & Subscriptions" },
  { qboId: "QBO-CAT-5", name: "Utilities" },
  { qboId: "QBO-CAT-6", name: "Rent" },
];

const VENDORS = [
  { qboId: "QBO-VEN-1", name: "Amazon" },
  { qboId: "QBO-VEN-2", name: "Uber" },
  { qboId: "QBO-VEN-3", name: "Starbucks" },
  { qboId: "QBO-VEN-4", name: "GitHub" },
  { qboId: "QBO-VEN-5", name: "Comcast" },
  { qboId: "QBO-VEN-6", name: "Delta Air Lines" },
];

// Vendors the AI proposes that don't yet exist in QBO (the "new vendor" flow).
const NEW_VENDOR_NAMES = ["Blue Bottle Coffee", "Acme Logistics", "Figma"];

async function main() {
  // 1. Reset — delete in FK-dependency order so re-runs start from a clean slate.
  await prisma.feedback.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.client.deleteMany();
  await prisma.category.deleteMany();
  await prisma.vendor.deleteMany();

  // 2. One client.
  const client = await prisma.client.create({
    data: { id: "client_acme", name: "Acme Inc." },
  });

  // 3. Reference data, scoped to the client. Stable IDs so reseeding is idempotent.
  const categories = await Promise.all(
    CATEGORIES.map((c) =>
      prisma.category.create({
        data: { id: `cat_${c.qboId}`, clientId: client.id, ...c },
      })
    )
  );
  const vendors = await Promise.all(
    VENDORS.map((v) =>
      prisma.vendor.create({
        data: { id: `ven_${v.qboId}`, clientId: client.id, ...v },
      })
    )
  );

  // 4. Three bank accounts for the client.
  const accounts = await Promise.all(
    ["Operating Checking", "Payroll Account", "Business Savings"].map(
      (name, i) =>
        prisma.bankAccount.create({
          data: { id: `acct_${i + 1}`, clientId: client.id, name },
        })
    )
  );

  // 5. ~20 transactions per account.
  let txnSeq = 0;
  let newVendorBudget = NEW_VENDOR_NAMES.length; // keep "new vendors" small/global

  for (const account of accounts) {
    const count = randInt(18, 22);
    for (let i = 0; i < count; i++) {
      txnSeq++;
      const confidence =
        rng() < 0.7 ? Confidence.HIGH : Confidence.LOW;
      const status = pick([
        Status.DRAFT,
        Status.DRAFT,
        Status.ACCEPTED,
        Status.SENT,
      ]);

      const aiCategory = pick(categories);

      // A small number of transactions propose a brand-new vendor instead of
      // matching an existing one.
      const proposeNewVendor = newVendorBudget > 0 && rng() < 0.05;
      let aiVendorId: string | null = null;
      let aiNewVendorName: string | null = null;
      if (proposeNewVendor) {
        aiNewVendorName = NEW_VENDOR_NAMES[NEW_VENDOR_NAMES.length - newVendorBudget];
        newVendorBudget--;
      } else {
        aiVendorId = pick(vendors).id;
      }

      // Once a human accepts/sends, the "final" fields mirror the AI suggestion.
      const finalized = status !== Status.DRAFT;

      // Amounts in cents; mostly debits (negative), occasional credit.
      const amountCents =
        rng() < 0.85 ? -randInt(250, 250_00) : randInt(500, 500_00);

      // Dates spread across the last ~90 days, deterministic.
      const date = new Date("2026-06-29T00:00:00Z");
      date.setUTCDate(date.getUTCDate() - randInt(0, 90));

      const txn = await prisma.transaction.create({
        data: {
          id: `txn_${String(txnSeq).padStart(3, "0")}`,
          qboId: `QBO-TXN-${txnSeq}`,
          bankAccountId: account.id,
          date,
          amountCents,
          description: aiNewVendorName
            ? `Card purchase - ${aiNewVendorName}`
            : `Card purchase - ${vendors.find((v) => v.id === aiVendorId)?.name}`,
          aiCategoryId: aiCategory.id,
          aiVendorId,
          aiNewVendorName,
          finalCategoryId: finalized ? aiCategory.id : null,
          finalVendorId: finalized ? aiVendorId : null,
          finalNewVendorName: finalized ? aiNewVendorName : null,
          status,
          confidence,
        },
      });

      // Low-confidence items occasionally carry human feedback.
      if (confidence === Confidence.LOW && rng() < 0.4) {
        await prisma.feedback.create({
          data: {
            id: `fb_${txn.id}`,
            transactionId: txn.id,
            feedback: pick([
              "Wrong category — should be Travel.",
              "This vendor is a duplicate.",
              "Please double-check the amount.",
              "Looks correct, approving.",
            ]),
          },
        });
      }
    }
  }

  const txnTotal = await prisma.transaction.count();
  console.log(
    `Seeded 1 client, ${accounts.length} bank accounts, ${categories.length} categories, ${vendors.length} vendors, ${txnTotal} transactions.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
