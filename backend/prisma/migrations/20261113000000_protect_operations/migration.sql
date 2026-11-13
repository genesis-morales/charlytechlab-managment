-- Additive only: do not rewrite historical financial or customer records.
BEGIN;
CREATE TYPE "TransferDirection" AS ENUM ('IN', 'OUT');
ALTER TABLE "FinancialTransaction"
  ADD COLUMN "transferId" TEXT,
  ADD COLUMN "transferDirection" "TransferDirection";
CREATE UNIQUE INDEX "FinancialTransaction_transferId_transferDirection_key"
  ON "FinancialTransaction"("transferId", "transferDirection");
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_transfer_metadata_check"
  CHECK (("transferId" IS NULL AND "transferDirection" IS NULL) OR
    ("transferId" IS NOT NULL AND "transferDirection" IS NOT NULL AND "type" = 'TRANSFER'));

CREATE TABLE "IdempotencyRecord" (
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("userId", "key")
);

-- Enforce future writes without deleting or silently correcting existing anomalies.
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_nonnegative_stock_check"
  CHECK ("quantity" >= 0 AND "minQuantity" >= 0) NOT VALID;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_positive_amount_check"
  CHECK ("amount" > 0) NOT VALID;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount_check"
  CHECK ("amount" > 0) NOT VALID;
ALTER TABLE "OwnerLoan" ADD CONSTRAINT "OwnerLoan_positive_amount_check"
  CHECK ("amount" > 0) NOT VALID;
ALTER TABLE "OwnerLoanRepayment" ADD CONSTRAINT "OwnerLoanRepayment_positive_amount_check"
  CHECK ("amount" > 0) NOT VALID;
COMMIT;
