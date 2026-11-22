# See My EX-pense

A simple income/expense tracker with a hacker/terminal theme — Matrix-style animated
background, login gate, category master data, and Rupiah currency formatting.

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Express (Node.js)
- **Database:** local SQL Server (`DESKTOP-8IN7U4N\SQLEXPRESS`), Windows Authentication

## Prerequisites

- Node.js 18+
- SQL Server Express running on `DESKTOP-8IN7U4N\SQLEXPRESS`, with your Windows account allowed to log in
- **ODBC Driver 18 for SQL Server** (or 17 — edit the driver name in `server/src/db.js` and `server/sql/setup.js` if you only have 17 installed). Check with:
  ```powershell
  Get-OdbcDriver | Where-Object Name -like "*SQL Server*"
  ```
  If missing, install it from Microsoft's "ODBC Driver for SQL Server" download.

## 1. Create the database

```bash
cd server
npm install
copy .env.example .env    # defaults already point at DESKTOP-8IN7U4N\SQLEXPRESS
npm run setup-db          # creates/migrates the "expense_tracker" DB, "categories" and "transactions" tables
```

`setup-db` is safe to re-run. If you already had a `transactions` table from an
earlier version (free-text category column), it automatically migrates existing
rows to the new `categories` master table without losing data.

## 2. Run the backend

```bash
cd server
npm run dev                # http://localhost:4000
```

## 3. Run the frontend

```bash
cd client
npm install
npm run dev                # http://localhost:5173
```

The Vite dev server proxies `/api` requests to `http://localhost:4000`, so just open http://localhost:5173.

## Login

The app is gated behind a login screen.

- **Username:** `admin`
- **Password:** `admin123`

Change these via `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `server/.env`. The API
issues a static bearer token (`AUTH_TOKEN` in `.env`) on successful login, stored
in the browser's `localStorage` and sent as `Authorization: Bearer <token>` on
every request. All `/api/transactions` and `/api/categories` routes require it.

## Categories (master data)

Categories are stored in the database, not hardcoded. Use the **CATEGORIES** tab
in the app to add, rename, or delete income/expense categories. A category
can't be deleted while transactions still reference it (the API returns 409).

## API

| Method | Route                          | Description                          |
|--------|---------------------------------|---------------------------------------|
| POST   | `/api/auth/login`              | Log in, returns a bearer token        |
| GET    | `/api/categories`               | List categories (`?type=income\|expense`) |
| POST   | `/api/categories`               | Create a category                     |
| PUT    | `/api/categories/:id`           | Rename/retype a category              |
| DELETE | `/api/categories/:id`           | Delete a category (blocked if in use) |
| GET    | `/api/transactions`            | List transactions (`?type=`, `?month=YYYY-MM`) |
| GET    | `/api/transactions/summary`    | Totals: income, expense, balance      |
| POST   | `/api/transactions`            | Create a transaction (`categoryId`, not free text) |
| DELETE | `/api/transactions/:id`        | Delete a transaction                  |

All routes except `/api/auth/login` and `/api/health` require the bearer token.

## Notes

- Authentication to SQL Server uses **Windows Integrated Auth** (`Trusted_Connection=Yes`) via the `msnodesqlv8` driver — no password stored anywhere.
- If your machine only has a differently-named instance or a different ODBC driver installed, adjust `DB_SERVER` in `server/.env` and the `Driver={...}` string in `server/src/db.js` / `server/sql/setup.js`.
- Currency is formatted as Indonesian Rupiah (`Rp`).
