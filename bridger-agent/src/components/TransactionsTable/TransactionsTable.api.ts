import { gql } from "@apollo/client";

// --- Queries (match the merged contract in route.ts) ---

export const BANK_ACCOUNTS = gql(`
  query BankAccounts($clientId: ID!) {
    bankAccounts(clientId: $clientId) { id name }
  }
`);

export const TRANSACTIONS = gql(`
  query Transactions($bankAccountId: ID!) {
    transactions(bankAccountId: $bankAccountId) {
      id
      qboId
      description
      amountCents
      date
      status
      confidence
      aiCategoryId
      aiVendorId
      aiNewVendorName
      finalCategoryId
      finalVendorId
      finalNewVendorName
    }
  }
`);

export const CATEGORIES = gql(`
  query Categories($clientId: ID!) {
    categories(clientId: $clientId) { id name }
  }
`);

export const VENDORS = gql(`
  query Vendors($clientId: ID!) {
    vendors(clientId: $clientId) { id name }
  }
`);

// --- Mutations ---
// NOTE: these resolvers are not on `main` yet (PR #3 was queries-only).
// Frontend is intentionally ahead of the backend; see PR description for the
// list of mutations the backend needs to add.

export const CATEGORIZE_ALL = gql(`
  mutation CategorizeAll($ids: [ID!]!) {
    categorizeTransactions(ids: $ids) { id aiCategoryId aiVendorId confidence }
  }
`);

export const UPDATE_TRANSACTION = gql(`
  mutation UpdateTransaction($id: ID!, $status: TransactionStatus!, $category: ID, $vendor: ID, $newVendorName: String) {
    updateTransaction(id: $id, status: $status, category: $category, vendor: $vendor, newVendorName: $newVendorName) {
      id status finalCategoryId finalVendorId finalNewVendorName
    }
  }
`);

export const ACCEPT_ALL = gql(`
  mutation AcceptTransactions($ids: [ID!]!) {
    acceptAll(ids: $ids) { id status }
  }
`);

export const SEND_EMAIL = gql(`
  mutation SendEmail($ids: [ID!]!) {
    sendEmail(ids: $ids) { id status }
  }
`);

// Captures why the accountant overrode the AI's category/vendor (training signal).
export const SUBMIT_FEEDBACK = gql(`
  mutation SubmitFeedback($transactionId: ID!, $feedback: String!) {
    submitFeedback(transactionId: $transactionId, feedback: $feedback) { id }
  }
`);
