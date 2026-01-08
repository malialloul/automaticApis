const express = require('express');
const QueryBuilder = require('./queryBuilder');

/**
 * APIGenerator - Dynamically generates CRUD routes for database tables
 * Creates Express router with all CRUD and relationship endpoints
 */
class APIGenerator {
  constructor(connectionId, pool, schema) {
    this.connectionId = connectionId;
    this.pool = pool;
    this.schema = schema;
    this.router = express.Router();
  }

  /**
   * Generate all routes for all tables
   * @returns {Router} Express router with all routes
   */
  generateRoutes() {
    for (const [tableName, tableSchema] of Object.entries(this.schema)) {
      this.generateTableRoutes(tableName, tableSchema);
    }
    return this.router;
  }

  /**
   * Generate CRUD routes for a specific table
   * @param {string} tableName - Table name
   * @param {object} tableSchema - Table schema
   */
  generateTableRoutes(tableName, tableSchema) {
    // Note: basePath doesn't include connectionId because the middleware in index.js line 26
    // (app.use('/api/:connectionId')) strips '/api/:connectionId' before passing to this router
    const basePath = `/${tableName}`;

    // GET /api/:connection/:table - List all with filters
    this.router.get(basePath, async (req, res) => {
      try {
        const { limit, offset, orderBy, orderDir, ...filters } = req.query;
        
        const queryBuilder = new QueryBuilder(tableName, tableSchema);
        const query = queryBuilder.buildSelect({
          filters,
          limit: limit || 100,
          offset: offset || 0,
          orderBy,
          orderDir,
        });

        const result = await this.pool.query(query.text, query.values);
        res.json(result.rows);
      } catch (error) {
        console.error(`Error listing ${tableName}:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    // POST /api/:connection/:table - Create new record
    this.router.post(basePath, async (req, res) => {
      try {
        const queryBuilder = new QueryBuilder(tableName, tableSchema);
        const query = queryBuilder.buildInsert(req.body);

        const result = await this.pool.query(query.text, query.values);
        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error(`Error creating ${tableName}:`, error);
        res.status(400).json({ error: error.message });
      }
    });

    // GET /api/:connection/:table/:id - Get by ID
    this.router.get(`${basePath}/:id`, async (req, res) => {
      try {
        const queryBuilder = new QueryBuilder(tableName, tableSchema);
        const query = queryBuilder.buildSelectById(req.params.id);

        const result = await this.pool.query(query.text, query.values);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }

        res.json(result.rows[0]);
      } catch (error) {
        console.error(`Error getting ${tableName}:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    // PUT /api/:connection/:table/:id - Update record
    this.router.put(`${basePath}/:id`, async (req, res) => {
      try {
        const queryBuilder = new QueryBuilder(tableName, tableSchema);
        const query = queryBuilder.buildUpdate(req.params.id, req.body);

        const result = await this.pool.query(query.text, query.values);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }

        res.json(result.rows[0]);
      } catch (error) {
        console.error(`Error updating ${tableName}:`, error);
        res.status(400).json({ error: error.message });
      }
    });

    // DELETE /api/:connection/:table/:id - Delete record
    this.router.delete(`${basePath}/:id`, async (req, res) => {
      try {
        const queryBuilder = new QueryBuilder(tableName, tableSchema);
        const query = queryBuilder.buildDelete(req.params.id);

        const result = await this.pool.query(query.text, query.values);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }

        res.json({ message: 'Record deleted', data: result.rows[0] });
      } catch (error) {
        console.error(`Error deleting ${tableName}:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    // Generate relationship routes
    this.generateRelationshipRoutes(tableName, tableSchema, basePath);
  }

  /**
   * Generate relationship routes for a table
   * @param {string} tableName - Table name
   * @param {object} tableSchema - Table schema
   * @param {string} basePath - Base path for the table
   */
  generateRelationshipRoutes(tableName, tableSchema, basePath) {
    // Track which relationships we've already created to avoid duplicates
    const createdRelationships = new Set();

    // Foreign key relationships (belongs-to)
    for (const fk of tableSchema.foreignKeys || []) {
      const relatedTable = fk.foreignTable;
      const relationshipKey = `${tableName}-${relatedTable}`;
      
      if (createdRelationships.has(relationshipKey)) continue;
      createdRelationships.add(relationshipKey);

      this.router.get(`${basePath}/:id/${relatedTable}`, async (req, res) => {
        try {
          const queryBuilder = new QueryBuilder(tableName, tableSchema);
          const query = queryBuilder.buildRelatedQuery(
            relatedTable,
            req.params.id,
            req.query
          );

          const result = await this.pool.query(query.text, query.values);
          res.json(result.rows);
        } catch (error) {
          console.error(`Error getting related ${relatedTable}:`, error);
          res.status(500).json({ error: error.message });
        }
      });
    }

    // Reverse foreign key relationships (has-many)
    for (const rfk of tableSchema.reverseForeignKeys || []) {
      const relatedTable = rfk.referencingTable;
      const relationshipKey = `${tableName}-${relatedTable}`;
      
      if (createdRelationships.has(relationshipKey)) continue;
      createdRelationships.add(relationshipKey);

      this.router.get(`${basePath}/:id/${relatedTable}`, async (req, res) => {
        try {
          const queryBuilder = new QueryBuilder(tableName, tableSchema);
          const query = queryBuilder.buildRelatedQuery(
            relatedTable,
            req.params.id,
            req.query
          );

          const result = await this.pool.query(query.text, query.values);
          res.json(result.rows);
        } catch (error) {
          console.error(`Error getting related ${relatedTable}:`, error);
          res.status(500).json({ error: error.message });
        }
      });
    }
  }
}

module.exports = APIGenerator;
