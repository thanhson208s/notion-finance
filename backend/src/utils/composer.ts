import { LambdaFunctionURLResult } from "aws-lambda"
import { ResponseError, ResponseSuccess } from "../types/response"

export const ok = <T>(data: T) => ({
  statusCode: 200,
  body: {
    success: true,
    data
  } satisfies ResponseSuccess<T>
})

export const err = <T>(statusCode: number, code: string, message: string) => ({
  statusCode,
  body: {
    success: false,
    error: { code, message }
  } satisfies ResponseError
})