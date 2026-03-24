-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "botSource" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_userId_botSource_idx" ON "Conversation"("userId", "botSource");
