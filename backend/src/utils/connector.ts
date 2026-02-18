import { APIResponseError, Client, PageObjectResponse } from "@notionhq/client";
import { Account } from "../types/account";
import { Category } from "../types/category";

export class Connector {
  notion = new Client({ auth: process.env.NOTION_API_KEY })

  async fetchAllAccounts(): Promise<Account[]> {
    const response = await this.notion.dataSources.query({
      data_source_id: process.env.NOTION_ACCOUNT_DATABASE_ID as string
    });

    return [];
  }

  async fetchAllCategories(): Promise<Category[]> {
    const response = await this.notion.dataSources.query({
      data_source_id: process.env.NOTION_CATEGORY_DATABASE_ID as string
    });

    return [];
  }

  // private mapPageToAccount(page: PageObjectResponse): Account {
    
  // }

  // private mapPageToCategory(page: PageObjectResponse): Category {

  // }
}