ALTER TABLE "member_api_shares" ADD COLUMN IF NOT EXISTS "delegated_by_user_id" integer;
--> statement-breakpoint
ALTER TABLE "member_api_shares" ADD COLUMN IF NOT EXISTS "parent_share_id" integer;
--> statement-breakpoint
ALTER TABLE "member_api_shares" ADD COLUMN IF NOT EXISTS "allow_reshare" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE "member_api_shares" SET "delegated_by_user_id" = "owner_user_id" WHERE "delegated_by_user_id" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_api_shares_parent_idx" ON "member_api_shares" ("parent_share_id");
