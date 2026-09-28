# PaperCut Bulk Deposit

A browser **bookmarklet** that tops up many PaperCut MF accounts at once through the **Web Cashier → Deposit** page.

You give it a list of `username, amount, comment`. It types each row into the normal Deposit form, clicks **Deposit**, reads the result and moves on to the next row. Unknown users and errors are **skipped** without stopping the run. At the end you get a **summary** and a CSV of results.

- No browser extension (Tampermonkey etc.) needed
- No server, nothing to install on PaperCut
- Uses your own logged-in cashier session, so the tool never sees your password
- Works in Chrome and Microsoft Edge

![flow](https://img.shields.io/badge/flow-login%20%E2%86%92%20click%20bookmark%20%E2%86%92%20load%20list%20%E2%86%92%20run-4b873c)

---

## Contents

- [How it works](#how-it-works)
- [Install (one time)](#install-one-time)
- [Prepare your list](#prepare-your-list)
- [Run a top-up](#run-a-top-up)
- [Test first with 1–2 users](#test-first-with-12-users)
- [Result statuses](#result-statuses)
- [Safety rules](#safety-rules)
- [Troubleshooting](#troubleshooting)
- [For developers](#for-developers)

---

## How it works

```
Your PaperCut tab (logged in)
 ├── Green "Bulk Deposit" panel  ← you load the list and press Start
 └── Hidden PaperCut Deposit page (frame, or popup if frames are blocked)
       for each row:
         1. open a fresh Deposit form
         2. type username → wait for name + balance (or "not found")
         3. type amount + comment → click Deposit
         4. read receipt / error → record DONE, SKIPPED or CHECK
```

It has to run **inside** the PaperCut tab. Browsers don't let a separate website control another site's pages or sessions. That's why it's a bookmarklet and not a standalone web page.

---

## Install (one time)

1. Download **`dist/PaperCut_Bulk_Deposit_Installer.html`** from this repo.
2. Open **Chrome** or **Edge** and show the bookmarks bar:
   - Keyboard: **Ctrl + Shift + B** (Mac: **Cmd + Shift + B**)
   - Chrome menu: **⋮ → Bookmarks and lists → Show bookmarks bar**
   - Edge menu: **⋯ → Favorites → Show favorites bar → Always**
3. Double-click the installer file to open it in Chrome/Edge. (If it opens in another browser: right-click → **Open with** → Chrome/Edge.)
4. **Drag** the green **PaperCut Bulk Deposit** button up onto the bookmarks bar and let go.
   Clicking the button only shows a reminder; you have to drag it.

### Updating to a new version

Right-click the old bookmark → **Delete**, then drag the button from the new installer. The panel header shows the version (e.g. `v1.1`).

### If you cannot drag (bookmarks blocked)

1. Open the PaperCut **Deposit** page.
2. Press **F12** (or **Ctrl + Shift + J**; on laptops maybe **Fn + F12**) to open Developer Tools → **Console** tab.
3. Copy the code from the grey box at the bottom of the installer page (or from `dist/papercut-bulk-deposit.min.js`).
4. Paste into the Console and press **Enter**. If Chrome warns, type `allow pasting`, press Enter, then paste again.

---

## Prepare your list

Three columns: **username**, **amount**, **comment**. The header row is optional.

You can **paste straight from Excel** (tab-separated) or load a **.csv / .txt / .tsv** file.

```
username	amount	comment
st000001	850	ISE_beforeAug25Update
st000002	1700	ISE_beforeAug25Update
```

```csv
username,amount,comment
st000001,850,ISE_beforeAug25Update
st000002,1700,ISE_beforeAug25Update
```

See [`examples/`](examples/).

- Amount must be a number greater than 0 (`850`, `850.00`, `1,700` are all fine).
- Lines that can't be read are listed as **INVALID LINE** and skipped.
- A username that appears twice is flagged in the preview, but **both rows will be deposited**. Remove duplicates you don't want.

> ⚠️ Real lists contain student IDs. Keep them in `lists/` (ignored by git) or outside the repo. **Do not commit them.**

---

## Run a top-up

1. Log in to **PaperCut Web Cashier** (e.g. `http://10.52.5.20:9191`) and click **Deposit**.
   Check that **Payment method = Cash**.
2. Click the **PaperCut Bulk Deposit** bookmark. A green panel opens on the right.
3. Paste your list or click **Choose File**, then click **Check list**.
   Confirm the **row count** and **total** match what you expect.
4. *(Recommended)* Click **Check users only**. This looks up every username **without depositing**.
5. Click **Start deposits** → **OK**.
6. Keep the tab open until the panel says **Finished**. The progress bar and the row table update live, and **Live PaperCut view** shows what the tool is doing (click **bigger** to enlarge).
7. Read the **Summary**, then click **Download results (CSV)** to keep a record. **Copy summary** puts a text version on the clipboard.
8. Click **New list** for the next batch.

**Pause / Resume:** **Pause** stops after the current row. **Resume** continues from the next unfinished row.

---

## Test first with 1–2 users

1. Paste only 1–2 rows into the text box → **Check list**.
2. **No money moves:** click **Check users only**. Each user should show **FOUND** with their name and balance.
3. **Real test:** click **Start deposits**, then confirm the new balance in PaperCut / **Order History**.
4. **Before the full run, remove the rows you already tested from your list.** Otherwise those users get topped up twice. The tool does not remember deposits between separate runs.

---

## Result statuses

| Status | Meaning | What to do |
|---|---|---|
| **DONE** | PaperCut showed a receipt / success | Nothing |
| **SKIPPED** | User not found, or PaperCut rejected the deposit. **No money was added.** | Fix the username/amount and deposit it separately |
| **CHECK** | Deposit was clicked but no clear receipt or error came back | Check **Order History** before redoing. It may have gone through |
| **NOT RUN** | Run was paused/closed before this row | Press **Resume** |
| **INVALID LINE** | Row couldn't be read (missing username/amount) | Fix the line |
| **FOUND / NOT FOUND?** | Results of **Check users only** (nothing deposited) | — |

Results CSV columns: `row, username, amount, comment, status, account_seen, detail`

---

## Safety rules

- **Each row is submitted at most once. It is never retried automatically**, so a slow server can't cause a double top-up.
- A confirmation dialog shows the row count and **total** before any deposit.
- Stops (instead of skipping) when something affects **every** row:
  - payment method is not **Cash**
  - PaperCut asks you to log in again → log in, then **Resume**
  - the Deposit page fails to load 3 times in a row
- Progress is saved in the browser. If the tab closes, click the bookmark again → **Resume**. A row that was mid-submit when the tab closed is marked **CHECK**, not repeated.
- Nothing is sent anywhere except your own PaperCut server.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Nothing happens when clicking the bookmark | Make sure you're on the PaperCut page (port `9191`). Try the Console method. |
| Every user shows **NOT FOUND?** in *Check users only* | Click **Copy debug info** in the panel and send the text to the maintainer. It contains the page structure around the Username box (no passwords). |
| "Popup blocked" | Allow pop-ups for the PaperCut address, then press **Start** again. |
| "PaperCut asked for a login" | Click **bigger** on the live view, log in there, then **Resume**. |
| Many rows are **CHECK** but deposits went through | PaperCut's receipt page text differs from what the tool expects. Send **Copy debug info** plus a screenshot of the receipt page. |
| F12 does nothing | Try **Ctrl + Shift + J** or **Fn + F12**. On managed PCs dev tools may be disabled, so use the bookmark. |

---

## For developers

```
src/papercut-bulk-deposit.js   Source (edit this)
build.js                       Minifies src and generates dist/
dist/                          Installer page + minified bookmarklet (commit these so users can download them)
test/mock-server.js            Fake PaperCut deposit page on localhost:9191
test/run-all.js                End-to-end tests (Playwright) against the fake page
examples/                      Sample lists with fake usernames
```

```bash
npm install
npm run build        # regenerate dist/ after changing src/
npm test             # runs the bookmarklet against the fake page (never a real server)
# if Playwright's browser isn't installed: CHROME_PATH=/path/to/chrome npm test
```

**Tunable constants** at the top of `src/papercut-bulk-deposit.js`:

| Constant | Default | Purpose |
|---|---|---|
| `LOOKUP_WAIT` | 10000 ms | Wait for name/balance after typing a username |
| `RESULT_WAIT` | 25000 ms | Wait for receipt/error after clicking Deposit |
| `LOAD_WAIT` | 20000 ms | Wait for the Deposit page to load |
| `GAP` | 700 ms | Pause between rows |
| `ERROR_RE` / `OK_RE` | — | Words that mean error / success on the page |

After changing anything, bump `VERSION`, run `npm run build`, and commit both `src/` and `dist/`.

### Changelog

- **1.1**: More robust username lookup (typing, change and blur events plus jQuery triggers); detects name/balance anywhere on the page; `LOOKUP_WAIT` 10 s; **Copy debug info** button; version shown in the panel.
- **1.0**: First bookmarklet version: frame/popup worker, skip-and-continue, summary + CSV export, pause/resume, crash-safe resume.
