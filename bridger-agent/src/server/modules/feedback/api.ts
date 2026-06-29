import { prisma } from "@/lib/db";

// Captures why the accountant overrode the AI's category/vendor — the
// model-improvement signal.
export const submitFeedback = async (
  _parent: unknown,
  { transactionId, feedback }: { transactionId: string; feedback: string }
) => {
  return prisma.feedback.create({ data: { transactionId, feedback } });
};
