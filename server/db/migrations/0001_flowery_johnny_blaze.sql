ALTER TABLE "npc_tool_permissions" ALTER COLUMN "is_allowed" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "room_templates" ALTER COLUMN "features" SET DEFAULT '{}'::jsonb;