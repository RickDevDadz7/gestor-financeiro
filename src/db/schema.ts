// Gestor Financeiro — schema do banco (Drizzle ORM + Postgres)
// Todos os valores monetários ficam em CENTAVOS (integer) para evitar erro de arredondamento.
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const txType = pgEnum("tx_type", ["INCOME", "EXPENSE"]);

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: txType("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    date: timestamp("date", { mode: "date" }).notNull(),
    recurring: boolean("recurring").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("tx_user_date_idx").on(t.userId, t.date)],
);

export const debts = pgTable(
  "debts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    creditor: text("creditor"),
    balanceCents: integer("balance_cents").notNull(),
    monthlyInterestRate: doublePrecision("monthly_interest_rate").notNull(), // % ao mês
    minPaymentCents: integer("min_payment_cents").notNull(),
    dueDay: integer("due_day").notNull(), // 1-31
    paidOff: boolean("paid_off").default(false).notNull(),
    lastPaidAt: timestamp("last_paid_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("debt_user_idx").on(t.userId)],
);

export const assetKind = pgEnum("asset_kind", [
  "STOCK", // ações B3
  "FII", // fundos imobiliários
  "ETF",
  "CRYPTO", // ticker = id do CoinGecko (bitcoin, ethereum...)
  "FIXED_INCOME", // CDB, Tesouro, LCI... valor atual manual
  "STOCK_US", // exterior (via BDR/ETF ou corretora gringa) — valor manual em R$
]);

export const holdings = pgTable(
  "holdings",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: assetKind("kind").notNull(),
    ticker: text("ticker").notNull(),
    name: text("name"),
    quantity: doublePrecision("quantity").notNull(),
    avgPriceCents: integer("avg_price_cents").notNull(),
    manualValueCents: integer("manual_value_cents"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("holding_user_idx").on(t.userId)],
);

export const goals = pgTable(
  "goals",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetCents: integer("target_cents").notNull(),
    currentCents: integer("current_cents").default(0).notNull(),
    deadline: timestamp("deadline", { mode: "date" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("goal_user_idx").on(t.userId)],
);

export type SheetCells = Record<string, string>;

export const customSheets = pgTable(
  "custom_sheets",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    cells: jsonb("cells").$type<SheetCells>().default({}).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("sheet_user_idx").on(t.userId)],
);

// Foto diária do mercado — global, compartilhada entre usuários
export const marketSnapshots = pgTable("market_snapshots", {
  id: id(),
  day: text("day").notNull().unique(), // AAAA-MM-DD (Brasília)
  data: jsonb("data").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type Debt = typeof debts.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type CustomSheet = typeof customSheets.$inferSelect;
export type MarketSnapshot = typeof marketSnapshots.$inferSelect;
