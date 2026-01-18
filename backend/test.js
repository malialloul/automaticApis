#!/usr/bin/env node

/**
 * Backend validation script
 * Tests core functionality without requiring a live database
 */

const QueryBuilder = require('./src/middleware/queryBuilder');
const SwaggerGenerator = require('./src/middleware/swaggerGenerator');

console.log('🧪 Testing Automatic APIs Backend...\n');

// Mock schema for testing
const mockSchema = {
  users: {
    name: 'users',
    columns: [
      { name: 'id', type: 'integer', nullable: false, default: "nextval('users_id_seq'::regclass)" },
      { name: 'name', type: 'character varying', nullable: false, maxLength: 100 },
      { name: 'email', type: 'character varying', nullable: false, maxLength: 100 },
      { name: 'created_at', type: 'timestamp without time zone', nullable: true, default: 'now()' },
    ],
    primaryKeys: ['id'],
    foreignKeys: [],
    reverseForeignKeys: [
      { referencingTable: 'posts', referencingColumn: 'user_id', referencedColumn: 'id' }
    ],
  },
  posts: {
    name: 'posts',
    columns: [
      { name: 'id', type: 'integer', nullable: false, default: "nextval('posts_id_seq'::regclass)" },
      { name: 'user_id', type: 'integer', nullable: true },
      { name: 'title', type: 'character varying', nullable: false, maxLength: 200 },
      { name: 'content', type: 'text', nullable: true },
      { name: 'published', type: 'boolean', nullable: true, default: 'false' },
    ],
    primaryKeys: ['id'],
    foreignKeys: [
      { columnName: 'user_id', foreignTable: 'users', foreignColumn: 'id' }
    ],
    reverseForeignKeys: [],
  },
};

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Test QueryBuilder
console.log('Testing QueryBuilder...');

test('QueryBuilder - Build SELECT query', () => {
  const qb = new QueryBuilder('users', mockSchema.users);
  const query = qb.buildSelect({ limit: 10, offset: 0 });
  if (!query.text.includes('SELECT * FROM "users"')) throw new Error('Invalid SELECT query');
  if (!query.text.includes('LIMIT')) throw new Error('Missing LIMIT');
});

test('QueryBuilder - Build SELECT with filters', () => {
  const qb = new QueryBuilder('users', mockSchema.users);
  const query = qb.buildSelect({ filters: { name: 'John' } });
  if (!query.text.includes('WHERE')) throw new Error('Missing WHERE clause');
  if (query.values[0] !== 'John') throw new Error('Filter value not parameterized');
});

test('QueryBuilder - Build SELECT by ID', () => {
  const qb = new QueryBuilder('users', mockSchema.users);
  const query = qb.buildSelectById(1);
  if (!query.text.includes('WHERE "id" = $1')) throw new Error('Invalid WHERE clause');
  if (query.values[0] !== 1) throw new Error('ID not parameterized');
});

test('QueryBuilder - Build INSERT query', () => {
  const qb = new QueryBuilder('users', mockSchema.users);
  const query = qb.buildInsert({ name: 'John', email: 'john@example.com' });
  if (!query.text.includes('INSERT INTO "users"')) throw new Error('Invalid INSERT query');
  if (!query.text.includes('RETURNING *')) throw new Error('Missing RETURNING clause');
  if (query.values.length !== 2) throw new Error('Incorrect number of parameters');
});

test('QueryBuilder - Build UPDATE query', () => {
  const qb = new QueryBuilder('users', mockSchema.users);
  const query = qb.buildUpdate(1, { name: 'Jane' });
  if (!query.text.includes('UPDATE "users" SET')) throw new Error('Invalid UPDATE query');
  if (!query.text.includes('WHERE "id" = $2')) throw new Error('Missing WHERE clause');
  if (query.values[1] !== 1) throw new Error('ID not parameterized correctly');
});

test('QueryBuilder - Build DELETE query', () => {
  const qb = new QueryBuilder('users', mockSchema.users);
  const query = qb.buildDelete(1);
  if (!query.text.includes('DELETE FROM "users"')) throw new Error('Invalid DELETE query');
  if (!query.text.includes('WHERE "id" = $1')) throw new Error('Missing WHERE clause');
});

test('QueryBuilder - SQL injection prevention', () => {
  const qb = new QueryBuilder('users', mockSchema.users);
  try {
    qb.sanitizeIdentifier('users; DROP TABLE users--');
    throw new Error('Should have thrown error for invalid identifier');
  } catch (e) {
    if (!e.message.includes('Invalid identifier')) throw e;
  }
});

test('QueryBuilder - Build relationship query (has-many)', () => {
  const qb = new QueryBuilder('users', mockSchema.users);
  const query = qb.buildRelatedQuery('posts', 1);
  if (!query.text.includes('SELECT * FROM "posts"')) throw new Error('Invalid related query');
  if (!query.text.includes('WHERE "user_id" = $1')) throw new Error('Missing FK condition');
});

test('QueryBuilder - Build relationship query (belongs-to)', () => {
  const qb = new QueryBuilder('posts', mockSchema.posts);
  const query = qb.buildRelatedQuery('users', 1);
  if (!query.text.includes('SELECT * FROM "users"')) throw new Error('Invalid related query');
});

// Test SwaggerGenerator
console.log('\nTesting SwaggerGenerator...');

test('SwaggerGenerator - Generate OpenAPI spec', () => {
  const sg = new SwaggerGenerator('testdb', mockSchema);
  const spec = sg.generate();
  if (spec.openapi !== '3.0.0') throw new Error('Invalid OpenAPI version');
  if (!spec.paths) throw new Error('Missing paths');
  if (!spec.components.schemas) throw new Error('Missing schemas');
});

test('SwaggerGenerator - Generate table schemas', () => {
  const sg = new SwaggerGenerator('testdb', mockSchema);
  const spec = sg.generate();
  if (!spec.components.schemas.Users) throw new Error('Missing Users schema');
  if (!spec.components.schemas.Posts) throw new Error('Missing Posts schema');
});

test('SwaggerGenerator - Generate CRUD endpoints', () => {
  const sg = new SwaggerGenerator('testdb', mockSchema);
  const spec = sg.generate();
  const basePath = '/testdb/users';
  if (!spec.paths[basePath]) throw new Error('Missing base path');
  if (!spec.paths[basePath].get) throw new Error('Missing GET endpoint');
  if (!spec.paths[basePath].post) throw new Error('Missing POST endpoint');
  if (!spec.paths[`${basePath}/{id}`].put) throw new Error('Missing PUT endpoint');
  if (!spec.paths[`${basePath}/{id}`].delete) throw new Error('Missing DELETE endpoint');
});

test('SwaggerGenerator - Generate relationship endpoints', () => {
  const sg = new SwaggerGenerator('testdb', mockSchema);
  const spec = sg.generate();
  const relationPath = '/testdb/users/{id}/posts';
  if (!spec.paths[relationPath]) throw new Error('Missing relationship endpoint');
  if (!spec.paths[relationPath].get) throw new Error('Missing relationship GET');
});

test('SwaggerGenerator - Map PostgreSQL types to Swagger types', () => {
  const sg = new SwaggerGenerator('testdb', mockSchema);
  const intType = sg.mapColumnToSwaggerType({ type: 'integer' });
  if (intType.type !== 'integer') throw new Error('Invalid integer mapping');
  
  const stringType = sg.mapColumnToSwaggerType({ type: 'character varying', maxLength: 100 });
  if (stringType.type !== 'string') throw new Error('Invalid string mapping');
  if (stringType.maxLength !== 100) throw new Error('Missing maxLength');
  
  const boolType = sg.mapColumnToSwaggerType({ type: 'boolean' });
  if (boolType.type !== 'boolean') throw new Error('Invalid boolean mapping');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log('='.repeat(50));

if (testsFailed > 0) {
  console.log('\n❌ Some tests failed');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
