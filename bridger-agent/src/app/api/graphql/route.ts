import { greetings } from "@/server/modules/greet/api";
import { bankAccounts } from "@/server/modules/bankAccount/api";
import { transactions } from "@/server/modules/transaction/api";
import { vendors } from "@/server/modules/vendor/api";
import { categories } from "@/server/modules/category/api";
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
    `,
    resolvers: {
      Query: {
        greetings,
        bankAccounts,
        transactions,
        vendors,
        categories,
      },
    },
  }),

  // While using Next.js file convention for routing, we need to configure Yoga to use the correct endpoint
  graphqlEndpoint: "/api/graphql",

  // Yoga needs to know how to create a valid Next response
  fetchAPI: { Response },
});

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as OPTIONS,
};
