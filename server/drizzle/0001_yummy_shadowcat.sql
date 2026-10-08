CREATE TYPE "public"."cv_template" AS ENUM('classic', 'modern');--> statement-breakpoint
ALTER TABLE "cvs" ADD COLUMN "template" "cv_template" DEFAULT 'classic' NOT NULL;