import { greetings } from "@/server/modules/greet/api";
import { bankAccounts } from "@/server/modules/bankAccount/api";
import { transactions } from "@/server/modules/transaction/api";
import { vendors } from "@/server/modules/vendor/api";
import { categories } from "@/server/modules/category/api";
import { categorizeTransactions } from "@/server/modules/transaction/categorize";
import { updateTransaction } from "@/server/modules/transaction/update";
import { acceptAll } from "@/server/modules/transaction/accept";
import { sendEmail } from "@/server/modules/transaction/sendEmail";
import { submitFeedback } from "@/server/modules/feedback/api";
import { createSchema, createYoga } from "graphql-yoga";

const { handleRequest } = createYoga({
  schema: createSchema({
    typeDefs: /* GraphQL */ `
      type BankAccount {
        id: ID!
        clientId: ID!
        name: String!
      }

      type Vendor {
        id: ID!
        qboId: String!
        name: String!
      }

      type Category {
        id: ID!
        qboId: String!
        name: String!
      }

      type Transaction {
        id: ID!
        qboId: String!
        bankAccountId: ID!
        date: String!
        amountCents: Int!
        description: String!
        aiCategoryId: ID
        aiVendorId: ID
        aiNewVendorName: String
        finalCategoryId: ID
        finalVendorId: ID
        finalNewVendorName: String
        status: String!
        confidence: String!
      }

      type Query {
        greetings: String
        bankAccounts(clientId: ID!): [BankAccount!]!
        transactions(bankAccountId: ID!): [Transaction!]!
        vendors(clientId: ID!): [Vendor!]!
        categories(clientId: ID!): [Category!]!
      }

      type Feedback {
        id: ID!
        transactionId: ID!
        feedback: String!
      }

      type Mutation {
        categorizeTransactions(ids: [ID!]!): [Transaction!]!
        updateTransaction(id: ID!, finalCategoryId: ID, finalVendorId: ID, finalNewVendorName: String, status: String): Transaction!
        acceptAll(ids: [ID!]!): [Transaction!]!
        sendEmail(ids: [ID!]!): [Transaction!]!
        submitFeedback(transactionId: ID!, feedback: String!): Feedback!
      }
    `,
    resolvers: {
      Query: {
        greetings,
        bankAccounts,
        transactions,
        vendors,
        categories,
      },
      Mutation: {
        categorizeTransactions,
        updateTransaction,
        acceptAll,
        sendEmail,
        submitFeedback,
      },
    },
  }),

  // While using Next.js file convention for routing, we need to configure Yoga to use the correct endpoint
  graphqlEndpoint: "/api/graphql",

  // Yoga needs to know how to create a valid Next response
  fetchAPI: { Response },
});

// Yoga's `handleRequest` second arg (Partial<ServerAdapterInitialContext>) doesn't
// match Next's route-handler context ({ params }), which fails `next build` type
// validation. Wrap it so the exported handlers match Next's expected signature.
function handler(request: Request) {
  return handleRequest(request, {});
}

export { handler as GET, handler as POST, handler as OPTIONS };
