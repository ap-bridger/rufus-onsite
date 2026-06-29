-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "BankAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qboId" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qboId" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qboId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "aiCategoryId" TEXT,
    "aiVendorId" TEXT,
    "aiNewVendorName" TEXT,
    "finalCategoryId" TEXT,
    "finalVendorId" TEXT,
    "finalNewVendorName" TEXT,
    "status" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    CONSTRAINT "Transaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_aiCategoryId_fkey" FOREIGN KEY ("aiCategoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_aiVendorId_fkey" FOREIGN KEY ("aiVendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_finalCategoryId_fkey" FOREIGN KEY ("finalCategoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_finalVendorId_fkey" FOREIGN KEY ("finalVendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    CONSTRAINT "Feedback_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
