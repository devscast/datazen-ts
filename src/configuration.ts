import type { DriverMiddleware } from "./driver";

interface ConfigurationOptions {
  autoCommit?: boolean;
  middlewares?: DriverMiddleware[];
}

export class Configuration {
  private autoCommit: boolean;
  private middlewares: DriverMiddleware[];

  constructor(options?: ConfigurationOptions) {
    this.autoCommit = options?.autoCommit ?? true;
    this.middlewares = options?.middlewares ?? [];
  }

  public getAutoCommit(): boolean {
    return this.autoCommit;
  }

  public setAutoCommit(autoCommit: boolean): this {
    this.autoCommit = autoCommit;
    return this;
  }

  public getMiddlewares(): readonly DriverMiddleware[] {
    return this.middlewares;
  }

  public setMiddlewares(middlewares: DriverMiddleware[]): this {
    this.middlewares = [...middlewares];
    return this;
  }

  public addMiddleware(middleware: DriverMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }
}
