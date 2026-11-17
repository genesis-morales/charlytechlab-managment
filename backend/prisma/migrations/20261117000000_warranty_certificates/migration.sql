BEGIN;

-- Widen the existing relation; preserve all warranties and claims.
ALTER TABLE "Warranty" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "Warranty" ADD COLUMN "workOrderDeviceId" TEXT;
CREATE UNIQUE INDEX "Warranty_workOrderDeviceId_key" ON "Warranty"("workOrderDeviceId");
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_workOrderDeviceId_fkey"
  FOREIGN KEY ("workOrderDeviceId") REFERENCES "WorkOrderDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_exactly_one_origin_check"
  CHECK (num_nonnulls("productId", "workOrderDeviceId") = 1);
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_valid_dates_check"
  CHECK ("expiresAt" > "startsAt") NOT VALID;

CREATE TABLE "WarrantyCertificate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "warrantyId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "verificationToken" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuedBy" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "revocationReason" TEXT,
  CONSTRAINT "WarrantyCertificate_warrantyId_fkey" FOREIGN KEY ("warrantyId")
    REFERENCES "Warranty"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WarrantyCertificate_version_check" CHECK ("version" > 0),
  CONSTRAINT "WarrantyCertificate_snapshot_check" CHECK (jsonb_typeof("snapshot") = 'object'),
  CONSTRAINT "WarrantyCertificate_revocation_check" CHECK (
    ("revokedAt" IS NULL AND "revokedBy" IS NULL AND "revocationReason" IS NULL) OR
    ("revokedAt" IS NOT NULL AND "revokedBy" IS NOT NULL AND length(btrim("revocationReason")) > 0 AND "revocationReason" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "WarrantyCertificate_number_key" ON "WarrantyCertificate"("number");
CREATE UNIQUE INDEX "WarrantyCertificate_verificationToken_key" ON "WarrantyCertificate"("verificationToken");
CREATE UNIQUE INDEX "WarrantyCertificate_warrantyId_version_key" ON "WarrantyCertificate"("warrantyId", "version");
-- Prisma 5 cannot express a partial unique index in its datamodel.
CREATE UNIQUE INDEX "WarrantyCertificate_one_active_key" ON "WarrantyCertificate"("warrantyId") WHERE "revokedAt" IS NULL;

CREATE FUNCTION protect_issued_warranty_certificate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Issued certificates cannot be deleted';
  END IF;
  IF OLD."revokedAt" IS NOT NULL OR
     ROW(NEW."id", NEW."warrantyId", NEW."number", NEW."version", NEW."verificationToken", NEW."snapshot", NEW."issuedAt", NEW."issuedBy")
     IS DISTINCT FROM
     ROW(OLD."id", OLD."warrantyId", OLD."number", OLD."version", OLD."verificationToken", OLD."snapshot", OLD."issuedAt", OLD."issuedBy") THEN
    RAISE EXCEPTION 'Issued certificate content is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "WarrantyCertificate_preserve_issued_content"
  BEFORE UPDATE OR DELETE ON "WarrantyCertificate"
  FOR EACH ROW EXECUTE FUNCTION protect_issued_warranty_certificate();

COMMIT;
