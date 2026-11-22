# Roadmap

Ideas for later, in rough order of impact.

## Faster entry
- **Home-screen shortcut "+ Expense"**: long-press the app icon to jump straight into a new expense
  (web manifest `shortcuts` pointing at `/?add=expense`, which the app already understands).
- **Favourite templates**: one-tap entries such as "Coffee 25k" or "Parking 5k", saved without opening the form.

## Telegram
- **Receipt photos**: send a photo of a receipt, the amount, shop and date are read automatically
  (needs an OCR service).
- **Voice notes**: "makan siang tiga puluh lima ribu" recorded from a voice message (needs speech-to-text).

## Smarter defaults
- **Default account per category**: if food is usually paid with GoPay, pick GoPay for food.

## Reminders
- **Debt due dates**: an optional "pay back by" date on a debt, with a reminder when it's close
  ("Karta promised to pay on the 30th").

## Insights
- **Unusual spending**: "Transport this week is twice the usual"
- **Compare with last month** on Home, e.g. "Food & Drinks up 32% from October".
- **Spending calendar (heatmap)**: which days of the month cost the most.

## Comfort
- **Receipt photos** attached to a transaction.
- **Light theme**, plus "follow the system setting".

## Money features
- **Tags** like `#bali-trip`, to see the total of one event across categories.
- **Instalments** (cicilan HP 12x): months and amount left.

## Server
- **Errors to the admin's Telegram**: a message when the API fails or a backup doesn't run.
- **Automatic daily database backups**, kept off the server (another disk or cloud storage),
  with a tested restore procedure.

## Done
- Quick entry ("kopi 25k gopay kemarin", "10 november ...", debts like "ngutangin budi 50rb",
  split bills "makan 300k bagi 3 sama budi sari"), learning categories from corrections.
- Telegram bot: several lines per message, corrections by replying, questions
  (/spent, /debts, /budi, /goals), savings ("nabung laptop 500k"), monthly PDF report.
- Offline saving with sync, daily reminder, budget alerts, weekly summary, app lock,
  upcoming bills, subscription detection, month-end projection, savings goals.
- Browser tests (Playwright) and CI on every push.
