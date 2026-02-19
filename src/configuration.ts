import type { DriverMiddleware } from "./driver";

interface ConfigurationOptions {
  middlewares?: DriverMiddleware[];
}

export class Configuration {
  private middlewares: DriverMiddleware[];

  constructor(options?: ConfigurationOptions) {
    this.middlewares = options?.middlewares ?? [];
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
