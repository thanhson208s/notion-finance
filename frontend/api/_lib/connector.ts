import { Client, DatabaseObjectResponse, PageObjectResponse, UpdatePageParameters } from "@notionhq/client";
import { Account, AccountType, computePriorityScore } from "./types/account.type";
import { Category, CategoryType } from "./types/category.type";
import { Transaction } from "./types/transaction.type";
import { Card } from "./types/card.type";
import { Promotion, PromotionCategory, PromotionType } from "./types/promotion.type";
import { Statement } from "./types/statement.type";
import { AddPromotionRequest, AddStatementRequest } from "./types/request";
import { Snapshot } from "./types/snapshot.type";
import { Archive } from "./types/archive.type";
import { DatabaseError, SchemaError } from "./types/error";

export function toISOStringWithTimezone(ms: number, tz: string): string {
  const date = new Date(ms);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  const offset = getUTCOffsetString(date, tz);
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${offset}`;
}

function getUTCOffsetString(date: Date, tz: string): string {
  const localStr = date.toLocaleString('en-CA', { timeZone: tz, hour12: false });
  const utcStr = date.toLocaleString('en-CA', { timeZone: 'UTC', hour12: false });
  const diff = Math.round((new Date(localStr).getTime() - new Date(utcStr).getTime()) / 60000);
  const sign = diff >= 0 ? '+' : '-';
  const abs = Math.abs(diff);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export class Connector {
  notion = new Client({ auth: process.env.NOTION_API_KEY })

  async fetchAllAccounts(): Promise<Account[]> {
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_ACCOUNT_DATABASE_ID as string
    });
    return pages.map(page => this.mapPageToAccount(page));
  }

  async fetchAllCards(): Promise<Card[]> {
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_CARD_DATABASE_ID as string
    });
    return pages.map(page => this.mapPageToCard(page));
  }

  async fetchCardById(id: string): Promise<Card> {
    const response = await this.notion.pages.retrieve({ page_id: id });
    if (!('properties' in response)) throw new DatabaseError('Card not found');
    return this.mapPageToCard(response as PageObjectResponse);
  }

  async fetchTransactionsByCard(cardId: string, startDate: string, endDate: string): Promise<Transaction[]> {
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_TRANSACTION_DATABASE_ID as string,
      filter: {
        and: [
          { property: "Linked card", relation: { contains: cardId } },
          { property: "Timestamp", date: { on_or_after: startDate } },
          { property: "Timestamp", date: { on_or_before: endDate } }
        ]
      },
      sorts: [{ property: "Timestamp", direction: "descending" }]
    });
    return pages.map(page => this.mapPageToTransaction(page));
  }

  async fetchPromotions(cardId?: string): Promise<Promotion[]> {
    const filter = cardId ? {
      property: "Card",
      relation: { contains: cardId }
    } : undefined;
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_PROMOTION_DATABASE_ID as string,
      filter
    });
    return pages.map(page => this.mapPageToPromotion(page));
  }

  async addPromotion(data: AddPromotionRequest): Promise<Promotion> {
    const response = await this.notion.pages.create({
      parent: { data_source_id: process.env.NOTION_PROMOTION_DATABASE_ID as string },
      properties: {
        "Name": { type: "title", title: [{ type: "text", text: { content: data.name } }] },
        "Card": { type: "relation", relation: data.cardId ? [{ id: data.cardId }] : [] },
        "Category": data.category ? { type: "select", select: { name: data.category } } : { type: "select", select: null },
        "Type": { type: "select", select: { name: data.type } },
        "Expiry Date": data.expiresAt
          ? { type: "date", date: { start: new Date(data.expiresAt).toISOString().split('T')[0]! } }
          : { type: "date", date: null },
        "Link": { type: "url", url: data.link ?? null }
      }
    });
    if (!("properties" in response))
      throw new DatabaseError(`Promotion not created`);
    return this.mapPageToPromotion(response);
  }

  async deletePromotion(id: string): Promise<void> {
    await this.notion.pages.update({ page_id: id, in_trash: true });
  }

  async fetchStatements(cardId?: string): Promise<Statement[]> {
    const filter = cardId ? {
      property: "Card",
      relation: { contains: cardId }
    } : undefined;
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_STATEMENT_DATABASE_ID as string,
      filter
    });
    return pages.map(page => this.mapPageToStatement(page));
  }

  async addStatement(data: AddStatementRequest): Promise<Statement> {
    const billingDate = new Date(data.billingDate);
    const name = `stmt-${billingDate.getFullYear()}-${String(billingDate.getMonth() + 1).padStart(2, '0')}`;
    const response = await this.notion.pages.create({
      parent: { data_source_id: process.env.NOTION_STATEMENT_DATABASE_ID as string },
      properties: {
        "Name": { type: "title", title: [{ type: "text", text: { content: name } }] },
        "Card": { type: "relation", relation: [{ id: data.cardId }] },
        "Billing Date": { type: "date", date: { start: new Date(data.billingDate).toISOString().split('T')[0]! } },
        "Spending": { type: "number", number: data.spending },
        "Cashback": { type: "number", number: data.cashback },
        "Note": { type: "rich_text", rich_text: data.note ? [{ type: "text", text: { content: data.note } }] : [] }
      }
    });
    if (!("properties" in response))
      throw new DatabaseError(`Statement not created`);
    return this.mapPageToStatement(response);
  }

  async deleteStatement(id: string): Promise<void> {
    await this.notion.pages.update({ page_id: id, in_trash: true });
  }

  async fetchAccount(accountId: string): Promise<Account> {
    const response = await this.notion.pages.retrieve({
      page_id: accountId
    });
    if (!("properties" in response))
      throw new DatabaseError(`Account ${accountId} not found`);
    return this.mapPageToAccount(response);
  }

  async updateAccountBalance(accountId: string, balance: number): Promise<Account> {
    const response = await this.notion.pages.update({
      page_id: accountId,
      properties: {
        'Balance': {
          type: 'number',
          number: balance
        }
      }
    });

    if (!("properties" in response))
      throw new DatabaseError(`Account ${accountId} not update`);
    return this.mapPageToAccount(response);
  }

  async updateAccountAfterTransaction(
    accountId: string,
    balance: number,
    totalTransactions: number,
    lastTransactionDate: number
  ): Promise<Account> {
    const response = await this.notion.pages.update({
      page_id: accountId,
      properties: {
        'Balance': { type: 'number', number: balance },
        'Total Transactions': { type: 'number', number: totalTransactions },
        'Last Transaction Date': { type: 'date', date: { start: new Date(lastTransactionDate).toISOString() } }
      }
    });

    if (!("properties" in response))
      throw new DatabaseError(`Account ${accountId} not updated`);
    return this.mapPageToAccount(response);
  }

  async fetchCategory(categoryId: string): Promise<Category> {
    const response = await this.notion.pages.retrieve({
      page_id: categoryId
    });
    if (!("properties" in response))
      throw new DatabaseError(`Category ${categoryId} not found`);
    return this.mapPageToCategory(response);
  }

  async fetchCategories(type: string | null): Promise<Category[]> {
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_CATEGORY_DATABASE_ID as string,
      filter: type ? {
        property: "Type",
        select: {
          equals: type
        }
      } : undefined
    });
    return pages.map(page => this.mapPageToCategory(page));
  }

  async fetchAllTransactions(startDate?: string, endDate?: string): Promise<Transaction[]> {
    const dateFilters = [
      ...(startDate ? [{ property: "Timestamp", date: { on_or_after: startDate } }] : []),
      ...(endDate   ? [{ property: "Timestamp", date: { on_or_before: endDate  } }] : [])
    ];
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_TRANSACTION_DATABASE_ID as string,
      filter: dateFilters.length > 0 ? { and: dateFilters } : undefined,
      sorts: [{ property: "Timestamp", direction: "descending" }]
    });
    return pages.map(page => this.mapPageToTransaction(page));
  }

  async fetchTransactions(type: 'expense' | 'income', startDate?: string, endDate?: string): Promise<Transaction[]> {
    const dateFilters = [
      ...(startDate ? [{ property: "Timestamp", date: { on_or_after: startDate } }] : []),
      ...(endDate ? [{ property: "Timestamp", date: { on_or_before: endDate } }] : [])
    ];
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_TRANSACTION_DATABASE_ID as string,
      filter: {
        and: [
          type === 'expense'
            ? { property: "FromAccount", relation: { is_not_empty: true } }
            : { property: "ToAccount", relation: { is_not_empty: true } },
          { property: "Category", relation: { does_not_contain: process.env.NOTION_TRANSFER_TRANSACTION_ID as string } },
          { property: "Category", relation: { does_not_contain: process.env.NOTION_ADJUSTMENT_TRANSACTION_ID as string } },
          ...dateFilters
        ]
      },
      sorts: [{ property: "Timestamp", direction: "descending" }]
    });
    return pages.map(page => this.mapPageToTransaction(page));
  }

  async addTransaction(fromAccountId: string | null, toAccountId: string | null, amount: number, categoryId: string, note: string, timestamp?: number, linkedCardId?: string): Promise<Transaction> {
    const response = await this.notion.pages.create({
      parent: {
        data_source_id: process.env.NOTION_TRANSACTION_DATABASE_ID as string
      },
      properties: {
        "ID": {
          type: "title",
          title: [
            {
              type: 'text',
              text: {
                content: `${categoryId}-${new Date().getTime()}-${amount}`
              }
            }
          ]
        },
        "Timestamp": {
          type: 'date',
          date: {
            start: toISOStringWithTimezone(timestamp ?? Date.now(), 'Asia/Bangkok')
          }
        },
        "Amount": {
          type: 'number',
          number: amount
        },
        "FromAccount": {
          type: 'relation',
          relation: fromAccountId ? [
            { id: fromAccountId }
          ] : []
        },
        "ToAccount": {
          type: 'relation',
          relation: toAccountId ? [
            { id: toAccountId }
          ] : []
        },
        "Category": {
          type: 'relation',
          relation: [
            { id: categoryId }
          ]
        },
        "Linked card": {
          type: 'relation',
          relation: linkedCardId ? [{ id: linkedCardId }] : []
        },
        "Note": {
          type: 'rich_text',
          rich_text: [
            {
              type: "text",
              text: {
                content: note
              }
            }
          ]
        }
      }
    });

    if (!("properties" in response))
      throw new DatabaseError(`Transaction ${response.id} not added`);
    return this.mapPageToTransaction(response);
  }

  async addExpense(accountId: string, amount: number, categoryId: string, note: string, timestamp?: number, linkedCardId?: string): Promise<Transaction> {
    return await this.addTransaction(accountId, null, amount, categoryId, note, timestamp, linkedCardId);
  }

  async addIncome(accountId: string, amount: number, categoryId: string, note: string, timestamp?: number, linkedCardId?: string): Promise<Transaction> {
    return await this.addTransaction(null, accountId, amount, categoryId, note, timestamp, linkedCardId);
  }

  async addTransfer(fromAccountId: string, toAccountId: string, amount: number, note: string, timestamp?: number): Promise<Transaction> {
    return await this.addTransaction(fromAccountId, toAccountId, amount, process.env.NOTION_TRANSFER_TRANSACTION_ID as string, note, timestamp);
  }

  async fetchTransaction(id: string): Promise<Transaction> {
    const response = await this.notion.pages.retrieve({ page_id: id });
    if (!("properties" in response))
      throw new DatabaseError(`Transaction ${id} not found`);
    return this.mapPageToTransaction(response);
  }

  async updateTransactionPage(id: string, fields: {
    amount?: number;
    note?: string;
    categoryId?: string;
    timestamp?: number;
    linkedCardId?: string | null;
  }): Promise<Transaction> {
    const properties: UpdatePageParameters['properties'] = {};

    if (fields.amount !== undefined)
      properties['Amount'] = { type: 'number', number: fields.amount };
    if (fields.note !== undefined)
      properties['Note'] = { type: 'rich_text', rich_text: [{ type: 'text', text: { content: fields.note } }] };
    if (fields.categoryId !== undefined)
      properties['Category'] = { type: 'relation', relation: [{ id: fields.categoryId }] };
    if (fields.timestamp !== undefined)
      properties['Timestamp'] = { type: 'date', date: { start: toISOStringWithTimezone(fields.timestamp, 'Asia/Bangkok') } };
    if (fields.linkedCardId !== undefined)
      properties['Linked card'] = { type: 'relation', relation: fields.linkedCardId ? [{ id: fields.linkedCardId }] : [] };

    const response = await this.notion.pages.update({ page_id: id, properties });
    if (!("properties" in response))
      throw new DatabaseError(`Transaction ${id} not updated`);
    return this.mapPageToTransaction(response as PageObjectResponse);
  }

  async archiveTransaction(id: string): Promise<void> {
    await this.notion.pages.update({ page_id: id, in_trash: true });
  }

  async fetchOldTransactions(before: string): Promise<Transaction[]> {
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_TRANSACTION_DATABASE_ID as string,
      filter: {
        property: "Timestamp",
        date: { before }
      },
      sorts: [{ property: "Timestamp", direction: "ascending" }]
    });
    return pages.map(page => this.mapPageToTransaction(page));
  }

  async fetchArchive(month: number, year: number): Promise<Archive | null> {
    const response = await this.notion.dataSources.query({
      data_source_id: process.env.NOTION_ARCHIVE_DATABASE_ID as string,
      filter: {
        and: [
          { property: "Month", number: { equals: month } },
          { property: "Year",  number: { equals: year  } }
        ]
      },
      page_size: 1
    });
    const pages = response.results.filter(
      (r): r is PageObjectResponse => r.object === 'page' && 'properties' in r
    );
    if (pages.length === 0) return null;
    return this.mapPageToArchive(pages[0]!);
  }

  async createArchivePage(month: number, year: number): Promise<Archive> {
    const name = `${String(month).padStart(2, '0')}-${year}`;
    const response = await this.notion.pages.create({
      parent: {
        data_source_id: process.env.NOTION_ARCHIVE_DATABASE_ID as string
      },
      properties: {
        "Name":  { type: "title",  title:  [{ type: "text", text: { content: name } }] },
        "Month": { type: "number", number: month },
        "Year":  { type: "number", number: year  },
        "Count": { type: "number", number: 0 },
        "Debit": { type: "number", number: 0 },
        "Credit":{ type: "number", number: 0 }
      }
    });
    if (!("properties" in response))
      throw new DatabaseError(`Archive ${name} not created`);
    return this.mapPageToArchive(response);
  }

  async createArchiveTransactionDb(archivePageId: string): Promise<string> {
    const dbRaw = await this.notion.databases.create({
      parent: { type: "page_id", page_id: archivePageId },
      title: [{ type: "text", text: { content: "Transactions" } }],
      is_inline: true
    });
    const db = dbRaw as DatabaseObjectResponse;
    const dataSourceId = db.data_sources[0]?.id;
    if (!dataSourceId)
      throw new DatabaseError(`No data source found for archive transaction DB on page ${archivePageId}`);
    await this.notion.dataSources.update({
      data_source_id: dataSourceId,
      properties: {
        "Timestamp":   { date: {} },
        "Amount":      { number: {} },
        "FromAccount": { relation: { data_source_id: process.env.NOTION_ACCOUNT_DATABASE_ID  as string, type: "single_property", single_property: {} } },
        "ToAccount":   { relation: { data_source_id: process.env.NOTION_ACCOUNT_DATABASE_ID  as string, type: "single_property", single_property: {} } },
        "Category":    { relation: { data_source_id: process.env.NOTION_CATEGORY_DATABASE_ID as string, type: "single_property", single_property: {} } },
        "Note":        { rich_text: {} }
      }
    });
    return dataSourceId;
  }

  async setArchiveTransactionsDb(archiveId: string, transactionsDbId: string): Promise<void> {
    await this.notion.pages.update({
      page_id: archiveId,
      properties: {
        "Transactions DB": {
          type: "rich_text",
          rich_text: [{ type: "text", text: { content: transactionsDbId } }]
        }
      }
    });
  }

  async addTransactionToArchiveDb(dbId: string, tx: Transaction): Promise<void> {
    await this.notion.pages.create({
      parent: { data_source_id: dbId },
      properties: {
        "Name":        { type: "title",     title:     [{ type: "text", text: { content: tx.id } }] },
        "Timestamp":   { type: "date",      date:      { start: toISOStringWithTimezone(tx.timestamp, 'Asia/Bangkok') } },
        "Amount":      { type: "number",    number:    tx.amount },
        "FromAccount": { type: "relation", relation: tx.fromAccountId ? [{ id: tx.fromAccountId }] : [] },
        "ToAccount":   { type: "relation", relation: tx.toAccountId  ? [{ id: tx.toAccountId  }] : [] },
        "Category":    { type: "relation", relation: [{ id: tx.categoryId }] },
        "Note":        { type: "rich_text", rich_text: [{ type: "text", text: { content: tx.note              } }] }
      }
    });
  }

  async updateArchiveStats(archiveId: string, countDelta: number, debitDelta: number, creditDelta: number, current: Archive): Promise<void> {
    await this.notion.pages.update({
      page_id: archiveId,
      properties: {
        "Count": { type: "number", number: current.count + countDelta },
        "Debit": { type: "number", number: current.debit + debitDelta },
        "Credit":{ type: "number", number: current.credit + creditDelta }
      }
    });
  }

  async fetchLatestSnapshotForAccount(accountId: string): Promise<Snapshot | null> {
    const response = await this.notion.dataSources.query({
      data_source_id: process.env.NOTION_SNAPSHOT_DATABASE_ID as string,
      filter: {
        property: "Account",
        relation: { contains: accountId }
      },
      sorts: [{ property: "Date", direction: "descending" }],
      page_size: 1
    });
    const pages = response.results.filter(
      (r): r is PageObjectResponse => r.object === 'page' && 'properties' in r
    );
    if (pages.length === 0) return null;
    return this.mapPageToSnapshot(pages[0]!);
  }

  async fetchTransactionsForAccount(accountId: string, startDate: string): Promise<Transaction[]> {
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_TRANSACTION_DATABASE_ID as string,
      filter: {
        and: [
          {
            or: [
              { property: "FromAccount", relation: { contains: accountId } },
              { property: "ToAccount", relation: { contains: accountId } }
            ]
          },
          { property: "Timestamp", date: { on_or_after: startDate } }
        ]
      },
      sorts: [{ property: "Timestamp", direction: "ascending" }]
    });
    return pages.map(page => this.mapPageToTransaction(page));
  }

  async createSnapshot(accountId: string, accountName: string, balance: number, snapshotDateMs: number): Promise<Snapshot> {
    const dateISO = toISOStringWithTimezone(snapshotDateMs, 'Asia/Bangkok');
    const parts = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const year = parts?.[1] ?? '';
    const month = parts?.[2] ?? '';
    const day = parts?.[3] ?? '';
    const name = `${accountName}-${day}-${month}-${year}`;

    const response = await this.notion.pages.create({
      parent: {
        data_source_id: process.env.NOTION_SNAPSHOT_DATABASE_ID as string
      },
      properties: {
        "Name": {
          type: "title",
          title: [{ type: "text", text: { content: name } }]
        },
        "Account": {
          type: "relation",
          relation: [{ id: accountId }]
        },
        "Date": {
          type: "date",
          date: { start: dateISO }
        },
        "Balance": {
          type: "number",
          number: balance
        }
      }
    });

    if (!("properties" in response))
      throw new DatabaseError(`Snapshot for ${accountId} not created`);
    return this.mapPageToSnapshot(response);
  }

  private async queryAllPages(
    params: Parameters<typeof this.notion.dataSources.query>[0]
  ): Promise<PageObjectResponse[]> {
    const allPages: PageObjectResponse[] = []
    let cursor: string | undefined = undefined
    do {
      const response = await this.notion.dataSources.query({
        ...params,
        start_cursor: cursor,
        page_size: 100
      })
      const pages = response.results.filter(
        (r): r is PageObjectResponse => r.object === 'page' && 'properties' in r
      )
      allPages.push(...pages)
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
    } while (cursor !== undefined)
    return allPages
  }

  private mapPageToAccount(page: PageObjectResponse): Account {
    const name = this.getTitleProperty(page, "Name");
    const type = this.getSelectProperty(page, "Type", true);
    const balance = this.getNumberProperty(page, "Balance", true);
    const totalTransactions = this.getNumberProperty(page, "Total Transactions", false);
    const lastTransactionDate = this.getDateProperty(page, "Last Transaction Date", false);
    const priorityScore = computePriorityScore(totalTransactions, lastTransactionDate);
    const linkedCardIds = this.getRelationsProperty(page, "Linked cards");

    return {
      id: page.id, name, type: type as AccountType, balance,
      totalTransactions, lastTransactionDate, priorityScore,
      linkedCardIds
    } satisfies Account;
  }

  private mapPageToCategory(page: PageObjectResponse): Category {
    const name = this.getTitleProperty(page, "Name");
    const type = this.getSelectProperty(page, "Type", true);
    const parentId = this.getParentProperty(page);
    const note = this.getTextProperty(page, "Note", false) ?? "";

    return {
      id: page.id, name, type: type as CategoryType, parentId, note
    } satisfies Category;
  }

  private mapPageToTransaction(page: PageObjectResponse): Transaction {
    const timestamp = this.getDateProperty(page, "Timestamp", true);
    const amount = this.getNumberProperty(page, "Amount", true);
    const fromAccountId = this.getRelationProperty(page, "FromAccount", false);
    const toAccountId = this.getRelationProperty(page, "ToAccount", false);
    const categoryId = this.getRelationProperty(page, "Category", true);
    const note = this.getTextProperty(page, "Note", false);
    const linkedCardId = this.getRelationProperty(page, "Linked card", false);

    return {
      id: page.id,
      timestamp,
      amount,
      fromAccountId: fromAccountId ?? undefined,
      toAccountId: toAccountId ?? undefined,
      categoryId,
      note: note ?? "",
      linkedCardId: linkedCardId ?? undefined
    } satisfies Transaction;
  }

  private mapPageToCard(page: PageObjectResponse): Card {
    const name = this.getTitleProperty(page, "Name");
    const number = this.getTextProperty(page, "Number", false) ?? "";
    const imageUrl = this.getFileProperty(page, "Image", false) ?? "";
    const annualFee = this.getNumberProperty(page, "Annual Fee", false);
    const spendingLimit = this.getNumberProperty(page, "Spending Limit", false);
    const requiredSpending = this.getNumberProperty(page, "Required Spending", false);
    const lastChargedDate = this.getDateProperty(page, "Last Charged Date", false);
    const billingDay = this.getNumberProperty(page, "Billing Day", false);
    const linkedAccountId = this.getRelationProperty(page, "Linked Account", false);
    const linkedServices = this.getMultiSelectProperty(page, "Linked Services");
    const cashbackCap = this.getNumberProperty(page, "Cashback Cap", false);
    const network = this.getSelectProperty(page, "Network", false);

    return {
      id: page.id, name, number, imageUrl,
      annualFee, spendingLimit, requiredSpending,
      lastChargedDate, billingDay, linkedAccountId,
      linkedServices, cashbackCap, network
    } satisfies Card;
  }

  private mapPageToPromotion(page: PageObjectResponse): Promotion {
    const name = this.getTitleProperty(page, "Name");
    const cardIdProp = page.properties["Card"];
    const cardId = cardIdProp?.type === 'relation' ? (cardIdProp.relation[0]?.id ?? null) : null;
    const categoryProp = page.properties["Category"];
    const category = (categoryProp?.type === 'select' ? categoryProp.select?.name : null) as PromotionCategory ?? null;
    const typeProp = page.properties["Type"];
    const type = (typeProp?.type === 'select' ? typeProp.select?.name : null) as PromotionType ?? 'Discount';
    const expiresAt = this.getDateProperty(page, "Expiry Date", false);
    const linkProp = page.properties["Link"];
    const link = linkProp?.type === 'url' ? linkProp.url : null;

    return { id: page.id, name, cardId, category, type, expiresAt, link } satisfies Promotion;
  }

  private mapPageToStatement(page: PageObjectResponse): Statement {
    const cardId = this.getRelationProperty(page, "Card", true);
    const billingDate = this.getDateProperty(page, "Billing Date", true);
    const spending = this.getNumberProperty(page, "Spending", false) || 0;
    const cashback = this.getNumberProperty(page, "Cashback", false) || 0;
    const note = this.getTextProperty(page, "Note", false) ?? "";

    return { id: page.id, cardId, billingDate, spending, cashback, note } satisfies Statement;
  }

  private getProperty(page: PageObjectResponse, key: string) {
    const prop = page.properties[key];
    if (!prop)
      throw new SchemaError(`Property ${key} not found`);
    return prop;
  }

  private getParentProperty(page: PageObjectResponse): string | null {
    const prop = this.getProperty(page, "Parent item");
    if (prop.type !== "relation")
      throw new SchemaError(`Parent property is not a relation`);

    return prop.relation[0]?.id ?? null;
  }

  private getTitleProperty(page: PageObjectResponse, key: string): string {
    const prop = this.getProperty(page, key);
    if (prop.type !== "title")
      throw new SchemaError(`Property ${key} is not a title`);

    return prop.title[0].plain_text;
  }

  private getNumberProperty(page: PageObjectResponse, key: string, required: true): number;
  private getNumberProperty(page: PageObjectResponse, key: string, required: false): number | null;
  private getNumberProperty(page: PageObjectResponse, key: string, required: boolean) {
    const prop = this.getProperty(page, key);
    if (prop.type !== "number")
      throw new SchemaError(`Property ${key} is not a number`);
    if (required) {
      if (prop.number === null)
        throw new SchemaError(`Property ${key} does not have a value`);
    }
    return prop.number;
  }

  private getSelectProperty(page: PageObjectResponse, key: string, required: true): string;
  private getSelectProperty(page: PageObjectResponse, key: string, required: false): string | null;
  private getSelectProperty(page: PageObjectResponse, key: string, required: boolean) {
    const prop = this.getProperty(page, key);
    if (prop.type !== "select")
      throw new SchemaError(`Property ${key} is not a select`);
    if (required) {
      if (!prop.select)
        throw new SchemaError(`Property ${key} does not have a value`);
    }

    return prop.select?.name ?? null;
  }

  private getTextProperty(page: PageObjectResponse, key: string, required: true): string;
  private getTextProperty(page: PageObjectResponse, key: string, required: false): string | null;
  private getTextProperty(page: PageObjectResponse, key: string, required: boolean) {
    const prop = this.getProperty(page, key);
    if (prop.type !== 'rich_text')
      throw new SchemaError(`Property ${key} is not a text`);
    if (required) {
      if (!prop.rich_text)
        throw new SchemaError(`Property ${key} does not have a value`);
    }

    return prop.rich_text[0]?.plain_text ?? null;
  }

  private getRelationProperty(page: PageObjectResponse, key: string, required: true): string;
  private getRelationProperty(page: PageObjectResponse, key: string, required: false): string | null;
  private getRelationProperty(page: PageObjectResponse, key: string, required: boolean) {
    const prop = this.getProperty(page, key);
    if (prop.type !== 'relation')
      throw new SchemaError(`Property ${key} is not a relation`);
    if (required) {
      if (!prop.relation || prop.relation.length === 0)
        throw new SchemaError(`Property ${key} does not have a value`);
    }

    return prop.relation[0]?.id ?? null;
  }

  private getRelationsProperty(page: PageObjectResponse, key: string): string[] {
    const prop = this.getProperty(page, key);
    if (prop.type !== 'relation')
      throw new SchemaError(`Property ${key} is not a relation`);
    
    return prop.relation ? prop.relation.map(r => r.id) : [];
  }

  private getFileProperty(page: PageObjectResponse, key: string, required: true): string;
  private getFileProperty(page: PageObjectResponse, key: string, required: false): string | null;
  private getFileProperty(page: PageObjectResponse, key: string, required: boolean) {
    const prop = this.getProperty(page, key);
    if (prop.type !== 'files')
      throw new SchemaError(`Property ${key} is not a file`);
    if (required) {
      if (!prop.files || prop.files.length === 0)
        throw new SchemaError(`Property ${key} does not have a value`);
    }

    if (prop.files[0]) {
      const file = prop.files[0];
      if (file.type === 'external')
        return file.external.url;
      else return file.file.url;
    }
    return null;
  }

  private getDateProperty(page: PageObjectResponse, key: string, required: true): number;
  private getDateProperty(page: PageObjectResponse, key: string, required: false): number | null;
  private getDateProperty(page: PageObjectResponse, key: string, required: boolean) {
    const prop = this.getProperty(page, key);
    if (prop.type !== 'date')
      throw new SchemaError(`Property ${key} is not a date`);
    if (required) {
      if (!prop.date?.start)
        throw new SchemaError(`Property ${key} does not have a value`);
    }

    return prop.date?.start ? new Date(prop.date.start).getTime() : null;
  }

  private getMultiSelectProperty(page: PageObjectResponse, key: string): string[] {
    const prop = this.getProperty(page, key);
    if (prop.type !== 'multi_select')
      throw new SchemaError(`Property ${key} is not a multi-select`);
    return prop.multi_select.map(s => s.name);
  }

  private mapPageToArchive(page: PageObjectResponse): Archive {
    const name   = this.getTitleProperty(page, "Name");
    const month  = this.getNumberProperty(page, "Month", true);
    const year   = this.getNumberProperty(page, "Year",  true);
    const count  = this.getNumberProperty(page, "Count", false) ?? 0;
    const debit  = this.getNumberProperty(page, "Debit", false) ?? 0;
    const credit = this.getNumberProperty(page, "Credit",false) ?? 0;
    const transactionsDbId = this.getTextProperty(page, "Transactions DB", false);
    return { id: page.id, name, month, year, count, debit, credit, transactionsDbId } satisfies Archive;
  }

  private mapPageToSnapshot(page: PageObjectResponse): Snapshot {
    const name      = this.getTitleProperty(page, "Name");
    const accountId = this.getRelationProperty(page, "Account", true);
    const date      = this.getDateProperty(page, "Date", true);
    const balance   = this.getNumberProperty(page, "Balance", true);
    return { id: page.id, name, accountId, date, balance } satisfies Snapshot;
  }
}
