
import { getQueryString, ok } from '../utils/helper'
import { RouteHandler } from '../utils/router'
import { GetCategoriesResponse } from '../types/response'

export const getCategories: RouteHandler<undefined, GetCategoriesResponse> = async(event, connector) => {
  const filteredType = getQueryString(event.query, "type", false);
  const categories = await connector.fetchCategories(filteredType);
  
  return ok({
    categories
  } satisfies GetCategoriesResponse);
}