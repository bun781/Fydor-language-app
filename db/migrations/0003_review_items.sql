CREATE TABLE IF NOT EXISTS "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sentence_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"difficulty" real DEFAULT 0.3 NOT NULL,
	"stability" real DEFAULT 0 NOT NULL,
	"recall_mode" text DEFAULT 'full_support' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_items" ADD CONSTRAINT "review_items_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_items" ADD CONSTRAINT "review_items_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_items" ADD CONSTRAINT "review_items_import_id_lessons_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "review_items_sentence_idx" ON "review_items" USING btree ("sentence_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_items_due_idx" ON "review_items" USING btree ("due_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_items_lesson_idx" ON "review_items" USING btree ("lesson_id");
--> statement-breakpoint
INSERT INTO "review_items"
("sentence_id", "lesson_id", "import_id", "due_at", "last_reviewed_at", "repetitions", "lapses", "difficulty", "stability", "recall_mode")
SELECT "id", "lesson_id", "lesson_id", COALESCE("reviewed_at", now()), "reviewed_at", "review_streak",
       CASE WHEN "review_state" = 'forgotten' THEN 1 ELSE 0 END,
       0.3, "review_streak", 'full_support'
FROM "sentences"
ON CONFLICT ("sentence_id") DO NOTHING;
