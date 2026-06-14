import { Connector } from "../_lib/connector";
import { Archive } from "../_lib/types/archive.type";
import { Transaction } from "../_lib/types/transaction.type";
import { ArchiveRunResponse } from "../_lib/types/response";

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

function getBangkokMonthYear(timestampMs: number): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(new Date(timestampMs));
  const year  = parseInt(parts.find(p => p.type === 'year')?.value  ?? '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value ?? '0');
  return { month, year };
}

function groupByMonthYear(transactions: Transaction[]): Map<string, { month: number; year: number; txs: Transaction[] }> {
  const buckets = new Map<string, { month: number; year: number; txs: Transaction[] }>();
  for (const tx of transactions) {
    const { month, year } = getBangkokMonthYear(tx.timestamp);
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (!buckets.has(key)) buckets.set(key, { month, year, txs: [] });
    buckets.get(key)!.txs.push(tx);
  }
  return buckets;
}

function buildReport(archived: number, archivesCreated: number, archivesUpdated: number, buckets: Map<string, { month: number; year: number; txs: Transaction[] }>, runDate: string): string {
  if (archived === 0) {
    return `[Archive ${runDate}] No transactions to archive`;
  }

  const lines: string[] = [`[Archive ${runDate}] Run complete`];
  lines.push(`\nArchived: ${archived} transaction(s)`);
  lines.push(`Archives created: ${archivesCreated}, updated: ${archivesUpdated}`);

  if (buckets.size > 0) {
    lines.push('\nBreakdown:');
    for (const [key, { txs }] of buckets) {
      const debit  = txs.filter(t => t.fromAccountId).reduce((s, t) => s + t.amount, 0);
      const credit = txs.filter(t => t.toAccountId).reduce((s, t) => s + t.amount, 0);
      lines.push(`  ${key}: ${txs.length} tx(s), debit=${debit}, credit=${credit}`);
    }
  }

  return lines.join('\n');
}

export async function runArchive(connector: Connector, now = new Date()): Promise<ArchiveRunResponse> {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const year  = dateParts.find(p => p.type === 'year')?.value  ?? '';
  const month = dateParts.find(p => p.type === 'month')?.value ?? '';
  const day   = dateParts.find(p => p.type === 'day')?.value   ?? '';
  const runDate = `${day}-${month}-${year}`;

  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 3);
  cutoff.setHours(0, 0, 0, 0);
  const cutoffIso = cutoff.toISOString();

  const transactions = await connector.fetchOldTransactions(cutoffIso);

  if (transactions.length === 0) {
    await sendTelegramMessage(`[Archive ${runDate}] No transactions to archive`);
    return { archived: 0, archivesCreated: 0, archivesUpdated: 0 };
  }

  const buckets = groupByMonthYear(transactions);
  let archivesCreated = 0;
  let archivesUpdated = 0;
  let archived = 0;

  for (const { month, year, txs } of buckets.values()) {
    let archive: Archive | null = await connector.fetchArchive(month, year);
    if (!archive) {
      archive = await connector.createArchivePage(month, year);
      const dbId = await connector.createArchiveTransactionDb(archive.id);
      await connector.setArchiveTransactionsDb(archive.id, dbId);
      archive = { ...archive, transactionsDbId: dbId };
      archivesCreated++;
    } else {
      archivesUpdated++;
    }

    const transactionsDbId = archive.transactionsDbId!;

    for (const tx of txs) {
      await connector.addTransactionToArchiveDb(transactionsDbId, tx);
      await connector.archiveTransaction(tx.id);
    }

    const debitDelta  = txs.filter(t => t.fromAccountId).reduce((s, t) => s + t.amount, 0);
    const creditDelta = txs.filter(t => t.toAccountId).reduce((s, t) => s + t.amount, 0);
    await connector.updateArchiveStats(archive.id, txs.length, debitDelta, creditDelta, archive);

    archived += txs.length;
  }

  await sendTelegramMessage(buildReport(archived, archivesCreated, archivesUpdated, buckets, runDate));

  return { archived, archivesCreated, archivesUpdated };
}
