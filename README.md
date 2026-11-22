# See My EX-pense

A modern, mobile-first money tracker: income, expenses, transfers between wallets,
monthly budgets, recurring bills, insights and multi-user accounts.

- **Frontend:** React 18 + Vite + Tailwind CSS + Framer Motion (installable PWA)
- **Backend:** Node.js + Express, JWT auth with bcrypt-hashed passwords
- **Database:** SQL Server (Windows auth for local dev, SQL auth in Docker)

## Features

- **Quick entry:** type `kopi 25k gopay kemarin` and the amount, category, account and date fill in
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
- **Transfers** between accounts (Cash, Bank, e-wallets) with a live balance per account
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
docker-compose.yml       SQL Server + API + web
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
cd server && npm test
cd client && npm test
```

## API

All routes except `POST /api/auth/login` and `GET /api/health` need `Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Sign in, returns `{ token, user }` (5 failed tries per 15 min) |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/auth/me/password` | Change own password |
| GET/POST | `/api/users` | List / register users (admin) |
| PUT | `/api/users/:id/password`, `/api/users/:id/role` | Reset password, change role (admin) |
| DELETE | `/api/users/:id` | Delete a user and their data (admin) |
| GET | `/api/transactions` | `?month&type&accountId&categoryId&personId&q&page&pageSize` |
| GET | `/api/transactions/summary` | Month income / expense / net + total balance |
| GET | `/api/transactions/stats` | By-category totals + 6-month trend |
| GET | `/api/transactions/export` | CSV download (same filters) |
| POST | `/api/transactions/import` | `{ csv }`, all-or-nothing |
| POST/PUT/DELETE | `/api/transactions[/:id]` | Create / update / delete. Debts: pass `personId` or `personName` instead of `categoryId` |
| GET/POST/PUT/DELETE | `/api/categories[/:id]` | Categories |
| GET/POST/PUT/DELETE | `/api/accounts[/:id]` | Accounts with balances |
| GET | `/api/budgets?month=` | Budgets with spent amounts |
| PUT | `/api/budgets/:categoryId` | `{ amount }`, 0 removes |
| GET | `/api/people` | People with debt balances (positive: they owe you) |
| PUT/DELETE | `/api/people/:id` | Rename / remove (transactions are kept) |
| GET/POST | `/api/recurring` | Monthly recurring rules |
| PATCH/DELETE | `/api/recurring/:id` | Pause / resume / delete |
