import { LambdaFunctionURLEventWithIAMAuthorizer, LambdaFunctionURLHandlerWithIAMAuthorizer, LambdaFunctionURLResult } from "aws-lambda"
import { Router } from '../utils/router'
import { getAccounts } from "./account.handler";
import { listIncomes, logIncome, listExpenses, logExpense, transferBalance } from "./transaction.handler";
import { Connector } from "../utils/connector";
import { APIErrorCode, APIResponseError } from "@notionhq/client";
import { QueryError, SchemaError } from "../types/error";

const router = new Router(new Connector());
router.register('GET', '/accounts', getAccounts);
router.register('POST', '/expense', logExpense);
router.register('GET', '/expense', listExpenses);
router.register('POST', '/income', logIncome);
router.register('GET', '/income', listIncomes);
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
    if (e instanceof APIResponseError) {
      let statusCode: number;
      switch(e.code) {
        case APIErrorCode.InternalServerError:
          statusCode = 500;
          break;
        case APIErrorCode.ServiceUnavailable:
          statusCode = 503;
          break;
        case APIErrorCode.ConflictError:
          statusCode = 409;
          break;
        case APIErrorCode.RateLimited:
          statusCode = 429;
          break;
        case APIErrorCode.InvalidRequestURL:
        case APIErrorCode.ValidationError:
        case APIErrorCode.InvalidRequest:
        case APIErrorCode.InvalidJSON:
          statusCode = 400;
          break;
        case APIErrorCode.RestrictedResource:
        case APIErrorCode.Unauthorized:
          statusCode = 403;
          break;
        case APIErrorCode.ObjectNotFound:
          statusCode = 404;
          break;
      }
      return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: {
            code: e.code,
            message: e.message
          }
        })
      };
    }
    else if (e instanceof SchemaError) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: {
            code: e.code,
            message: e.message
          }
        })
      }
    }
    else if (e instanceof QueryError) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: {
            code: e.code,
            message: e.message
          }
        })
      }
    }

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
