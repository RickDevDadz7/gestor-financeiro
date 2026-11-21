# Gestor Financeiro — do zero à riqueza

App web responsivo (funciona no PC e no celular, instalável como app pela tela inicial) para organizar finanças, atacar dívidas na ordem certa, acompanhar investimentos e o mercado todo dia.

## O que ele faz

| Área | Recursos |
|---|---|
| **Painel** | Receitas, despesas, sobra do mês, patrimônio líquido, gráfico de 6 meses, próximos vencimentos, resumo do mercado |
| **Jornada até a riqueza** | 7 etapas calculadas com os seus números (enxergar o dinheiro → sobrar 10% → mini-reserva → matar dívidas caras → reserva de 6 meses → investir 20% → independência financeira) e o próximo passo concreto |
| **Gastos** | Lançamentos por mês, categorias, gastos fixos recorrentes ("puxar fixos do mês anterior") |
| **Dívidas** | Juros a.m./a.a., gravidade, vencimento com contagem de dias, ordem de pagamento (avalanche ou bola de neve), registrar pagamento, simulador de quando você fica livre e quanto economiza |
| **Investimentos** | Ações, FIIs, ETFs (cotação B3), cripto (CoinGecko), renda fixa e exterior (valor manual), lucro/prejuízo, alocação, comparação com uma alocação de referência, alerta se ainda tem dívida cara/sem reserva |
| **Mercado** | Ibovespa, dólar, euro, Selic, CDI, IPCA, cripto, ações acompanhadas + **resumo diário automático** (com Claude se tiver API key, ou por regras) |
| **Metas** | Reserva de emergência, mudança pro exterior etc., com aporte e quanto guardar por mês |
| **Planilhas** | "Excel automático" (fluxo de caixa, gastos por categoria, dívidas, carteira, metas, extrato) + **planilhas livres com fórmulas** (`=SOMA`, `=MEDIA`, `=SE`, `%`…) + **exportar tudo em .xlsx** |

Multiusuário desde o início (login com e-mail e senha), pensado para virar produto.

## Stack

- **Next.js 15** (App Router, Server Actions) + **TypeScript** + **Tailwind CSS 4**
- **PostgreSQL** + **Drizzle ORM**
- Recharts (gráficos), ExcelJS (exportação), jose + bcrypt (autenticação)
- APIs grátis: [brapi.dev](https://brapi.dev) (B3), CoinGecko (cripto), AwesomeAPI (câmbio), Banco Central SGS (Selic/CDI/IPCA)

## Rodando no seu PC

Pré-requisitos: Node 20+ e Docker (ou um Postgres qualquer).

```bash
git clone <url-do-repo> && cd gestor-financeiro
npm install
cp .env.example .env          # edite AUTH_SECRET e CRON_SECRET
docker compose up -d          # sobe o Postgres
npm run db:migrate            # cria as tabelas
npm run seed                  # (opcional) usuário demo: demo@gestor.app / demo1234
npm run dev                   # http://localhost:3000
```

Para ver cotações de ações da B3, crie um token grátis em brapi.dev e coloque em `BRAPI_TOKEN`.

## Publicando (grátis)

1. Crie um banco Postgres grátis no [Neon](https://neon.tech) e copie a connection string (com `?sslmode=require`).
2. Importe o repositório na [Vercel](https://vercel.com) e configure as variáveis do `.env.example`.
3. Rode as migrações uma vez apontando para o banco de produção: `DATABASE_URL="..." npm run db:migrate`.
4. O `vercel.json` já agenda o resumo diário do mercado para dias úteis às 18h30 (Brasília). A Vercel envia o `CRON_SECRET` automaticamente.

No celular, abra o site e use **"Adicionar à tela inicial"** — ele abre como app.

## Estrutura

```
src/
  app/
    (app)/            páginas logadas: painel, transacoes, dividas, investimentos, mercado, metas, planilhas
    api/cron/         resumo diário do mercado
    api/export/       download .xlsx
    actions.ts        todas as Server Actions (CRUD)
  db/schema.ts        tabelas (valores em centavos)
  lib/
    debts.ts          priorização avalanche/bola de neve + simulação de quitação
    journey.ts        as 7 etapas do zero à riqueza
    market.ts         cotações e resumo diário
    sheet-engine.ts   motor de fórmulas das planilhas livres
    auto-sheets.ts    planilhas automáticas
drizzle/              migrações SQL
scripts/seed.ts       dados de demonstração
```

## Próximos passos sugeridos

- Importar extrato do banco (OFX/CSV) e categorizar com IA
- Notificações de vencimento (e-mail / push)
- Planos pagos (Stripe) e página de vendas
- App nativo com Expo reaproveitando a API

> Conteúdo educativo. Não é recomendação de investimento.
