# PaperCut Web Cashier bulk deposit helper

An unofficial Violentmonkey userscript for submitting multiple PaperCut Web Cashier deposits from a CSV or text file while using an already authenticated cashier session.

The helper fills and submits one row, waits for PaperCut's receipt page, advances the queue exactly once, returns to the Deposit page, and then processes the next row.

> [!CAUTION]
> Deposits change real user balances. Test with two low-value rows first. Never rerun a file unless you have checked PaperCut Order History and confirmed that none of its rows were already credited.

## Tested environment

- PaperCut MF 25.0.8
- Web Cashier Deposit page
- Google Chrome
- Violentmonkey 2.43.0 MV3
- Cash payment method

PaperCut installations and custom themes can differ. This project is not affiliated with or supported by PaperCut Software.

## Features

- Reads `.csv` or `.txt` files locally in the browser
- Previews usernames, amounts, comments, row count, and total
- Requires confirmation before starting a batch
- Persists queue progress across PaperCut receipt-page navigation
- Prevents duplicate Deposit clicks from scheduled page handlers
- Prevents one receipt from advancing the queue more than once
- Stops if PaperCut returns to Deposit without first reaching a receipt
- Reports the processed count when the queue completes

## Input format

Use UTF-8 text with one header row:

```csv
username,amount,comment
student001,10.00,July-topup
student002,25.50,July-topup
```

The legacy header spelling `commend` is also accepted:

```csv
username,amount,commend
student001,10.00,July-topup
student002,25.50,July-topup
```

Rules:

- `username` is required.
- `amount` must be a positive number with no currency symbol.
- The third column is stored as the PaperCut transaction comment.
- Do not include thousands separators in amounts.
- The current parser treats everything after the second comma as the comment.

See [example.csv](example.csv).

## Installation

1. Install [Violentmonkey](https://violentmonkey.github.io/get-it/).
2. Open the Violentmonkey dashboard and create a new script.
3. Replace the editor contents with [`papercut_bulk_deposit_compat.user.js`](papercut_bulk_deposit_compat.user.js).
4. Check the `@match` line near the top of the script. Change the hostname and port if your PaperCut server is not `10.52.5.20:9191`.
5. Save the script and enable it.
6. Log in to PaperCut Web Cashier and open the Deposit page.

Do not share your PaperCut password, session cookie, or exported browser data. The userscript uses only the session already open in your browser.

## Running a batch

1. Confirm PaperCut's visible payment method is **Cash**.
2. In the **Bulk deposit helper** panel, choose the input file.
3. Review every displayed row, the row count, and the total.
4. Click **Start deposits** and confirm the batch.
5. Keep the tab open. Do not use Back, refresh, or navigate to Transactions while the queue is running.
6. Wait for `Bulk deposit complete: N of N rows.`
7. Compare PaperCut Order History with the input file before using another file.

For a large batch, first run two new low-value test rows. Only proceed with 100 rows after both test receipts and Order History entries are correct.

## Queue lifecycle

```text
ready -> awaiting receipt -> returning -> ready for next row
```

The queue index advances only from `awaiting receipt` when PaperCut loads `WebCashierDepositReceipt`. Reloading that receipt does not advance the index again.

## Canceling or recovering

- Use **Cancel** in the helper panel to clear the stored queue.
- If the helper reports an error, do not restart the same file immediately.
- Check Order History to determine the last successful row.
- Create a new file containing only rows that have not been credited.
- If uncertain, stop and ask the PaperCut administrator to reconcile the transactions.

## Important limitations

- This automates PaperCut's browser interface; it is not an official PaperCut API.
- A receipt URL is treated as confirmation that PaperCut accepted the current deposit.
- The script does not provide server-side idempotency or detect a previously credited CSV row.
- Closing the tab, session expiry, theme changes, or browser-extension restrictions can interrupt a batch.
- Use PaperCut's supported server-command or administrative batch process when available.

## License

MIT. See [LICENSE](LICENSE).
