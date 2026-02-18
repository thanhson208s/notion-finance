import { LambdaFunctionURLEventWithIAMAuthorizer, LambdaFunctionURLHandlerWithIAMAuthorizer, LambdaFunctionURLResult } from "aws-lambda"
import { Router } from '../utils/router'
import { getAccounts } from "./account";
import { listExpenses, logExpense, transferBalance } from "./transaction";
import { Connector } from "../utils/connector";

const router = new Router(new Connector());
router.register('GET', '/accounts', getAccounts);
router.register('POST', '/expense', logExpense);
router.register('GET', '/expense', listExpenses);
router.register('POST', '/transfer', transferBalance);

export const handler: LambdaFunctionURLHandlerWithIAMAuthorizer = async(event: LambdaFunctionURLEventWithIAMAuthorizer): Promise<LambdaFunctionURLResult> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;
  const query = event.queryStringParameters ?? {};
  const body = event.body ? JSON.parse(event.body) : undefined;
  console.log("New client request:", JSON.stringify({ method, path, query, body }));

  try {
    return router.resolve(method, path, query, body);
  } catch (e) {
    let str;
    if (e instanceof Error)
      str = JSON.stringify({ name: e.name, message: e.message, stack: e.stack });
    else str = JSON.stringify({ type: typeof e, value: e });
    console.error(JSON.stringify({ method, path, error: str }));

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected error"
        }
      })
    };
  }
}
