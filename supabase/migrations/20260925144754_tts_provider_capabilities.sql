ALTER TABLE "member_api_shares" DROP CONSTRAINT IF EXISTS "member_api_shares_capability";
UPDATE "member_api_shares" SET "capability" = 'tts:minimaxi' WHERE "capability" = 'tts';
UPDATE "api_grants" SET "capability" = 'tts:minimaxi' WHERE "capability" = 'tts';
ALTER TABLE "member_api_shares" ADD CONSTRAINT "member_api_shares_capability"
  CHECK ("capability" IN ('llm', 'tts:minimaxi', 'tts:fish_audio', 'tts:gemini'));;
