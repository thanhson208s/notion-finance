import { Client, PageObjectResponse } from "@notionhq/client";
import { Account, AccountType } from "../types/account.type";
import { Category, CategoryType } from "../types/category.type";
import { Transaction } from "../types/transaction.type";
import { DatabaseError, SchemaError } from "../types/error";
import moment from 'moment-timezone';

export class Connector {
  notion = new Client({ auth: process.env.NOTION_API_KEY })

  async fetchAllAccounts(): Promise<Account[]> {
    const pages = await this.queryAllPages({
      data_source_id: process.env.NOTION_ACCOUNT_DATABASE_ID as string
    });
    return pages.map(page => this.mapPageToAccount(page));
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
            start: timestamp
              ? moment(timestamp).tz('Asia/Bangkok').format()
              : moment().tz('Asia/Bangkok').format()
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

  async addTransfer(fromAccountId: string, toAccountId: string, amount: number, timestamp?: number): Promise<Transaction> {
    return await this.addTransaction(fromAccountId, toAccountId, amount, process.env.NOTION_TRANSFER_TRANSACTION_ID as string, "", timestamp);
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
    let name = this.getTitleProperty(page, "Name");
    let type = this.getSelectProperty(page, "Type", true);
    let balance = this.getNumberProperty(page, "Balance", true);

    return {
      id: page.id, name, type: type as AccountType, balance
    } satisfies Account;
  }

  private mapPageToCategory(page: PageObjectResponse): Category {
    let name = this.getTitleProperty(page, "Name");
    let type = this.getSelectProperty(page, "Type", true);
    let parentId = this.getParentProperty(page);

    return {
      id: page.id, name, type: type as CategoryType, parentId
    } satisfies Category;
  }

  private mapPageToTransaction(page: PageObjectResponse): Transaction {
    let timestamp = this.getDateProperty(page, "Timestamp", true);
    let amount = this.getNumberProperty(page, "Amount", true);
    let fromAccountId = this.getRelationProperty(page, "FromAccount", false);
    let toAccountId = this.getRelationProperty(page, "ToAccount", false);
    let categoryId = this.getRelationProperty(page, "Category", true);
    let note = this.getTextProperty(page, "Note", false);
    let linkedCardId = this.getRelationProperty(page, "Linked card", false);

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

  private getNumberProperty<T extends boolean>(page: PageObjectResponse, key: string, required: T): T extends true ? number : (number | null) {
    const prop = this.getProperty(page, key);
    if (prop.type !== "number")
      throw new SchemaError(`Property ${key} is not a number`);
    if (required) {
      if (prop.number === null)
        throw new SchemaError(`Property ${key} does not have a value`);
    }
    return prop.number as any;
  }

  private getSelectProperty<T extends boolean>(page: PageObjectResponse, key: string, required: T): T extends true ? string : (string | null) {
    const prop = this.getProperty(page, key);
    if (prop.type !== "select")
      throw new SchemaError(`Property ${key} is not a select`);
    if (required) {
      if (!prop.select)
        throw new SchemaError(`Property ${key} does not have a value`);
    }

    return (prop.select?.name ?? null) as any;
  }

  private getTextProperty<T extends boolean>(page: PageObjectResponse, key: string, required: T): T extends true ? string : (string | null) {
    const prop = this.getProperty(page, key);
    if (prop.type !== 'rich_text')
      throw new SchemaError(`Property ${key} is not a text`);
    if (required) {
      if (!prop.rich_text)
        throw new SchemaError(`Property ${key} does not have a value`);
    }

    return prop.rich_text[0]?.plain_text ?? null as any;
  }

  private getRelationProperty<T extends boolean>(page: PageObjectResponse, key: string, required: T): T extends true ? string : (string | null) {
    const prop = this.getProperty(page, key);
    if (prop.type !== 'relation')
      throw new SchemaError(`Property ${key} is not a relation`);
    if (required) {
      if (!prop.relation)
        throw new SchemaError(`Property ${key} does not have a value`);
    }

    return prop.relation[0]?.id ?? null as any;
  }

  private getDateProperty<T extends boolean>(page: PageObjectResponse, key: string, required: T): T extends true ? number : (number | null) {
    const prop = this.getProperty(page, key);
    if (prop.type !== 'date')
      throw new SchemaError(`Property ${key} is not a date`);
    if (required) {
      if (!prop.date?.start)
        throw new SchemaError(`Property ${key} does not have a value`);
    }

    return prop.date?.start ? new Date(prop.date.start).getTime() : null as any;
  }
}