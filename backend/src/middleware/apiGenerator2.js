const express = require('express');
const QueryBuilder = require('./queryBuilder');

class APIGenerator {
  constructor(connectionId, pool, schema, dialect = 'postgres') {
    this.connectionId = connectionId;
    this.pool = pool;
    this.schema = schema;
    this.dialect = dialect;
    this.router = express.Router();
  }

  generateRoutes() {
    for (const [tableName, tableSchema] of Object.entries(this.schema)) {
      this.generateTableRoutes(tableName, tableSchema);
    }
    return this.router;
  }

  generateTableRoutes(tableName, tableSchema) {
    const basePath = `/${tableName}`;

    this.router.get(basePath, async (req, res) => {
      try {
        const { limit, offset, orderBy, orderDir, ...filters } = req.query;
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildSelect({
          filters,
          limit: limit || 100,
          offset: offset || 0,
          orderBy,
          orderDir,
        });
        const result = await this.pool.query(q.text, q.values);
        const rows = result.rows ?? result[0];
        res.json(rows);
      } catch (error) {
        console.error(`Error listing ${tableName}:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    this.router.post(basePath, async (req, res) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildInsert(req.body);
        const result = await this.pool.query(q.text, q.values);
        if (this.dialect === 'mysql') {
          const insertId = (result[0] && result[0].insertId) || null;
          if (insertId) {
            const qbSel = new QueryBuilder(tableName, tableSchema, this.dialect);
            const sel = qbSel.buildSelectById(insertId);
            const selRes = await this.pool.query(sel.text, sel.values);
            const rows = selRes.rows ?? selRes[0];
            return res.status(201).json(rows[0] || {});
          }
          return res.status(201).json({ message: 'Record created' });
        }
        return res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error(`Error creating ${tableName}:`, error);
        res.status(400).json({ error: error.message });
      }
    });

    this.router.get(`${basePath}/:id`, async (req, res) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildSelectById(req.params.id);
        const result = await this.pool.query(q.text, q.values);
        const rows = result.rows ?? result[0];
        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        res.json(rows[0]);
      } catch (error) {
        console.error(`Error getting ${tableName}:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    this.router.put(`${basePath}/:id`, async (req, res) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildUpdate(req.params.id, req.body);
        const result = await this.pool.query(q.text, q.values);
        if (this.dialect === 'mysql') {
          const qbSel = new QueryBuilder(tableName, tableSchema, this.dialect);
          const sel = qbSel.buildSelectById(req.params.id);
          const selRes = await this.pool.query(sel.text, sel.values);
          const rows = selRes.rows ?? selRes[0];
          if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Record not found' });
          }
          return res.json(rows[0]);
        }
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        return res.json(result.rows[0]);
      } catch (error) {
        console.error(`Error updating ${tableName}:`, error);
        res.status(400).json({ error: error.message });
      }
    });

    this.router.delete(`${basePath}/:id`, async (req, res) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildDelete(req.params.id);
        const result = await this.pool.query(q.text, q.values);
        if (this.dialect === 'mysql') {
          return res.json({ message: 'Record deleted' });
        }
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        return res.json({ message: 'Record deleted', data: result.rows[0] });
      } catch (error) {
        console.error(`Error deleting ${tableName}:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    this.generateRelationshipRoutes(tableName, tableSchema, basePath);
  }

  generateRelationshipRoutes(tableName, tableSchema, basePath) {
    const createdRelationships = new Set();

    for (const fk of tableSchema.foreignKeys || []) {
      const relatedTable = fk.foreignTable;
      const relationshipKey = `${tableName}-${relatedTable}`;
      if (createdRelationships.has(relationshipKey)) continue;
      createdRelationships.add(relationshipKey);

      this.router.get(`${basePath}/:id/${relatedTable}`, async (req, res) => {
        try {
          const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
          const q = qb.buildRelatedQuery(relatedTable, req.params.id, req.query);
          const result = await this.pool.query(q.text, q.values);
          const rows = result.rows ?? result[0];
          res.json(rows);
        } catch (error) {
          console.error(`Error getting related ${relatedTable}:`, error);
          res.status(500).json({ error: error.message });
        }
      });
    }

    for (const rfk of tableSchema.reverseForeignKeys || []) {
      const relatedTable = rfk.referencingTable;
      const relationshipKey = `${tableName}-${relatedTable}`;
      if (createdRelationships.has(relationshipKey)) continue;
      createdRelationships.add(relationshipKey);

      this.router.get(`${basePath}/:id/${relatedTable}`, async (req, res) => {
        try {
          const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
          const q = qb.buildRelatedQuery(relatedTable, req.params.id, req.query);
          const result = await this.pool.query(q.text, q.values);
          const rows = result.rows ?? result[0];
          res.json(rows);
        } catch (error) {
          console.error(`Error getting related ${relatedTable}:`, error);
          res.status(500).json({ error: error.message });
        }
      });
    }
  }
}

module.exports = APIGenerator;
