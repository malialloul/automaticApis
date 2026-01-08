const { Pool } = require('pg');

/**
 * ConnectionManager - Manages PostgreSQL connection pools for multiple databases
 * Provides dynamic connection creation and management
 */
class ConnectionManager {
  constructor() {
    this.connections = new Map();
  }

  /**
   * Create or retrieve a connection pool
   * @param {string} connectionId - Unique identifier for the connection
   * @param {object} config - PostgreSQL connection configuration
   * @returns {Pool} PostgreSQL connection pool
   */
  async getConnection(connectionId, config) {
    if (this.connections.has(connectionId)) {
      return this.connections.get(connectionId);
    }

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

    // Test connection
    try {
      const client = await pool.connect();
      client.release();
      this.connections.set(connectionId, pool);
      return pool;
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  /**
   * Test a database connection
   * @param {object} config - PostgreSQL connection configuration
   * @returns {Promise<boolean>} Connection test result
   */
  async testConnection(config) {
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
  }

  /**
   * Close a specific connection
   * @param {string} connectionId - Connection identifier
   */
  async closeConnection(connectionId) {
    const pool = this.connections.get(connectionId);
    if (pool) {
      await pool.end();
      this.connections.delete(connectionId);
    }
  }

  /**
   * Close all connections
   */
  async closeAll() {
    for (const [connectionId, pool] of this.connections.entries()) {
      await pool.end();
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
}

module.exports = new ConnectionManager();
