import { Connector } from "../_lib/connector";
import { SnapshotResult, SnapshotRunResponse } from "../_lib/types/response";

async function sendTelegramMessage(text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      message_thread_id: parseInt(process.env.TELEGRAM_TOPIC_ID ?? "0"),
      text
    })
  });
}

function buildReport(label: string, results: SnapshotResult[]): string {
  const lines: string[] = [`[Snapshot ${label}] Run complete`];

  const created = results.filter(r => r.status === 'created');
  if (created.length > 0) {
    lines.push(`\nCreated (${created.length}):`);
    for (const r of created) {
      if (r.mismatch) {
        lines.push(`  ${r.accountName}: calculated=${r.calculatedBalance}, actual=${r.actualBalance} [MISMATCH]`);
      } else {
        lines.push(`  ${r.accountName}: ${r.calculatedBalance}`);
      }
    }
  }

  const noPrior = results.filter(r => r.status === 'no_prior_snapshot');
  if (noPrior.length > 0) {
    lines.push(`\nSkipped - no prior snapshot (${noPrior.length}):`);
    for (const r of noPrior) lines.push(`  ${r.accountName}`);
  }

  const noTxs = results.filter(r => r.status === 'no_transactions');
  if (noTxs.length > 0) {
    lines.push(`\nSkipped - no transactions (${noTxs.length}):`);
    for (const r of noTxs) lines.push(`  ${r.accountName}`);
  }

  return lines.join('\n');
}

export async function runSnapshot(connector: Connector, now = new Date()): Promise<SnapshotRunResponse> {
  // Compute snapshot date (00:00:00 Bangkok time on the 1st) and label
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const year  = dateParts.find(p => p.type === 'year')?.value ?? '';
  const month = dateParts.find(p => p.type === 'month')?.value ?? '';
  const day = dateParts.find(p => p.type === 'day')?.value ?? '';
  const label = `${day}-${month}-${year}`;
  const snapshotDateMs = new Date(`${year}-${month}-${day}T00:00:00+07:00`).getTime();

  const accounts = await connector.fetchAllAccounts();
  const results: SnapshotResult[] = [];

  for (const account of accounts) {
    const latest = await connector.fetchLatestSnapshotForAccount(account.id);
    if (!latest) {
      results.push({ accountId: account.id, accountName: account.name, status: 'no_prior_snapshot' });
      continue;
    }

    const txs = await connector.fetchTransactionsForAccount(account.id, new Date(latest.date).toISOString());
    if (txs.length === 0) {
      results.push({ accountId: account.id, accountName: account.name, status: 'no_transactions' });
      continue;
    }

    let calculatedBalance = latest.balance;
    for (const tx of txs) {
      if (tx.toAccountId === account.id)   calculatedBalance += tx.amount;
      if (tx.fromAccountId === account.id) calculatedBalance -= tx.amount;
    }

    const snapshot = await connector.createSnapshot(account.id, account.name, calculatedBalance, snapshotDateMs);
    const mismatch = Math.abs(calculatedBalance - account.balance) > 0.001;

    results.push({
      accountId: account.id,
      accountName: account.name,
      status: 'created',
      snapshotId: snapshot.id,
      calculatedBalance,
      actualBalance: account.balance,
      mismatch
    });
  }

  const mismatches = results.filter(r => r.status === 'created' && r.mismatch);
  await sendTelegramMessage(buildReport(label, results));

  return { label, results, mismatches: mismatches.length };
}
