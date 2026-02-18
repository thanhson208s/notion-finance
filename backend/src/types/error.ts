export class CustomError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class SchemaError extends CustomError {
  constructor(message: string) {
    super("SCHEMA_ERROR", message);
  }
}

export class QueryError extends CustomError {
  constructor(message: string) {
    super("QUERY_ERROR", message);
  }
}