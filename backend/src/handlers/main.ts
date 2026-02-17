import { LambdaFunctionURLEventWithIAMAuthorizer, LambdaFunctionURLHandlerWithIAMAuthorizer, LambdaFunctionURLResult } from "aws-lambda"
import { Router } from '../utils/router'
import { getAccounts } from "../routes/account";
import { logExpense } from "../routes/transaction";

const router = new Router();
router.register('GET', '/accounts', getAccounts);
router.register('POST', '/expense', logExpense);

export const handler: LambdaFunctionURLHandlerWithIAMAuthorizer = async(event: LambdaFunctionURLEventWithIAMAuthorizer): Promise<LambdaFunctionURLResult> => {
  console.log("New client request:", event);

  try {
    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;
    const query = event.queryStringParameters ?? {};
    const body = event.body ? JSON.parse(event.body) : undefined;

    return router.resolve(method, path, { method, path, query, body });
  } catch (e) {
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
