-- AlterEnum: add social notification types
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'SOCIAL_LIKE';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'SOCIAL_COMMENT';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'SOCIAL_FOLLOW';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'SOCIAL_REPLY';
