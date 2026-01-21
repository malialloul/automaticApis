import express, { Router, Request, Response } from 'express';
import QueryBuilder from './queryBuilder';
import { TableSchema, SchemaMap, DataStore, JSONValue, Graph, GraphFilter } from '../types';
import connectionManager from '../utils/connectionManager';
import { DBPool } from './schemaInspector';
import { QueryResult } from 'pg';
import { RowDataPacket } from 'mysql2/promise';

export default class APIGenerator {
  public connectionId: string;
  public pool: DBPool | null;
  public schema: SchemaMap;
  public dialect: string;
  public router: Router;
  public dataStore: DataStore | null;

  constructor(connectionId: string, pool: DBPool | null, schema: SchemaMap, dialect = 'postgres', dataStore: DataStore | null = null) {
    this.connectionId = connectionId;
    this.pool = pool;
    this.schema = schema;
    this.dialect = (dialect || 'postgres').toLowerCase();
    this.router = express.Router();
    this.dataStore = dataStore;

    // Register routes for each table in the schema
    for (const tableName of Object.keys(schema)) {
      const tableSchema = schema[tableName];
      this.generateCRUDRoutes(tableName, tableSchema);
      // Register related endpoints, etc. omitted for brevity
    }
  }

  private ensureLocalTableExists(tableName: string): Record<string, JSONValue>[] {
    if (!this.dataStore) throw new Error('No dataStore available for local database');
    // DataStore maps connectionId -> { tableName -> rows[] }
    if (!this.dataStore.has(this.connectionId)) this.dataStore.set(this.connectionId, {} as Record<string, Record<string, JSONValue>[]>);
    const connData = this.dataStore.get(this.connectionId) as Record<string, Record<string, JSONValue>[]>;
    if (!connData[tableName]) connData[tableName] = [];
    return connData[tableName];
  }

  private getPrimaryKeyValue(row: Record<string, JSONValue>, tableSchema: TableSchema): string | number | null {
    const pks = tableSchema.primaryKeys || [];
    if (pks.length === 0) return JSON.stringify(row);
    if (pks.length === 1) return (row[pks[0]] as string | number) ?? null;
    return pks.map(pk => String(row[pk])).join('|');
  }

  public generateCRUDRoutes(tableName: string, tableSchema: TableSchema): void {
    const basePath = `/${tableName}`;

    const runQuery = async <T extends Record<string, JSONValue> = Record<string, JSONValue>>(sql: string, params: Array<string | number | boolean | null> = []): Promise<T[]> => {
      if (!this.pool) throw new Error('No database pool available');
      const info = connectionManager.getInfo(this.connectionId);
      const r = await connectionManager.queryPool<T>(this.pool, info, sql, params);
      return r.rows as T[];
    };


    // Local DB in-memory handlers
    if (!this.pool) {
      // helper to coerce query param values into allowed param types
      const coerceQueryParam = (v: string | string[] | undefined): string | number | boolean | null => {
        if (v === undefined) return null;
        const s = Array.isArray(v) ? v[0] : v;
        if (s === 'true') return true;
        if (s === 'false') return false;
        const n = Number(s);
        if (!isNaN(n) && s.trim() !== '') return n;
        return s;
      };

      // GET list
      this.router.get(basePath, async (req: Request, res: Response<import('../types').ListResponse<Record<string, JSONValue>> | { error: string }>) : Promise<void> => {
        try {
          const queryObj = req.query as Record<string, string | string[] | undefined>;
          const limit = Number((Array.isArray(queryObj.limit) ? queryObj.limit[0] : queryObj.limit) || '100');
          const offset = Number((Array.isArray(queryObj.offset) ? queryObj.offset[0] : queryObj.offset) || '0');
          const orderBy = (Array.isArray(queryObj.orderBy) ? queryObj.orderBy[0] : queryObj.orderBy) as string | undefined;
          const orderDir = ((Array.isArray(queryObj.orderDir) ? queryObj.orderDir[0] : queryObj.orderDir) as string | undefined) || 'asc';
          let rows = this.ensureLocalTableExists(tableName) as Record<string, JSONValue>[];

          // Filters
          for (const [key, value] of Object.entries(queryObj)) {
            if (['limit', 'offset', 'orderBy', 'orderDir'].includes(key)) continue;
            const opMatch = key.match(/(.+?)__(gt|gte|lt|lte|like|contains|startswith|endswith)$/);
            if (opMatch) {
              const [, col, op] = opMatch;
              const coerced = coerceQueryParam(value);
              rows = rows.filter(r => {
                const val = (r as Record<string, JSONValue>)[col as string];
                const sval = String(val ?? '');
                const svalue = String(coerced ?? '');
                switch (op) {
                  case 'gt': return Number(sval) > Number(svalue);
                  case 'gte': return Number(sval) >= Number(svalue);
                  case 'lt': return Number(sval) < Number(svalue);
                  case 'lte': return Number(sval) <= Number(svalue);
                  case 'like':
                  case 'contains': return sval.includes(svalue);
                  case 'startswith': return sval.startsWith(svalue);
                  case 'endswith': return sval.endsWith(svalue);
                  default: return true;
                }
              });
            } else {
              const coerced = coerceQueryParam(value);
              rows = rows.filter(r => String((r as Record<string, JSONValue>)[key]) == String(coerced));
            }
          }

          if (orderBy) {
            rows.sort((a, b) => {
              const aVal = (a as Record<string, JSONValue>)[orderBy];
              const bVal = (b as Record<string, JSONValue>)[orderBy];
              const aStr = aVal === null ? '' : String(aVal);
              const bStr = bVal === null ? '' : String(bVal);
              const cmp = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
              return orderDir === 'desc' ? -cmp : cmp;
            });
          }

          const total = rows.length;
          const slice = rows.slice(offset, offset + limit);
          res.json(slice);
          return;
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
          return;
        }
      });

      // POST create
      this.router.post(basePath, async (req: Request, res: Response<import('../types').CreateResponse<Record<string, JSONValue>> | { error: string }>) : Promise<void> => {
        try {
          const rows = this.ensureLocalTableExists(tableName) as Record<string, JSONValue>[];
          const newRow: Record<string, JSONValue> = {};
          for (const [key, value] of Object.entries(req.body || {})) {
            const cleanKey = (key as string).includes('.') ? (key as string).split('.')[1] : key;
            newRow[cleanKey] = value as JSONValue;
          }

          const pks = tableSchema.primaryKeys || [];
          if (pks.length === 1) {
            const pkCol = pks[0];
            if (!(newRow as Record<string, JSONValue>)[pkCol]) {
              const maxId = Math.max(...rows.map(r => Number((r as Record<string, JSONValue>)[pkCol]) || 0), 0);
              (newRow as Record<string, JSONValue>)[pkCol] = (maxId + 1) as JSONValue;
            }
          }

          rows.push(newRow as Record<string, JSONValue>);
          res.status(201).json(newRow);
          return;
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
          return;
        }
      });

      // PUT collection
      this.router.put(basePath, async (req: Request, res: Response<{ updated: number; message: string } | { error: string }>): Promise<void> => {
        try {
          const rows = this.ensureLocalTableExists(tableName) as Record<string, JSONValue>[];
          let { data, where } = req.body as { data?: Record<string, JSONValue>; where?: Record<string, JSONValue | { op?: string; val?: JSONValue }> };

          if (!data || Object.keys(data).length === 0) {
            res.status(400).json({ error: 'No update data provided' });
            return;
          }

          if (req.query.id && !where) {
            const pks = tableSchema.primaryKeys || [];
            if (pks.length > 0) where = { [pks[0]]: (req.query.id as string | number) } as Record<string, JSONValue>;
          }

          const normalizedData: Record<string, JSONValue> = {};
          for (const [key, value] of Object.entries(data)) {
            const cleanKey = (key as string).includes('.') ? (key as string).split('.')[1] : key;
            normalizedData[cleanKey] = value as JSONValue;
          }

          let updated = 0;
          for (let i = 0; i < rows.length; i++) {
            // matchesWhere implementation simplified: basic equality checks
            const row = rows[i];
            let match = true;
            if (where) {
              for (const [k, v] of Object.entries(where)) {
                if (String((row as Record<string, JSONValue>)[k]) !== String(v as JSONValue)) { match = false; break; }
              }
            }
            if (match) {
              rows[i] = { ...rows[i], ...normalizedData };
              updated++;
            }
          }

          res.json({ updated, message: `Updated ${updated} row(s)` });
          return;
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
          return;
        }
      });

      // DELETE collection (requires where)
      this.router.delete(basePath, async (req: Request, res: Response<import('../types').DeleteResponse | { error: string }>): Promise<void> => {
        try {
          const rows = this.ensureLocalTableExists(tableName) as Record<string, JSONValue>[];
          let { where } = req.body as { where?: Record<string, JSONValue | { op?: string; val?: JSONValue }> };

          if (req.query.id && !where) {
            const pks = tableSchema.primaryKeys || [];
            if (pks.length > 0) where = { [pks[0]]: (req.query.id as string | number) } as Record<string, JSONValue>;
          }

          if ((!where || Object.keys(where).length === 0) && Object.keys(req.query || {}).length > 0) {
            const q = { ...req.query } as Record<string, string | string[] | undefined>;
            const built: Record<string, string | { op: string; val?: string | string[] | undefined }> = {};
            for (const [key, val] of Object.entries(q)) {
              if (['limit', 'offset', 'orderBy', 'orderDir', 'id'].includes(key)) continue;
              const opMatch = key.match(/(.+?)__(gt|gte|lt|lte|like|contains|startswith|endswith|ne)$/);
              if (opMatch) {
                const [, col, op] = opMatch;
                built[col] = { op, val } as { op: string; val?: string | string[] | undefined };
              } else {
                if (val !== undefined) built[key] = val as string;
              }
            }
            if (Object.keys(built).length > 0) {
              const mapped: Record<string, JSONValue | { op: string; val?: JSONValue }> = {};
              for (const [k, v] of Object.entries(built)) {
                if (typeof v === 'object' && v !== null && 'op' in v) {
                  const maybe = v as { op: string; val?: string | string[] | undefined };
                  mapped[k] = { op: maybe.op, val: Array.isArray(maybe.val) ? (maybe.val as JSONValue) : (maybe.val as JSONValue) };
                } else {
                  mapped[k] = (v as string | undefined) as JSONValue;
                }
              }
              where = mapped;
            }
          }

          if (!where || Object.keys(where).length === 0) {
            res.status(400).json({ error: 'DELETE requires a where clause or id parameter to prevent accidental deletion of all records' });
            return;
          }

          let initialLength = rows.length;
          let i = rows.length;
          while (i--) {
            let shouldDelete = true;
            for (const [k, v] of Object.entries(where)) {
              if (typeof v === 'object' && v !== null && 'op' in v && 'val' in v) {
                // simple operator handling
                const rowVal = (rows[i] as Record<string, JSONValue>)[k];
                const compareVal = String((v as { val?: JSONValue }).val);
                if (String(rowVal) !== compareVal) shouldDelete = false;
              } else {
                if (String((rows[i] as Record<string, JSONValue>)[k]) !== String(v as JSONValue)) shouldDelete = false;
              }
            }
            if (shouldDelete) rows.splice(i, 1);
          }

          const deleted = initialLength - rows.length;
          res.json({ deleted, message: `Deleted ${deleted} row(s)` });
          return;
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
          return;
        }
      });

      // GET single
      this.router.get(`${basePath}/:id`, async (req: Request, res: Response<Record<string, JSONValue> | null | { error: string }>): Promise<void> => {
        try {
          const rows = this.ensureLocalTableExists(tableName) as Record<string, JSONValue>[];
          const pks = tableSchema.primaryKeys || [];
          let row = null;
          if (pks.length > 0) {
            row = rows.find(r => String(this.getPrimaryKeyValue(r, tableSchema)) === String(req.params.id));
          }
          res.json(row);
          return;
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
          return;
        }
      });

      // PUT single
      this.router.put(`${basePath}/:id`, async (req: Request, res: Response<Record<string, JSONValue> | { error: string }>): Promise<void> => {
        try {
          const rows = this.ensureLocalTableExists(tableName) as Record<string, JSONValue>[];
          const pks = tableSchema.primaryKeys || [];
          if (pks.length === 0) {
            res.status(400).json({ error: 'No primary key defined' });
            return;
          }
          const idx = rows.findIndex(r => String(this.getPrimaryKeyValue(r, tableSchema)) === String(req.params.id));
          if (idx === -1) { res.status(404).json({ error: 'Row not found' }); return; }
          rows[idx] = { ...rows[idx], ...(req.body || {}) };
          res.json(rows[idx]);
          return;
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
          return;
        }
      });

      // DELETE single
      this.router.delete(`${basePath}/:id`, async (req: Request, res: Response) => {
        try {
          const rows = this.ensureLocalTableExists(tableName) as Record<string, JSONValue>[];
          const pks = tableSchema.primaryKeys || [];
          if (pks.length === 0) return res.status(400).json({ error: 'No primary key defined' });
          const idx = rows.findIndex(r => String(this.getPrimaryKeyValue(r, tableSchema)) === String(req.params.id));
          if (idx === -1) return res.status(404).json({ error: 'Row not found' });
          const deleted = rows.splice(idx, 1);
          res.json({ deleted: deleted[0], message: 'Row deleted' });
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
        }
      });

      return;
    }

    // Non-local (backed by DB) handlers
    this.router.get(basePath, async (req: Request, res: Response): Promise<void> => {
      try {
        const qobj = req.query as Record<string, string | string[] | undefined>;
        const limit = Number((Array.isArray(qobj.limit) ? qobj.limit[0] : qobj.limit) ?? '100');
        const offset = Number((Array.isArray(qobj.offset) ? qobj.offset[0] : qobj.offset) ?? '0');
        const orderBy = (Array.isArray(qobj.orderBy) ? qobj.orderBy[0] : qobj.orderBy) as string | undefined;
        const orderDir = ((Array.isArray(qobj.orderDir) ? qobj.orderDir[0] : qobj.orderDir) as string | undefined) || 'asc';
        const filters: Record<string, string | undefined> = Object.fromEntries(Object.entries(qobj).filter(([k]) => !['limit','offset','orderBy','orderDir'].includes(k)).map(([k,v]) => [k, Array.isArray(v) ? v[0] : v]));
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildSelect({ filters: filters as Record<string, JSONValue>, limit, offset, orderBy, orderDir });
        const rows = await runQuery<Record<string, JSONValue>>(q.text, q.values);
        res.json(rows);
        return;
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
      }
    });

    // PUT collection
    this.router.put(`${basePath}`, async (req: Request, res: Response) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const data = req.body && Object.keys(req.body).length ? (req.body.data || req.body) : null;
        if (!data || Object.keys(data).length === 0) throw new Error('No update data provided');

        const setClauses: string[] = [];
        for (const [k, v] of Object.entries(data)) {
          if (!qb.isValidColumn(k)) continue;
          // Coerce update values into allowed param types
          const val = (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) ? v : String(v);
          setClauses.push(`${qb.sanitizeIdentifier(k)} = ${qb.addParam(val as string | number | boolean | null)}`);
        }

        if (setClauses.length === 0) throw new Error('No valid columns to update');

        const whereClauses: string[] = [];
        const queryObj = req.query as Record<string, string | string[] | undefined>;
        for (const [col, val] of Object.entries(queryObj || {})) {
          if (!qb.isValidColumn(col) && !col.includes('__')) continue;
          const opMatch = col.match(/(.+?)__(gt|gte|lt|lte|like|contains|startswith|endswith)$/);
          if (opMatch) {
            const column = opMatch[1];
            const op = opMatch[2];
            if (!qb.isValidColumn(column)) continue;
            if (['like','contains','startswith','endswith'].includes(op)) {
              let v = Array.isArray(val) ? val[0] : val;
              if (op === 'contains') v = `%${v}%`;
              else if (op === 'startswith') v = `${v}%`;
              else if (op === 'endswith') v = `%${v}`;
              whereClauses.push(`${qb.sanitizeIdentifier(column)} LIKE ${qb.addParam((v as string) ?? null)}`);
            } else {
              const map: Record<string, string> = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
              const sqlOp = map[op] || '=';
              whereClauses.push(`${qb.sanitizeIdentifier(column)} ${sqlOp} ${qb.addParam((Array.isArray(val) ? val[0] : val) as string | number | boolean | null)}`);
            }
            continue;
          }
          if (!qb.isValidColumn(col)) continue;
          if (Array.isArray(val)) {
            const placeholders = val.map((v) => qb.addParam((v as string | number | boolean | null)));
            whereClauses.push(`${qb.sanitizeIdentifier(col)} IN (${placeholders.join(', ')})`);
          } else {
            whereClauses.push(`${qb.sanitizeIdentifier(col)} = ${qb.addParam((val as string | number | boolean | null))}`);
          }
        }

        if (req.body && req.body.where && typeof req.body.where === 'object') {
          // body.where handling; type body.where as Record<string, string|number|boolean|null|{op?:string;val?: string|number|boolean|null}> when invoking endpoint
          for (const [k, v] of Object.entries(req.body.where as Record<string, string | number | boolean | null | { op?: string; val?: string | number | boolean | null }>)) {
            if (!qb.isValidColumn(k)) continue;
            if (typeof v === 'object' && v !== null && 'op' in v && 'val' in v) {
              const map: Record<string, string> = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
              const sqlOp = map[(v as { op?: string }).op || ''] || '=';
              whereClauses.push(`${qb.sanitizeIdentifier(k)} ${sqlOp} ${qb.addParam((v as { val?: string | number | boolean | null }).val ?? null)}`);
            } else {
              whereClauses.push(`${qb.sanitizeIdentifier(k)} = ${qb.addParam((v as string | number | boolean | null))}`);
            }
          }
        }

            const wherePredicate = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
        const sql = `UPDATE ${qb.sanitizeIdentifier(tableName)} SET ${setClauses.join(', ')}${wherePredicate}` + (this.dialect === 'postgres' ? ' RETURNING *' : '');
        const rows = await runQuery<Record<string, JSONValue>>(sql, qb.getParams());
        res.json(rows);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // DELETE collection-level (supports filters)
    this.router.delete(basePath, async (req: Request, res: Response): Promise<void> => {
      try {
        const filters: Record<string, string | string[] | undefined> = { ...req.query } as Record<string, string | string[] | undefined>;
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        // Use buildDeleteWhere to construct safe DELETE with WHERE
        const q = qb.buildDeleteWhere(filters as Record<string, JSONValue>);

        const info = connectionManager.getInfo(this.connectionId);
        const result = await connectionManager.queryPool<Record<string, JSONValue>>(this.pool, info, q.text, q.values);
        const deleted = result.affectedRows ?? result.rowCount ?? 0;
        res.json({ deleted, sql: q.text, data: result.rows });
        return;
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });

    // POST create
    this.router.post(basePath, async (req: Request, res: Response): Promise<void> => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildInsert(req.body || {});

        const info = connectionManager.getInfo(this.connectionId);
      const r = await connectionManager.queryPool<Record<string, JSONValue>>(this.pool, info, q.text, q.values);
        const insertId = r.insertId ?? null;
        if (insertId) {
          const qbSel = new QueryBuilder(tableName, tableSchema, this.dialect);
          const sel = qbSel.buildSelectById(insertId);
          const selR = await connectionManager.queryPool<Record<string, JSONValue>>(this.pool, info, sel.text, sel.values);
          const row = selR.rows[0] || {};
          res.status(201).json(row);
          return;
        }
        if (r.rows && r.rows.length > 0) { res.status(201).json(r.rows[0]); return; }
        res.status(201).json({ message: 'Record created' });
        return;
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });

    // GET by id
    this.router.get(`${basePath}/:id`, async (req: Request, res: Response): Promise<void> => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const q = qb.buildSelectById(idParam);

        const info = connectionManager.getInfo(this.connectionId);
        const r = await connectionManager.queryPool<Record<string, JSONValue>>(this.pool, info, q.text, q.values);
        const row = r.rows[0] || null;
        if (!row) { res.status(404).json({ error: 'Record not found' }); return; }
        res.json(row);
        return;
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // PUT by id
    this.router.put(`${basePath}/:id`, async (req: Request, res: Response): Promise<void> => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const updateQ = qb.buildUpdate(idParam, req.body || {});
        const info = connectionManager.getInfo(this.connectionId);
        await connectionManager.queryPool(this.pool, info, updateQ.text, updateQ.values);
        const qb2 = new QueryBuilder(tableName, tableSchema, this.dialect);
        const sel = qb2.buildSelectById(idParam);
        const selR = await connectionManager.queryPool<Record<string, JSONValue>>(this.pool, info, sel.text, sel.values);
        const row = selR.rows[0] || null;
        if (!row) { res.status(404).json({ error: 'Record not found' }); return; }
        res.json(row);
        return;
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
  }

  public async executeWrite(operation: 'INSERT' | 'UPDATE' | 'DELETE', graph: Graph, data?: Record<string, JSONValue>, options?: { previewOnly?: boolean; additionalFilters?: GraphFilter[] }): Promise<import('../types').ExecuteResult> {
    // Basic local in-memory execution for Builder convenience. Remote database execution is not implemented here.
    if (this.pool) throw new Error('Remote execute not implemented in APIGenerator');
    const op = (operation || '').toUpperCase();
    const src = graph.source;
    if (!src || !src.table) throw new Error('Missing graph.source');

    // Use simplified preview where we return a pseudo-SQL or simple result
    if (options?.previewOnly) {
      return { operation: op, sql: `PREVIEW: ${op} on ${src.table}`, previewOnly: true };
    }

    // Simple implementations for local data store
    if (op === 'INSERT') {
      if (!data || Object.keys(data).length === 0) throw new Error('No data provided for INSERT');
      const tableDataMap: Record<string, Record<string, JSONValue>> = {};
      Object.entries(data).forEach(([k, v]) => {
        if (k.includes('.')) {
          const [tbl, col, ...rest] = k.split('.');
          if (!tableDataMap[tbl]) tableDataMap[tbl] = {} as Record<string, JSONValue>;
          tableDataMap[tbl][col] = v;
        } else {
          if (!tableDataMap[src.table]) tableDataMap[src.table] = {} as Record<string, JSONValue>;
          tableDataMap[src.table][k] = v;
        }
      });

      const results: Array<{ table: string; insertedRow?: Record<string, JSONValue>; affectedRows?: number; insertId?: number }> = [];
      for (const [tbl, cols] of Object.entries(tableDataMap)) {
        const rows = this.ensureLocalTableExists(tbl);
        const newRow: Record<string, JSONValue> = {};
        Object.assign(newRow, cols);
        // auto PK generation simplistic
        const pks = (this.schema[tbl]?.primaryKeys) || [];
        if (pks.length === 1) {
          const pk = pks[0];
          if (!newRow[pk]) {
            const maxId = Math.max(...rows.map(r => Number(r[pk]) || 0), 0);
            newRow[pk] = (maxId + 1) as JSONValue;
          }
        }
        rows.push(newRow);
        results.push({ table: tbl, insertedRow: newRow });
      }
      return { operation: 'INSERT', results };
    } else if (op === 'UPDATE') {
      if (!data || Object.keys(data).length === 0) throw new Error('No data provided for UPDATE');
      // Only support updating source table for now
      const rows = this.ensureLocalTableExists(src.table);
      // Build simple where from graph.filters
      const filters = [...(graph.filters || []), ...(options?.additionalFilters || [])];
      let updated = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let match = true;
        for (const f of filters) {
          const field = f.field || '';
          const expected = String(f.value ?? '');
          if (String(row[field] ?? '') !== expected) { match = false; break; }
        }
        if (match) {
          for (const [k, v] of Object.entries(data)) {
            const cleanKey = k.includes('.') ? k.split('.')[1] : k;
            row[cleanKey] = v;
          }
          updated++;
        }
      }
      return { operation: 'UPDATE', updated };
    } else if (op === 'DELETE') {
      const rows = this.ensureLocalTableExists(src.table);
      const filters = [...(graph.filters || []), ...(options?.additionalFilters || [])];
      let deleted = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        let match = true;
        for (const f of filters) {
          const field = f.field || '';
          const expected = String(f.value ?? '');
          if (String(row[field] ?? '') !== expected) { match = false; break; }
        }
        if (match) { rows.splice(i, 1); deleted++; }
      }
      return { operation: 'DELETE', deleted };
    }

    throw new Error('Unsupported operation');
  }

  public async previewGraph(graph: Graph, limit = 5): Promise<Record<string, JSONValue>[]> {
    // Local preview: return rows from dataStore based on simple graph filters
    if (this.pool) throw new Error('Remote preview not implemented in APIGenerator');
    const src = graph.source;
    if (!src || !src.table) throw new Error('Missing graph.source');
    const rows = this.ensureLocalTableExists(src.table);
    const filters = graph.filters || [];
    const out = rows.filter(r => {
      for (const f of filters) {
        const field = f.field || '';
        const expected = String(f.value ?? '');
        if (String(r[field] ?? '') !== expected) return false;
      }
      return true;
    }).slice(0, limit);
    return out;
  }

  public generateRoutes(): Router {
    return this.router;
  }
}
