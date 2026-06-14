import { getQueryString, ok } from '../_lib/helper'
import { RouteHandler } from '../_lib/router'
import { GetCategoriesResponse } from '../_lib/types/response'

export const getCategories: RouteHandler<undefined, GetCategoriesResponse> = async(event, connector) => {
  const filteredType = getQueryString(event.query, "type", false);
  const categories = await connector.fetchCategories(filteredType);

  return ok({
    categories
  } satisfies GetCategoriesResponse);
}
