import { LambdaFunctionURLEventWithIAMAuthorizer, LambdaFunctionURLHandlerWithIAMAuthorizer, LambdaFunctionURLResult } from "aws-lambda"

export const handler: LambdaFunctionURLHandlerWithIAMAuthorizer = async(event: LambdaFunctionURLEventWithIAMAuthorizer) => {
  console.log("New client request:", event);

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  } satisfies LambdaFunctionURLResult;
}
