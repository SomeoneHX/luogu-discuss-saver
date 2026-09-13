/** 爬虫层错误类型（对标原项目 crawler/error.ts）。 */

export class HttpError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? `HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

/** 帖子被删除 / 无权访问（403 / 404 / valid=false）。 */
export class AccessError extends HttpError {
  constructor(url: string, status: number) {
    super(url, status, `Access denied (${status}) for ${url}`);
    this.name = "AccessError";
  }
}

/** 非预期的状态码。 */
export class UnexpectedStatusError extends HttpError {
  constructor(message: string, url: string, status: number) {
    super(url, status, `${message}: ${status}`);
    this.name = "UnexpectedStatusError";
  }
}

/** 响应无法解析为 lentille 数据。 */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}
