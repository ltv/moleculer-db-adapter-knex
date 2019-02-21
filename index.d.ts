import { ServiceBroker, Service, ServiceSchema } from 'moleculer';

declare module 'moleculer-db-adapter-knex' {
  export class KnexDbAdapter {
    constructor(options: any, options2: any);
    public init(broker: ServiceBroker, service: Service | ServiceSchema): void;
    public connect(): Promise<any>;
    public disconnect(): Promise<any>;
    public instance(): Knex;
    public count(filters?: any): number;
    public find<T = any>(filters?: any): Array<T>;
    public findOne<T = any>(query: any): T;
    public findById<T = any>(id: string | number): T;
    public findByIds<T = any>(idList: any[]): Array<T>;
    public insert<T = any>(entity: any): T;
    public insertMany<T = any>(
      entities: any[],
      useTransaction?: boolean
    ): Array<T>;
    public updateById<T = any>(id: string | number, data: any): T;
    public updateMany<T = any>(query: any, entities: any[]): Array<T>;
    public removeById(id: string | number): number;
    public clear(): void;
    public createCursor(params: any, isCounting: boolean): any;
  }
}
