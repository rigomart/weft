/**
 * The database seam (ADR 0005). `store` reaches SQLite only through it, and
 * each host provides an implementation on its own driver. It is asynchronous
 * so a host can run the database in another thread or process.
 */
export type SqlValue = string | number | null;

export type SqlRow = Readonly<Record<string, SqlValue>>;

export interface SqlResult {
  /** Each row by column name. */
  readonly rows: readonly SqlRow[];
  /** Rows inserted, updated or deleted by the statement. */
  readonly rowsAffected: number;
}

export interface SqlExecutor {
  /** Runs one SQL statement with `?` placeholders filled from `args`. */
  execute(sql: string, args?: readonly SqlValue[]): Promise<SqlResult>;
}

export interface Database extends SqlExecutor {
  /**
   * Runs `work` in one write transaction: it commits when `work` resolves and
   * rolls back when it throws, then throws the same error. `store` never
   * starts a second transaction before the first has finished.
   */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
