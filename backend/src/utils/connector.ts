import { Client, PageObjectResponse } from "@notionhq/client";
import { Account, createAccount } from "../types/account.type";
import { Category, createCategory } from "../types/category.type";
import { SchemaError } from "../types/error";

export class Connector {
  notion = new Client({ auth: process.env.NOTION_API_KEY })

  async fetchAllAccounts(): Promise<Account[]> {
    const response = await this.notion.dataSources.query({
      data_source_id: process.env.NOTION_ACCOUNT_DATABASE_ID as string
    });
    return response.results
      .filter(result => (result.object === "page" && "properties" in result))
      .map(page => this.mapPageToAccount(page));
  }

  async fetchExpenseCategories(): Promise<Category[]> {
    const response = await this.notion.dataSources.query({
      data_source_id: process.env.NOTION_CATEGORY_DATABASE_ID as string,
      filter: {
        property: "Type",
        select: {
          equals: "Expense"
        }
      }
    });

    return response.results
      .filter(result => (result.object === "page" && "properties" in result))
      .map(page => this.mapPageToCategory(page));
  }

  async fetchIncomeCategories(): Promise<Category[]> {
    const response = await this.notion.dataSources.query({
      data_source_id: process.env.NOTION_CATEGORY_DATABASE_ID as string,
      filter: {
        property: "Type",
        select: {
          equals: "Income"
        }
      }
    });

    return response.results
      .filter(result => (result.object === "page" && "properties" in result))
      .map(page => this.mapPageToCategory(page));
  }

  private mapPageToAccount(page: PageObjectResponse): Account {
    let name = this.getTitleProperty(page, "Name");
    let type = this.getSelectProperty(page, "Type", true);
    let balance = this.getNumberProperty(page, "Balance", true);

    return createAccount(page.id, name, type, balance);
  }

  private mapPageToCategory(page: PageObjectResponse): Category {
    let name = this.getTitleProperty(page, "Name");
    let type = this.getSelectProperty(page, "Type", true);
    let parentId = this.getParentProperty(page);

    return createCategory(page.id, name, type, parentId);
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
}