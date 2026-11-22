# See My EX-pense

A modern, mobile-first money tracker: income, expenses, transfers between wallets,
monthly budgets, recurring bills, insights and multi-user accounts.

- **Frontend:** React 18 + Vite + Tailwind CSS + Framer Motion (installable PWA)
- **Backend:** Node.js + Express, JWT auth with bcrypt-hashed passwords
- **Database:** SQL Server (Windows auth for local dev, SQL auth in Docker)

## Features

- **Quick entry:** type `kopi 25k gopay kemarin` or `10 november lupa bayar makan 35k` and the amount,
  category, account and date fill in. Debts too: `ngutangin budi 50rb`, `budi udah balikin 20rb`
- **Split bills:** `makan 300k bagi 3 sama budi sari`: your share is the expense, the rest goes to
  each person's debt
- **Learns from you:** move "Indomaret" to Groceries once and it goes there from then on
- **Telegram bot:** send the same sentences (several lines at once is fine), reply to the bot to
  fix one (`30k`, `kemarin`, `food`, `hapus`), ask `/spent makan bulan ini`, `/debts`, `/budi`,
  `/goals`, save with `nabung laptop 500k`, and get a PDF report every month
- **Close the books on payday ("tutup buku"):** from the Home card or by sending `tutup buku` to the bot.
  Choose *today* (the new period starts tomorrow) or *yesterday* (it starts today); every total, budget,
  projection and report then runs payday to payday instead of the 1st to the 1st. Until the first close,
  periods are calendar months. Undo is offered right after. Closing can also start the balances afresh:
  type what's really left in each account (empty means 0); in Telegram tap *Reset to 0*, then
  `saldo cash 200k`. Otherwise balances simply carry on.
- **Savings goals** with how much to put aside each month
- **Month-end projection** and **subscription detection** (offered as recurring rules)
- **PDF report** per period, downloadable from Insights, and sent to Telegram when a new period starts
- **Works offline:** the app opens without a connection, and new transactions are saved on the device
  and synced when you're back online
- **Notifications:** a daily reminder (only if you haven't logged anything), budget alerts at 80% and
  100%, and a weekly summary every Monday
- **App lock:** a PIN and fingerprint / face unlock on the device
- **Coming up:** recurring bills still to be paid this month, on the home screen
- **Fast entry, no dropdowns:** tap chips for type, category (most-used first), account and date; quick `+10k / +50k / +100k` amounts
- **Spending first:** the home screen shows what you spent this month; income is shown on its own and
  never netted against spending (not every income source has to be tracked)
- **Hide amounts** with the eye button in the header (remembered per device)
- **Edit and delete** any transaction, with **Undo** after delete
- **Balances per account** (Cash, Bank, GoPay, ...) on the home screen. Paying with GoPay lowers GoPay;
  `isi gopay 1jt` (from the bank), `tf 500k dari bca ke gopay` or `tarik tunai 300k` moves money between
  accounts as a transfer, which is never counted as income or spending. Set an account's real balance once
  (tap it) and it stays in step; `/saldo` in Telegram lists them all
- **Month switcher**, search, type and account filters, paginated activity grouped by day
- **Insights:** spending by category, 6-month income vs expense chart (with a table view), daily average spend
- **Debts:** track who owes you and whom you owe, per person. Lending or paying back is an expense,
  borrowing or being paid back is income, so balances and stats stay right. Switch on *Debt* when adding
  a transaction, or use the Debts page; *Mark as settled* books the remaining balance in one tap
- **Budgets** per expense category with on-track / close / over status
- **Recurring transactions** (salary, rent, subscriptions) booked automatically each month
- **CSV export and import** (Excel friendly, accepts `25.000` and `31/12/2026` formats, all-or-nothing)
- **Multi-user:** admins register accounts; every user's data is private
- Responsive: bottom navigation and bottom sheets on phones, sidebar and dialogs on desktop

## Project structure

```
server/
  db/setup.js            create / migrate the database (idempotent)
  src/
    app.js               express app (middleware + routes)
    server.js            starts the HTTP server
    config/              env + database connection
    middleware/          auth, params, error handling
    routes/              HTTP layer only: parse, call a service, respond
    services/            business logic and SQL
    lib/                 pure helpers (dates, csv, validation, rate limit)
  test/                  unit tests (node --test)
client/
  src/
    api/                 fetch client + endpoint functions
    context/             auth, toasts, shared app data
    hooks/               small reusable hooks
    lib/                 formatting, dates, category icons
    components/ui/       buttons, chips, sheets, ...
    components/layout/   app shell, navigation, month switcher
    components/charts/   trend chart, category bars
    features/            one folder per screen (home, activity, debts, insights, settings, auth, transactions)
shared/                  pure code used by both (quick-entry parser + tests)
e2e/                     browser tests (Playwright)
.github/workflows/ci.yml unit tests, build, and browser tests against SQL Server on every push
docker-compose.yml       API + web (an optional SQL Server in docker-compose.db.yml)
```

## Run with Docker (server deployment)

Requires Docker with Compose v2.

```bash
cp .env.example .env        # fill in DB_PASSWORD, JWT_SECRET, ADMIN_PASSWORD (and APP_PORT)
docker compose up -d --build
docker compose logs -f api  # wait for: database "expense_tracker" is ready
```

Open `http://<server>:<APP_PORT>` and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
The API creates and migrates its database on every start.
Put HTTPS in front (Caddy, nginx, Cloudflare Tunnel...) before exposing it to the internet.
Notifications, offline mode and fingerprint unlock only work over HTTPS. The push keys (VAPID) are
generated on first start and kept in the database; set `VAPID_SUBJECT=mailto:you@yourdomain` to use your own contact.

**Database.** By default the app uses an existing SQL Server: `DB_SERVER=host.docker.internal`
reaches one published on the Docker host (for example a `mssql/server` container with
`0.0.0.0:1433->1433`). The login needs permission to create a database the first time
(`sa` has it). No SQL Server yet? Uncomment `COMPOSE_FILE=docker-compose.yml:docker-compose.db.yml`
in `.env` and set `DB_SERVER=db`: compose then runs one too (x86-64 host, about 2 GB of RAM,
data in the `mssql-data` volume).

### Telegram bot

1. Create a bot with [@BotFather](https://t.me/BotFather) (`/newbot`) and copy its token.
2. In the server's `.env`: `TELEGRAM_BOT_TOKEN=...` and `APP_URL=https://your-domain` (for the "Open app" button).
3. `docker compose up -d`, then in the app open **Settings → Telegram → Connect Telegram** and tap Start in Telegram.

Only one process may run a bot token at a time: don't put the same token in a local `server/.env`.

## Run locally (Windows, SQL Server Express)

Prerequisites: Node.js 18+, SQL Server Express, ODBC Driver 17 or 18 for SQL Server.

```bash
cd server
npm install
copy .env.example .env      # set DB_SERVER, JWT_SECRET, ADMIN_PASSWORD
npm run setup-db            # creates / migrates the database and the first admin
npm run dev                 # http://localhost:4000

cd ../client
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

To open it on your phone on the same Wi-Fi, run `npm run dev -- --host` in `client`
and visit `http://<your-pc-ip>:5173`. Use "Add to Home Screen" to install it as an app.

Upgrading from v1 (single user)? `npm run setup-db` keeps all existing data and assigns it
to the first admin account.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for ideas not built yet.

## Tests

```bash
cd server && npm test        # API helpers
cd client && npm test        # quick-entry parser (shared/)

# Browser tests against a running app (API + web on :5173); creates and deletes a test user
cd e2e && npm ci && npx playwright install chromium
E2E_ADMIN_PASSWORD=... npx playwright test     # PW_CHANNEL=chrome to use your installed Chrome
```

## API

`month` everywhere means a book period: a calendar month until the books are first closed.

All routes except `POST /api/auth/login` and `GET /api/health` need `Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Sign in, returns `{ token, user }` (5 failed tries per 15 min) |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/auth/me/password` | Change own password |
| GET/POST | `/api/users` | List / register users (admin) |
| PUT | `/api/users/:id/password`, `/api/users/:id/role` | Reset password, change role (admin) |
| DELETE | `/api/users/:id` | Delete a user and their data (admin) |
| GET | `/api/periods?month=` | A book period's dates (`month` is its `YYYY-MM` key; omitted: the current one) |
| POST/DELETE | `/api/periods/close` | Close the books `{ when: 'today' \| 'yesterday', balances?: { accountId: amount } }` / undo the latest close |
| GET | `/api/transactions` | `?month&type&accountId&categoryId&personId&q&page&pageSize` |
| GET | `/api/transactions/summary` | Month income / expense / net + total balance |
| GET | `/api/transactions/stats` | By-category totals + 6-month trend |
| GET | `/api/transactions/export` | CSV download (same filters) |
| POST | `/api/transactions/import` | `{ csv }`, all-or-nothing |
| POST/PUT/DELETE | `/api/transactions[/:id]` | Create / update / delete. Debts: pass `personId` or `personName` instead of `categoryId` |
| GET/POST/PUT/DELETE | `/api/categories[/:id]` | Categories |
| GET/POST/PUT/DELETE | `/api/accounts[/:id]` | Accounts with balances |
| GET | `/api/budgets?month=` | Budgets with spent amounts |
| PUT | `/api/accounts/:id/balance` | `{ balance }`: what it really holds now (moves the opening balance, adds no transaction) |
| PUT | `/api/budgets/:categoryId` | `{ amount }`, 0 removes |
| GET | `/api/people` | People with debt balances (positive: they owe you) |
| PUT/DELETE | `/api/people/:id` | Rename / remove (transactions are kept) |
| GET/POST | `/api/recurring` | Monthly recurring rules |
| PATCH/DELETE | `/api/recurring/:id` | Pause / resume / delete |
