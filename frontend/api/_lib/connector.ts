import { Client, PageObjectResponse, UpdatePageParameters } from "@notionhq/client";
import { Account, AccountType, CardSummary, computePriorityScore } from "./types/account.type";
import { Category, CategoryType } from "./types/category.type";
import { Transaction } from "./types/transaction.type";
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
    const accounts = pages.map(page => this.mapPageToAccount(page));
    const allCardIds = [...new Set(accounts.flatMap(a => a.linkedCardIds))];
    if (allCardIds.length === 0) return accounts;
    const allCards = await this.fetchAllCards();
    const cardMap = new Map(allCards.map(c => [c.id, c]));
    return accounts.map(a => ({
      ...a,
      cards: a.linkedCardIds.map(id => cardMap.get(id)).filter((c): c is CardSummary => c !== undefined)
    }));
  }

  async fetchAllCards(): Promise<CardSummary[]> {
    console.log(process.env.NOTION_CARD_DATABASE_ID);
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_CARD_DATABASE_ID as string
    });
    return pages.map(page => this.mapPageToCardSummary(page));
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
      linkedCardIds, cards: []
    } satisfies Account;
  }

  private mapPageToCardSummary(page: PageObjectResponse): CardSummary {
    const name = this.getTitleProperty(page, "Name");
    const imageUrl = this.getFileProperty(page, "Image", true);
    return { id: page.id, name, imageUrl } satisfies CardSummary;
  }

  private mapPageToCategory(page: PageObjectResponse): Category {
    const name = this.getTitleProperty(page, "Name");
    const type = this.getSelectProperty(page, "Type", true);
    const parentId = this.getParentProperty(page);

    return {
      id: page.id, name, type: type as CategoryType, parentId
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
}
