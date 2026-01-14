const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const mssql = require('mssql');
const oracledb = require('oracledb');

/**
 * ConnectionManager - Manages PostgreSQL connection pools for multiple databases
 * Provides dynamic connection creation and management
 */
class ConnectionManager {
  constructor() {
    this.connections = new Map(); // id -> { type, pool, database }
  }

  /**
   * Create or retrieve a connection pool
   * @param {string} connectionId - Unique identifier for the connection
   * @param {object} config - PostgreSQL connection configuration
   * @returns {Pool} PostgreSQL connection pool
   */
  async getConnection(connectionId, config) {
    if (this.connections.has(connectionId)) {
      return this.connections.get(connectionId).pool;
    }

    const type = (config.type || 'postgres').toLowerCase();
    if (type === 'postgres') {
      const pool = new Pool({
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
        const [rows] = await pool.query('SELECT 1');
        this.connections.set(connectionId, { type, pool, database: config.database });
        return pool;
      } catch (error) {
        await pool.end();
        throw error;
      }
    } else if (type === 'mongodb') {
      const uri = config.uri || `mongodb://${config.host}:${config.port || 27017}`;
      const client = new MongoClient(uri);
      try {
        await client.connect();
        // If a database is not provided, default to 'admin'
        const db = client.db(config.database || 'admin');
        this.connections.set(connectionId, { type, client, db, database: config.database || 'admin' });
        return { client, db };
      } catch (error) {
        await client.close();
        throw error;
      }
    } else if (type === 'mssql') {
      const pool = await new mssql.ConnectionPool({
        user: config.user,
        password: config.password,
        server: config.host,
        port: config.port || 1433,
        database: config.database,
        options: { encrypt: config.encrypt || false, trustServerCertificate: true },
      }).connect();
      try {
        // simple test query
        const result = await pool.request().query('SELECT 1 AS now');
        this.connections.set(connectionId, { type, pool, database: config.database });
        return pool;
      } catch (error) {
        await pool.close();
        throw error;
      }
    } else if (type === 'oracle') {
      // requires Oracle Instant Client to be available in the environment for oracledb
      const pool = await oracledb.createPool({
        user: config.user,
        password: config.password,
        connectString: `${config.host}:${config.port || 1521}/${config.database}`,
        poolMin: 0,
        poolMax: 10,
        poolIncrement: 1,
      });
      try {
        const connection = await pool.getConnection();
        await connection.close();
        this.connections.set(connectionId, { type, pool, database: config.database });
        return pool;
      } catch (error) {
        await pool.close();
        throw error;
      }
    } else {
      throw new Error(`Unsupported database type: ${type}`);
    }
  }

  /**
   * Test a database connection
   * @param {object} config - PostgreSQL connection configuration
   * @returns {Promise<boolean>} Connection test result
   */
  async testConnection(config) {
    const type = (config.type || 'postgres').toLowerCase();
    if (type === 'postgres') {
      const pool = new Pool({
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
        const result = await client.query('SELECT NOW()');
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
        const [rows] = await pool.query('SELECT NOW() AS now');
        await pool.end();
        return { success: true, timestamp: rows[0].now };
      } catch (error) {
        await pool.end();
        throw error;
      }
    } else if (type === 'mongodb') {
      const uri = config.uri || `mongodb://${config.host}:${config.port || 27017}`;
      const client = new MongoClient(uri);
      try {
        await client.connect();
        const admin = client.db(config.database || 'admin').admin();
        const ping = await admin.ping();
        await client.close();
        return { success: true, info: ping };
      } catch (error) {
        await client.close();
        throw error;
      }
    } else if (type === 'mssql') {
      const pool = await new mssql.ConnectionPool({
        user: config.user,
        password: config.password,
        server: config.host,
        port: config.port || 1433,
        database: config.database,
        options: { encrypt: config.encrypt || false, trustServerCertificate: true },
      }).connect();
      try {
        const result = await pool.request().query('SELECT 1 AS now');
        await pool.close();
        return { success: true, timestamp: result.recordset[0].now };
      } catch (error) {
        await pool.close();
        throw error;
      }
    } else if (type === 'oracle') {
      const pool = await oracledb.createPool({
        user: config.user,
        password: config.password,
        connectString: `${config.host}:${config.port || 1521}/${config.database}`,
        poolMin: 0,
        poolMax: 1,
        poolIncrement: 1,
      });
      try {
        const connection = await pool.getConnection();
        const result = await connection.execute('SELECT 1 FROM DUAL');
        await connection.close();
        await pool.close();
        return { success: true, timestamp: result.rows[0][0] };
      } catch (error) {
        await pool.close();
        throw error;
      }
    } else {
      throw new Error(`Unsupported database type: ${type}`);
    }
  }

  /**
   * Close a specific connection
   * @param {string} connectionId - Connection identifier
   */
  async closeConnection(connectionId) {
    const info = this.connections.get(connectionId);
    if (info) {
      try {
        if (info.type === 'postgres' || info.type === 'mysql') {
          await info.pool.end();
        } else if (info.type === 'mssql') {
          await info.pool.close();
        } else if (info.type === 'oracle') {
          await info.pool.close();
        } else if (info.type === 'mongodb') {
          await info.client.close();
        }
      } catch (err) {
        // ignore close errors
      }
      this.connections.delete(connectionId);
    }
  }

  /**
   * Close all connections
   */
  async closeAll() {
    for (const [connectionId, info] of this.connections.entries()) {
      try {
        if (info.type === 'postgres' || info.type === 'mysql') {
          await info.pool.end();
        } else if (info.type === 'mssql') {
          await info.pool.close();
        } else if (info.type === 'oracle') {
          await info.pool.close();
        } else if (info.type === 'mongodb') {
          await info.client.close();
        }
      } catch (err) {
        // ignore
      }
    }
    this.connections.clear();
  }

  /**
   * Get all connection IDs
   * @returns {Array<string>} List of connection IDs
   */
  getConnectionIds() {
    return Array.from(this.connections.keys());
  }

  getInfo(connectionId) {
    return this.connections.get(connectionId);
  }
}

module.exports = new ConnectionManager();
