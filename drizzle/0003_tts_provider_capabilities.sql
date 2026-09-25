-- Existing generic TTS allowances belonged to the original MiniMax-only flow.
ALTER TABLE "member_api_shares" DROP CONSTRAINT IF EXISTS "member_api_shares_capability";
--> statement-breakpoint
UPDATE "member_api_shares" SET "capability" = 'tts:minimaxi' WHERE "capability" = 'tts';
--> statement-breakpoint
UPDATE "api_grants" SET "capability" = 'tts:minimaxi' WHERE "capability" = 'tts';
--> statement-breakpoint
ALTER TABLE "member_api_shares" ADD CONSTRAINT "member_api_shares_capability"
  CHECK ("capability" IN ('llm', 'tts:minimaxi', 'tts:fish_audio', 'tts:gemini'));
