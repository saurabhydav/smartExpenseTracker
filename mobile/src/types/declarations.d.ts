declare module 'react-native-sqlite-storage' {
  export interface QueryResult {
    insertId: number;
    rowsAffected: number;
    rows: {
      length: number;
      item(index: number): any;
      raw(): any[];
    };
  }

  export interface Transaction {
    executeSql(
      sqlStatement: string,
      arguments?: any[],
      success?: (tx: Transaction, result: QueryResult) => void,
      error?: (tx: Transaction, err: any) => void
    ): void;
  }

  export interface SQLiteDatabase {
    transaction(
      callback: (tx: Transaction) => void,
      error?: (err: any) => void,
      success?: () => void
    ): Promise<void>;
    readTransaction(
      callback: (tx: Transaction) => void,
      error?: (err: any) => void,
      success?: () => void
    ): Promise<void>;
    executeSql(
      statement: string,
      params?: any[]
    ): Promise<[QueryResult]>;
    close(): Promise<void>;
  }

  export function openDatabase(
    params: {
      name: string;
      location?: string;
      createFromLocation?: any;
    },
    success?: () => void,
    error?: (err: any) => void
  ): Promise<SQLiteDatabase>;

  export function enablePromise(enable: boolean): void;

  const SQLite: {
    openDatabase: typeof openDatabase;
    enablePromise: typeof enablePromise;
  };

  export default SQLite;
}
