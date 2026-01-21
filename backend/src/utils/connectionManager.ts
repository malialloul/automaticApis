import { Pool as PgPool, QueryResult } from 'pg';
import mysql, { Pool as MySqlPool, RowDataPacket } from 'mysql2/promise';
import { JSONValue } from '../types';

export type SupportedDBType = 'postgres' | 'mysql';

export interface ConnectionConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  type?: SupportedDBType | string;
  uri?: string;
  encrypt?: boolean;
}

export interface ConnectionInfo {
  type: SupportedDBType | string;
  pool: PgPool | MySqlPool;
  database: string;
}

/**
 * ConnectionManager - Manages connection pools for multiple databases
 */
class ConnectionManager {
  private connections: Map<string, ConnectionInfo> = new Map();
  public db: PgPool | null = null; // application DB pool for persisting connections/schemas

  constructor() {
    // Initialize application DB pool using APP_DB_* env vars when available
    const appHost = process.env.APP_DB_HOST || process.env.PGHOST || 'localhost';
    const appPort = process.env.APP_DB_PORT ? Number(process.env.APP_DB_PORT) : (process.env.PGPORT ? Number(process.env.PGPORT) : 5432);
    const appDatabase = process.env.APP_DB_NAME || process.env.PGDATABASE || 'postgres';
    const appUser = process.env.APP_DB_USER || process.env.PGUSER || 'postgres';
    const appPassword = process.env.APP_DB_PASSWORD || process.env.PGPASSWORD || 'postgres';

    try {
      this.db = new PgPool({ host: appHost, port: appPort, database: appDatabase, user: appUser, password: appPassword, max: 5 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('Failed to initialize application DB pool (connections/schemas persistence disabled):', msg);
      this.db = null;
    }

  }

  async getConnection(connectionId: string, config: ConnectionConfig): Promise<PgPool | MySqlPool> {
    if (this.connections.has(connectionId)) {
      return this.connections.get(connectionId)!.pool;
    }

    const type = (config.type || 'postgres').toLowerCase() as SupportedDBType;
    if (type === 'postgres') {
      const pool = new PgPool({
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        user: config.user,
        password: config.password,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      try {
        const client = await pool.connect();
        client.release();
        this.connections.set(connectionId, { type, pool, database: config.database });
        return pool;
      } catch (error) {
        await pool.end();
        throw error;
      }
    } else if (type === 'mysql') {
      const pool = await mysql.createPool({
        host: config.host,
        port: config.port || 3306,
        database: config.database,
        user: config.user,
        password: config.password,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
      try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT 1');
        this.connections.set(connectionId, { type, pool, database: config.database });
        return pool;
      } catch (error) {
        await pool.end();
        throw error;
      }
    } else {
      throw new Error(`Unsupported database type: ${type}`);
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; timestamp: string }> {
    const type = (config.type || 'postgres').toLowerCase() as SupportedDBType;
    if (type === 'postgres') {
      const pool = new PgPool({
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        user: config.user,
        password: config.password,
        max: 1,
        connectionTimeoutMillis: 5000,
      });
      try {
        const client = await pool.connect();
        const result = await client.query<{ now: string }>('SELECT NOW()');
        client.release();
        await pool.end();
        return { success: true, timestamp: result.rows[0].now };
      } catch (error) {
        await pool.end();
        throw error;
      }
    } else if (type === 'mysql') {
      const pool = await mysql.createPool({
        host: config.host,
        port: config.port || 3306,
        database: config.database,
        user: config.user,
        password: config.password,
        waitForConnections: true,
        connectionLimit: 1,
      });
      try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT NOW() AS now');
        await pool.end();
        return { success: true, timestamp: rows[0].now };
      } catch (error) {
        await pool.end();
        throw error;
      }
    } else {
      throw new Error(`Unsupported database type: ${type}`);
    }
  }

  async closeConnection(connectionId: string) {
    const info = this.connections.get(connectionId);
    if (info) {
      try {
        await info.pool.end();
      } catch (err) {
        // ignore close errors
      }
      this.connections.delete(connectionId);
    }
  }

  async closeAll() {
    for (const [connectionId, info] of this.connections.entries()) {
      try {
        await info.pool.end();
      } catch (err) {
        // ignore
      }
    }
    this.connections.clear();
  }

  getConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }

  getInfo(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  getExistingConnection(connectionId: string): PgPool | MySqlPool | null {
    const info = this.connections.get(connectionId);
    if (!info) return null;
    return info.pool;
  }

  async queryPool<T extends Record<string, JSONValue> = Record<string, JSONValue>>(pool: PgPool | MySqlPool | null, info?: ConnectionInfo, sql = '', params: Array<string | number | boolean | null> = []): Promise<import('../types').DBQueryResult<T>> {
    if (!pool) throw new Error('No pool provided');

    if (info?.type === 'mysql') {
      const [rows, fields] = await (pool as MySqlPool).query<RowDataPacket[] | import('mysql2').OkPacket>(sql, params);
      if (Array.isArray(rows)) {
        return { rows: rows as T[], rowCount: (rows as T[]).length, fields: (fields as import('mysql2').FieldPacket[] | undefined)?.map(f => ({ name: f.name })) };
      }
      // OkPacket case (INSERT/UPDATE/DELETE)
      const ok = rows as import('mysql2').OkPacket;
      return { rows: [], rowCount: ok.affectedRows ?? 0, insertId: ok.insertId ?? null, affectedRows: ok.affectedRows ?? null, okPacket: ok };
    }

    const result = await (pool as PgPool).query<T>(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? result.rows.length, fields: result.fields?.map(f => ({ name: f.name, dataTypeID: (f as { dataTypeID?: number }).dataTypeID })) };
  }
}

export default new ConnectionManager();
