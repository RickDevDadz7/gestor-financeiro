CREATE TYPE "public"."asset_kind" AS ENUM('STOCK', 'FII', 'ETF', 'CRYPTO', 'FIXED_INCOME', 'STOCK_US');--> statement-breakpoint
CREATE TYPE "public"."tx_type" AS ENUM('INCOME', 'EXPENSE');--> statement-breakpoint
CREATE TABLE "custom_sheets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"cells" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"creditor" text,
	"balance_cents" integer NOT NULL,
	"monthly_interest_rate" double precision NOT NULL,
	"min_payment_cents" integer NOT NULL,
	"due_day" integer NOT NULL,
	"paid_off" boolean DEFAULT false NOT NULL,
	"last_paid_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"target_cents" integer NOT NULL,
	"current_cents" integer DEFAULT 0 NOT NULL,
	"deadline" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"ticker" text NOT NULL,
	"name" text,
	"quantity" double precision NOT NULL,
	"avg_price_cents" integer NOT NULL,
	"manual_value_cents" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"day" text NOT NULL,
	"data" jsonb NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "market_snapshots_day_unique" UNIQUE("day")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "tx_type" NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"date" timestamp NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "custom_sheets" ADD CONSTRAINT "custom_sheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sheet_user_idx" ON "custom_sheets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "debt_user_idx" ON "debts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goal_user_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "holding_user_idx" ON "holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tx_user_date_idx" ON "transactions" USING btree ("user_id","date");