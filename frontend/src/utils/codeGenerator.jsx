export const BACKEND_LANGUAGE_OPTIONS = [
  { value: "express", label: "Node.js (Express + pg)" },
  { value: "fastapi", label: "Python (FastAPI + asyncpg)" },
  { value: "go-gin", label: "Go (Gin + lib/pq)" },
  { value: "spring", label: "Java (Spring Boot + JdbcTemplate)" },
];

export const generateBackendSnippet = (
  schema,
  tableName,
  language,
  method,
  endpoint
) => {
  const tableSchema = schema[tableName];
  if (!tableSchema) throw new Error(`Table schema not found: ${tableName}`);

  const idCol = tableSchema.primaryKeys?.[0] || "id";
  const fkCols = (tableSchema.foreignKeys || []).map((fk) => fk.column);

  const generators = {
    express: backendExpressSnippet,
    fastapi: backendFastAPISnippet,
    spring: backendJavaSpringSnippet,
    "go-gin": backendGoGinSnippet,
  };

  const generator = generators[language.toLowerCase()];
  if (!generator) throw new Error(`Unsupported language: ${language}`);

  return generator(tableSchema, tableName, method, idCol, fkCols, endpoint);
};

// ------------------ Node.js / Express ------------------
function backendExpressSnippet(
  tableSchema,
  tableName,
  method,
  idCol,
  fkCols,
  endpoint
) {
  const safeTable = sanitizeIdent(tableName);
  const lines = [];
  const path = endpoint.path;
  const pathParts = path.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const secondLastPart = pathParts[pathParts.length - 2];

  // Detect new relationship endpoint pattern: /by_{fkCol}/:{fkCol}/relatedTable
  const isRelationshipByFK = pathParts.some((p) => p.startsWith("by_")) && pathParts.some((p) => p.startsWith(":"));
  let fkParam = null;
  if (isRelationshipByFK) {
    // e.g., by_order_id/:order_id/products
    const byIdx = pathParts.findIndex((p) => p.startsWith("by_"));
    if (byIdx !== -1 && pathParts[byIdx + 1] && pathParts[byIdx + 1].startsWith(":")) {
      fkParam = pathParts[byIdx + 1].slice(1);
    }
  }

  // Detail if last part starts with ":" (assume it is ID)
  const isDetail = lastPart.startsWith(":");

  // Nested child if last part is table name AND path contains a parent id param
  // e.g., /categories/:id/products => lastPart = "products", secondLastPart = ":id"
  const isNestedChild =
    !isDetail && lastPart === safeTable
      ? false
      : pathParts.some((part) => part.startsWith(":"));

  if (method === "GET") {
    if (isRelationshipByFK && fkParam) {
      lines.push(`// GET ${safeTable} related by ${fkParam}`);
      lines.push(`router.get('${path}', async (req, res) => {`);
      lines.push(`  try {`);
      lines.push(`    // This endpoint returns related records by foreign key: ${fkParam}`);
      lines.push(`    const sql = \`SELECT * FROM "${safeTable}" WHERE "${fkParam}"=$1\`;`);
      lines.push(`    const { rows } = await pool.query(sql, [req.params.${fkParam}]);`);
      lines.push(`    res.json(rows);`);
      lines.push(`  } catch (err) { res.status(500).json({ error: err.message }); }`);
      lines.push(`});`);
    } else if (!isDetail && !isNestedChild) {
      lines.push(`// GET all ${safeTable}`);
      lines.push(`router.get('${path}', async (req, res) => {`);
      lines.push(`  try {`);
      lines.push(`    const { limit = 100, offset = 0 } = req.query;`);
      lines.push(
        `    const sql = \`SELECT * FROM "${safeTable}" LIMIT $1 OFFSET $2\`;`
      );
      lines.push(
        `    const { rows } = await pool.query(sql, [limit, offset]);`
      );
      lines.push(`    res.json(rows);`);
      lines.push(
        `  } catch (err) { res.status(500).json({ error: err.message }); }`
      );
      lines.push(`});`);
    } else if (isNestedChild) {
      lines.push(`// GET ${safeTable} filtered by parent`);
      lines.push(`router.get('${path}', async (req, res) => {`);
      lines.push(`  try {`);
      const filters = fkCols.filter((fk) => path.includes(`/:${fk}`));
      if (filters.length) {
        lines.push(
          `    const sql = \`SELECT * FROM "${safeTable}" WHERE ${filters
            .map((fk, i) => `"${fk}"=$${i + 1}`)
            .join(" AND ")}\`;`
        );
        lines.push(
          `    const params = [${filters
            .map((fk) => `req.params.${fk}`)
            .join(", ")}];`
        );
        lines.push(`    const { rows } = await pool.query(sql, params);`);
      } else {
        lines.push(
          `    const { rows } = await pool.query(\`SELECT * FROM "${safeTable}"\`);`
        );
      }
      lines.push(`    res.json(rows);`);
      lines.push(
        `  } catch (err) { res.status(500).json({ error: err.message }); }`
      );
      lines.push(`});`);
    } else {
      lines.push(`// GET ${safeTable} by ID`);
      lines.push(`router.get('${path}', async (req, res) => {`);
      lines.push(`  try {`);
      let whereClause = `"${idCol}"=$1`;
      let params = `[req.params.${idCol}]`;
      fkCols.forEach((fk) => {
        if (path.includes(`/:${fk}`)) {
          whereClause += ` AND "${fk}"=$${params.length + 1}`;
          params.push(`req.params.${fk}`);
        }
      });
      lines.push(
        `    const sql = \`SELECT * FROM "${safeTable}" WHERE ${whereClause}\`;`
      );
      lines.push(`    const { rows } = await pool.query(sql, ${params});`);
      lines.push(
        `    if (!rows.length) return res.status(404).json({ error: 'Not found' });`
      );
      lines.push(`    res.json(rows[0]);`);
      lines.push(
        `  } catch (err) { res.status(500).json({ error: err.message }); }`
      );
      lines.push(`});`);
    }
  }

  if (["POST", "PUT"].includes(method)) {
    lines.push(`// ${method} ${safeTable}`);
    lines.push(
      `router.${method.toLowerCase()}('${path}', async (req, res) => {`
    );
    lines.push(`  try {`);
    lines.push(`    const body = req.body || {};`);
    lines.push(`    const keys = Object.keys(body);`);
    lines.push(`    const values = Object.values(body);`);

    // Add parent FK if nested
    fkCols.forEach((fk) => {
      if (path.includes(`/:${fk}`)) {
        lines.push(`    keys.push("${fk}");`);
        lines.push(`    values.push(req.params.${fk});`);
      }
    });

    if (method === "POST") {
      lines.push(
        `    const sql = \`INSERT INTO "${safeTable}" (${keys
          .map((k) => '"' + k + '"')
          .join(", ")}) VALUES (${keys
          .map((_, i) => "$" + (i + 1))
          .join(", ")}) RETURNING *\`;`
      );
      lines.push(`    const { rows } = await pool.query(sql, values);`);
      lines.push(`    res.status(201).json(rows[0]);`);
    }

    if (method === "PUT") {
      lines.push(`    values.push(req.params.${idCol});`);
      lines.push(
        `    const sql = \`UPDATE "${safeTable}" SET ${keys
          .map((k, i) => `"\${k}"=$\${i+1}`)
          .join(", ")} WHERE "${idCol}"=$${keys.length + 1} RETURNING *\`;`
      );
      lines.push(`    const { rows } = await pool.query(sql, values);`);
      lines.push(
        `    if (!rows.length) return res.status(404).json({ error: 'Not found' });`
      );
      lines.push(`    res.json(rows[0]);`);
    }

    lines.push(
      `  } catch (err) { res.status(400).json({ error: err.message }); }`
    );
    lines.push(`});`);
  }

  if (method === "DELETE") {
    lines.push(`// DELETE ${safeTable}`);
    lines.push(`router.delete('${path}', async (req, res) => {`);
    lines.push(`  try {`);
    lines.push(
      `    const sql = \`DELETE FROM "${safeTable}" WHERE "${idCol}"=$1 RETURNING *\`;`
    );
    lines.push(
      `    const { rows } = await pool.query(sql, [req.params.${idCol}]);`
    );
    lines.push(
      `    if (!rows.length) return res.status(404).json({ error: 'Not found' });`
    );
    lines.push(`    res.json({ deleted: rows[0] });`);
    lines.push(
      `  } catch (err) { res.status(500).json({ error: err.message }); }`
    );
    lines.push(`});`);
  }

  return lines.join("\n");
}

// ------------------ Python / FastAPI ------------------
function backendFastAPISnippet(
  tableSchema,
  tableName,
  method,
  idCol,
  fkCols,
  endpoint
) {
  const safeTable = sanitizeIdent(tableName);
  const lines = [];
  const path = endpoint.path;

  const pathParts = path.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const isNestedChild = lastPart !== safeTable && method === "GET";
  const isDetail = path.includes(`/:${idCol}`) && !isNestedChild;

  if (method === "GET") {
    if (!isDetail && !isNestedChild) {
      lines.push(`# GET all ${safeTable}`);
      lines.push(`@app.get("${path}")`);
      lines.push(
        `async def get_all_${safeTable}(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)):`
      );

      lines.push(`    try:`);
      lines.push(
        `        query = select(${safeTable}).limit(limit).offset(offset)`
      );
      lines.push(`        result = await db.execute(query)`);
      lines.push(`        return result.fetchall()`);
      lines.push(`    except Exception as e:`);
      lines.push(`        raise HTTPException(status_code=500, detail=str(e))`);
    } else if (isNestedChild) {
      lines.push(`# GET ${safeTable} filtered by parent`);
      lines.push(`@app.get("${path}")`);
      lines.push(
        `async def get_${safeTable}_by_parent(db: Session = Depends(get_db), ${fkCols
          .map((fk) => fk + ": int")
          .join(", ")}):`
      );
      lines.push(`    try:`);
      lines.push(`        query = select(${safeTable})`);
      const filters = fkCols.filter((fk) => path.includes(`/:${fk}`));
      if (filters.length) {
        filters.forEach((fk) => {
          lines.push(
            `        query = query.where(${safeTable}.c.${fk} == ${fk})`
          );
        });
      }
      lines.push(`        result = await db.execute(query)`);
      lines.push(`        return result.fetchall()`);
      lines.push(`    except Exception as e:`);
      lines.push(`        raise HTTPException(status_code=500, detail=str(e))`);
    } else {
      lines.push(`# GET ${safeTable} by ID`);
      lines.push(`@app.get("${path}")`);
      lines.push(
        `async def get_${safeTable}_by_id(${idCol}: int, db: Session = Depends(get_db)):`
      );

      lines.push(`    try:`);
      lines.push(
        `        query = select(${safeTable}).where(${safeTable}.c.${idCol} == ${idCol})`
      );
      fkCols.forEach((fk) => {
        if (path.includes(`/:${fk}`)) {
          lines.push(
            `        query = query.where(${safeTable}.c.${fk} == ${fk})`
          );
        }
      });
      lines.push(`        result = await db.execute(query)`);
      lines.push(`        row = result.fetchone()`);
      lines.push(
        `        if not row: raise HTTPException(status_code=404, detail="Not found")`
      );
      lines.push(`        return row`);
      lines.push(`    except Exception as e:`);
      lines.push(`        raise HTTPException(status_code=500, detail=str(e))`);
    }
  }

  if (["POST", "PUT"].includes(method)) {
    lines.push(`# ${method} ${safeTable}`);
    lines.push(`@app.${method.toLowerCase()}("${path}")`);
    lines.push(
      `async def ${method.toLowerCase()}_${safeTable}(body: dict, db: Session = Depends(get_db)${
        isNestedChild ? ", " + fkCols.map((fk) => fk + ": int").join(", ") : ""
      }):`
    );
    lines.push(`    try:`);
    lines.push(`        keys = list(body.keys())`);
    lines.push(`        values = list(body.values())`);

    if (isNestedChild) {
      fkCols.forEach((fk) => {
        if (path.includes(`/:${fk}`)) {
          lines.push(`        body["${fk}"] = ${fk}`);
        }
      });
    }

    if (method === "POST") {
      lines.push(`        stmt = ${safeTable}.insert().values(**body)`);
      lines.push(`        result = await db.execute(stmt)`);
      lines.push(`        await db.commit()`);
      lines.push(`        return result.inserted_primary_key`);
    }

    if (method === "PUT") {
      lines.push(
        `        stmt = ${safeTable}.update().where(${safeTable}.c.${idCol} == body.get("${idCol}", ${idCol})).values(**body)`
      );
      lines.push(`        result = await db.execute(stmt)`);
      lines.push(`        await db.commit()`);
      lines.push(`        return {"updated": result.rowcount}`);
    }

    lines.push(`    except Exception as e:`);
    lines.push(`        raise HTTPException(status_code=400, detail=str(e))`);
  }

  if (method === "DELETE") {
    lines.push(`# DELETE ${safeTable}`);
    lines.push(`@app.delete("${path}")`);
    lines.push(
      `async def delete_${safeTable}(${idCol}: int, db: Session = Depends(get_db)):`
    );

    lines.push(`    try:`);
    lines.push(
      `        stmt = ${safeTable}.delete().where(${safeTable}.c.${idCol} == ${idCol})`
    );
    lines.push(`        result = await db.execute(stmt)`);
    lines.push(`        await db.commit()`);
    lines.push(
      `        if result.rowcount == 0: raise HTTPException(status_code=404, detail="Not found")`
    );
    lines.push(`        return {"deleted": result.rowcount}`);
    lines.push(`    except Exception as e:`);
    lines.push(`        raise HTTPException(status_code=500, detail=str(e))`);
  }

  return lines.join("\n");
}

// ------------------ Java / Spring Boot ------------------
function backendJavaSpringSnippet(
  tableSchema,
  tableName,
  method,
  idCol,
  fkCols,
  endpoint
) {
  const safeTable = sanitizeIdent(tableName);
  const lines = [];
  const path = endpoint.path;

  const pathParts = path.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const isNestedChild = lastPart !== safeTable && method === "GET";
  const isDetail = path.includes(`/:${idCol}`) && !isNestedChild;

  const javaMethod = method.toLowerCase();
  lines.push(`// ${method} ${safeTable}`);
  lines.push(
    `@${
      javaMethod === "get" ? "GetMapping" : capitalize(javaMethod)
    }("${path.replace(/:\w+/g, "{id}")}")`
  );
  lines.push(
    `public ResponseEntity<?> ${javaMethod}${capitalize(safeTable)}(${
      isDetail ? "@PathVariable Long " + idCol : ""
    }${
      isNestedChild
        ? ", " + fkCols.map((fk) => `@PathVariable Long ${fk}`).join(", ")
        : ""
    }) {`
  );
  lines.push(`    try {`);

  if (method === "GET") {
    if (!isDetail && !isNestedChild) {
      lines.push(
        `        List<${safeTable}> list = ${safeTable}Repository.findAll();`
      );
      lines.push(`        return ResponseEntity.ok(list);`);
    } else if (isNestedChild) {
      lines.push(
        `        List<${safeTable}> list = ${safeTable}Repository.findBy${fkCols
          .map((fk) => capitalize(fk))
          .join("And")}(${fkCols.join(", ")});`
      );
      lines.push(`        return ResponseEntity.ok(list);`);
    } else {
      lines.push(
        `        Optional<${safeTable}> obj = ${safeTable}Repository.findById(${idCol});`
      );
      lines.push(
        `        if (!obj.isPresent()) return ResponseEntity.status(404).body("Not found");`
      );
      lines.push(`        return ResponseEntity.ok(obj.get());`);
    }
  }

  if (method === "POST")
    lines.push(
      `        ${safeTable} saved = ${safeTable}Repository.save(body); return ResponseEntity.status(201).body(saved);`
    );
  if (method === "PUT")
    lines.push(
      `        ${safeTable} updated = ${safeTable}Repository.save(body); return ResponseEntity.ok(updated);`
    );
  if (method === "DELETE")
    lines.push(
      `        ${safeTable}Repository.deleteById(${idCol}); return ResponseEntity.ok(Map.of("deleted", ${idCol}));`
    );

  lines.push(
    `    } catch (Exception e) { return ResponseEntity.status(500).body(e.getMessage()); }`
  );
  lines.push(`}`);

  return lines.join("\n");
}

// ------------------ Go / Gin ------------------
function backendGoGinSnippet(
  tableSchema,
  tableName,
  method,
  idCol,
  fkCols,
  endpoint
) {
  const safeTable = sanitizeIdent(tableName);
  const lines = [];
  const path = endpoint.path;

  const pathParts = path.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const isNestedChild = lastPart !== safeTable && method === "GET";
  const isDetail = path.includes(`/:${idCol}`) && !isNestedChild;

  lines.push(`// ${method} ${safeTable}`);
  lines.push(
    `router.${method.toUpperCase()}("${path}", func(c *gin.Context) {`
  );
  lines.push(`    db := GetDB()`);

  if (method === "GET") {
    if (!isDetail && !isNestedChild) {
      lines.push(`    var rows []${safeTable}`);
      lines.push(
        `    if err := db.Find(&rows).Error; err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }`
      );
      lines.push(`    c.JSON(200, rows)`);
    } else if (isNestedChild) {
      const filters = fkCols.filter((fk) => path.includes(`/:${fk}`));
      lines.push(`    var rows []${safeTable}`);
      if (filters.length) {
        lines.push(
          `    if err := db.Where("${filters
            .map((fk) => fk + " = ?")
            .join(" AND ")}", ${filters.join(
            ", "
          )}).Find(&rows).Error; err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }`
        );
      } else {
        lines.push(
          `    if err := db.Find(&rows).Error; err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }`
        );
      }
      lines.push(`    c.JSON(200, rows)`);
    } else {
      lines.push(`    id := c.Param("${idCol}")`);
      lines.push(`    var obj ${safeTable}`);
      lines.push(
        `    if err := db.First(&obj, id).Error; err != nil { c.JSON(404, gin.H{"error": "Not found"}); return }`
      );
      lines.push(`    c.JSON(200, obj)`);
    }
  }

  if (method === "POST")
    lines.push(
      `    var body ${safeTable}; if err := c.BindJSON(&body); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }; db.Create(&body); c.JSON(201, body)`
    );
  if (method === "PUT")
    lines.push(
      `    id := c.Param("${idCol}"); var body ${safeTable}; c.BindJSON(&body); db.Model(&body).Where("${idCol} = ?", id).Updates(body); c.JSON(200, body)`
    );
  if (method === "DELETE")
    lines.push(
      `    id := c.Param("${idCol}"); db.Delete(&${safeTable}{}, id); c.JSON(200, gin.H{"deleted": id})`
    );

  lines.push(`})`);

  return lines.join("\n");
}

// ------------------ Helpers ------------------
function sanitizeIdent(name) {
  return String(name || "").replace(/[^A-Za-z0-9_]/g, "_");
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
