const { Pool } = require('pg');
const mysql = require('mysql2/promise');

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
        await info.pool.end();

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
        await info.pool.end();

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

  /**
   * Get an existing connection pool without creating a new one
   * @param {string} connectionId - Connection identifier
   * @returns {Pool|null} Connection pool or null if not found
   */
  getExistingConnection(connectionId) {
    const info = this.connections.get(connectionId);
    if (!info) return null;
    return info.pool;
  }
}

module.exports = new ConnectionManager();
