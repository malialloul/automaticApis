-- =====================================================
-- Automatic APIs - Full PostgreSQL Database Schema
-- =====================================================
-- This schema represents the complete data model for the
-- Automatic APIs application - a PostgreSQL to REST API Generator
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- Database connection types supported
CREATE TYPE db_connection_type AS ENUM (
    'postgres',
    'mysql',
    'mongodb',
    'mssql',
    'oracle',
    'local'
);

-- Connection status
CREATE TYPE connection_status AS ENUM (
    'active',
    'inactive',
    'error',
    'testing'
);

-- Endpoint HTTP methods
CREATE TYPE http_method AS ENUM (
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE'
);

-- Join types for query builder
CREATE TYPE join_type AS ENUM (
    'INNER',
    'LEFT',
    'RIGHT',
    'FULL',
    'CROSS'
);

-- Aggregation functions
CREATE TYPE aggregation_function AS ENUM (
    'COUNT',
    'SUM',
    'AVG',
    'MIN',
    'MAX',
    'ARRAY_AGG',
    'STRING_AGG'
);

-- SQL comparison operators
CREATE TYPE comparison_operator AS ENUM (
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'in',
    'not_in',
    'is_null',
    'is_not_null',
    'between'
);

-- Foreign key actions
CREATE TYPE fk_action AS ENUM (
    'NO ACTION',
    'RESTRICT',
    'CASCADE',
    'SET NULL',
    'SET DEFAULT'
);

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users table (for future authentication/authorization)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Database connections
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type db_connection_type NOT NULL DEFAULT 'postgres',
    host VARCHAR(255),
    port INTEGER,
    database_name VARCHAR(255),
    username VARCHAR(255),
    password_encrypted TEXT, -- Encrypted connection password
    uri TEXT, -- For MongoDB connection strings
    use_ssl BOOLEAN DEFAULT false,
    ssl_certificate TEXT,
    connection_options JSONB DEFAULT '{}',
    status connection_status DEFAULT 'inactive',
    last_tested_at TIMESTAMPTZ,
    last_introspected_at TIMESTAMPTZ,
    is_local BOOLEAN DEFAULT false, -- For Schema Builder local databases
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_connection_host_or_uri CHECK (
        (type = 'mongodb' AND (uri IS NOT NULL OR host IS NOT NULL)) OR
        (type != 'mongodb' AND host IS NOT NULL)
    )
);

-- Create index for faster user connection lookups
CREATE INDEX idx_connections_user_id ON connections(user_id);
CREATE INDEX idx_connections_type ON connections(type);
CREATE INDEX idx_connections_status ON connections(status);

-- =====================================================
-- SCHEMA INTROSPECTION TABLES
-- =====================================================

-- Cached database schemas (introspected tables)
CREATE TABLE schema_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    table_name VARCHAR(255) NOT NULL,
    table_schema VARCHAR(255) DEFAULT 'public',
    table_type VARCHAR(50) DEFAULT 'BASE TABLE',
    estimated_row_count BIGINT,
    table_size_bytes BIGINT,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_schema_tables_connection_table UNIQUE (connection_id, table_schema, table_name)
);

CREATE INDEX idx_schema_tables_connection ON schema_tables(connection_id);

-- Cached table columns
CREATE TABLE schema_columns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
    column_name VARCHAR(255) NOT NULL,
    data_type VARCHAR(100) NOT NULL,
    udt_name VARCHAR(100), -- User-defined type name (for enums)
    is_nullable BOOLEAN DEFAULT true,
    column_default TEXT,
    character_maximum_length INTEGER,
    numeric_precision INTEGER,
    numeric_scale INTEGER,
    is_primary_key BOOLEAN DEFAULT false,
    is_auto_increment BOOLEAN DEFAULT false,
    is_unique BOOLEAN DEFAULT false,
    ordinal_position INTEGER NOT NULL,
    enum_values TEXT[], -- For enum types
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_schema_columns_table_column UNIQUE (table_id, column_name)
);

CREATE INDEX idx_schema_columns_table ON schema_columns(table_id);
CREATE INDEX idx_schema_columns_is_pk ON schema_columns(is_primary_key) WHERE is_primary_key = true;

-- Primary key definitions (composite keys support)
CREATE TABLE schema_primary_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES schema_columns(id) ON DELETE CASCADE,
    constraint_name VARCHAR(255),
    ordinal_position INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_schema_pk_table_column UNIQUE (table_id, column_id)
);

-- Foreign key relationships
CREATE TABLE schema_foreign_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES schema_columns(id) ON DELETE CASCADE,
    constraint_name VARCHAR(255),
    foreign_table_id UUID REFERENCES schema_tables(id) ON DELETE SET NULL,
    foreign_table_name VARCHAR(255) NOT NULL,
    foreign_column_name VARCHAR(255) NOT NULL,
    on_delete fk_action DEFAULT 'NO ACTION',
    on_update fk_action DEFAULT 'NO ACTION',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schema_fk_table ON schema_foreign_keys(table_id);
CREATE INDEX idx_schema_fk_foreign_table ON schema_foreign_keys(foreign_table_id);

-- Table indexes
CREATE TABLE schema_indexes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
    index_name VARCHAR(255) NOT NULL,
    is_unique BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT false,
    index_type VARCHAR(50) DEFAULT 'btree',
    column_names TEXT[] NOT NULL,
    index_definition TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schema_indexes_table ON schema_indexes(table_id);

-- =====================================================
-- ENDPOINT BUILDER TABLES
-- =====================================================

-- Custom API endpoints (from Visual Builder)
CREATE TABLE endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    description TEXT,
    method http_method NOT NULL DEFAULT 'GET',
    path VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    version VARCHAR(20) DEFAULT 'v1',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_endpoints_slug UNIQUE (slug),
    CONSTRAINT chk_endpoints_slug_format CHECK (slug ~ '^[a-z0-9-]{1,80}$')
);

CREATE INDEX idx_endpoints_connection ON endpoints(connection_id);
CREATE INDEX idx_endpoints_user ON endpoints(user_id);
CREATE INDEX idx_endpoints_method ON endpoints(method);
CREATE INDEX idx_endpoints_slug ON endpoints(slug);

-- Endpoint query graph (visual builder structure)
CREATE TABLE endpoint_graphs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    source_table_id UUID REFERENCES schema_tables(id) ON DELETE SET NULL,
    source_table_name VARCHAR(255) NOT NULL,
    output_fields JSONB DEFAULT '{}', -- { tableName: ['field1', 'field2', '*'] }
    filters JSONB DEFAULT '[]', -- Array of filter conditions
    group_by TEXT[] DEFAULT '{}',
    having JSONB DEFAULT '[]',
    order_by JSONB DEFAULT '[]',
    limit_value INTEGER,
    offset_value INTEGER,
    distinct_on TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_endpoint_graphs_endpoint ON endpoint_graphs(endpoint_id);

-- Endpoint join definitions
CREATE TABLE endpoint_joins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    graph_id UUID NOT NULL REFERENCES endpoint_graphs(id) ON DELETE CASCADE,
    join_type join_type NOT NULL DEFAULT 'LEFT',
    from_table VARCHAR(255) NOT NULL,
    from_field VARCHAR(255) NOT NULL,
    to_table VARCHAR(255) NOT NULL,
    to_field VARCHAR(255) NOT NULL,
    alias VARCHAR(100),
    join_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_endpoint_joins_graph ON endpoint_joins(graph_id);

-- Endpoint filters/conditions
CREATE TABLE endpoint_filters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    graph_id UUID NOT NULL REFERENCES endpoint_graphs(id) ON DELETE CASCADE,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    operator comparison_operator NOT NULL,
    value TEXT,
    value_type VARCHAR(50) DEFAULT 'static', -- 'static', 'parameter', 'variable'
    parameter_name VARCHAR(100), -- For dynamic parameters
    is_or BOOLEAN DEFAULT false, -- AND vs OR
    filter_group INTEGER DEFAULT 0,
    filter_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_endpoint_filters_graph ON endpoint_filters(graph_id);

-- Endpoint aggregations
CREATE TABLE endpoint_aggregations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    graph_id UUID NOT NULL REFERENCES endpoint_graphs(id) ON DELETE CASCADE,
    function_name aggregation_function NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    alias VARCHAR(100),
    distinct_values BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_endpoint_aggregations_graph ON endpoint_aggregations(graph_id);

-- Endpoint parameters (input validation)
CREATE TABLE endpoint_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(20) NOT NULL DEFAULT 'query', -- 'query', 'path', 'header', 'body'
    data_type VARCHAR(50) NOT NULL DEFAULT 'string',
    is_required BOOLEAN DEFAULT false,
    default_value TEXT,
    description TEXT,
    validation_pattern VARCHAR(500),
    enum_values TEXT[],
    min_value NUMERIC,
    max_value NUMERIC,
    min_length INTEGER,
    max_length INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_endpoint_params UNIQUE (endpoint_id, name, location)
);

CREATE INDEX idx_endpoint_params_endpoint ON endpoint_parameters(endpoint_id);

-- =====================================================
-- LOCAL DATABASE STORAGE (Schema Builder)
-- =====================================================

-- Local database data storage (for Schema Builder virtual databases)
CREATE TABLE local_database_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    table_name VARCHAR(255) NOT NULL,
    row_data JSONB NOT NULL,
    row_order SERIAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_local_data_connection_table ON local_database_data(connection_id, table_name);
CREATE INDEX idx_local_data_row_data ON local_database_data USING GIN(row_data);

-- =====================================================
-- API EXECUTION & LOGGING
-- =====================================================

-- API request logs
CREATE TABLE api_request_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
    endpoint_id UUID REFERENCES endpoints(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    method http_method NOT NULL,
    path VARCHAR(1000) NOT NULL,
    query_params JSONB,
    request_body JSONB,
    response_status INTEGER,
    response_body_preview TEXT, -- First N characters of response
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_logs_connection ON api_request_logs(connection_id);
CREATE INDEX idx_api_logs_endpoint ON api_request_logs(endpoint_id);
CREATE INDEX idx_api_logs_created ON api_request_logs(created_at DESC);
CREATE INDEX idx_api_logs_status ON api_request_logs(response_status);

-- Query execution history
CREATE TABLE query_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    query_params JSONB,
    execution_time_ms INTEGER,
    rows_affected INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_query_history_connection ON query_history(connection_id);
CREATE INDEX idx_query_history_created ON query_history(created_at DESC);

-- =====================================================
-- SETTINGS & CONFIGURATION
-- =====================================================

-- Application settings
CREATE TABLE app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_app_settings UNIQUE (user_id, setting_key)
);

-- Connection-specific settings
CREATE TABLE connection_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_connection_settings UNIQUE (connection_id, setting_key)
);

CREATE INDEX idx_connection_settings ON connection_settings(connection_id);

-- =====================================================
-- SWAGGER/OPENAPI CACHE
-- =====================================================

-- Generated OpenAPI specifications cache
CREATE TABLE swagger_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    spec_version VARCHAR(20) DEFAULT '3.0.0',
    specification JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    CONSTRAINT uq_swagger_cache_connection UNIQUE (connection_id)
);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER tr_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_connections_updated_at
    BEFORE UPDATE ON connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_schema_tables_updated_at
    BEFORE UPDATE ON schema_tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_schema_columns_updated_at
    BEFORE UPDATE ON schema_columns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_schema_foreign_keys_updated_at
    BEFORE UPDATE ON schema_foreign_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_endpoints_updated_at
    BEFORE UPDATE ON endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_endpoint_graphs_updated_at
    BEFORE UPDATE ON endpoint_graphs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_local_database_data_updated_at
    BEFORE UPDATE ON local_database_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_connection_settings_updated_at
    BEFORE UPDATE ON connection_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS
-- =====================================================

-- View: Connection statistics
CREATE OR REPLACE VIEW v_connection_stats AS
SELECT 
    c.id AS connection_id,
    c.name AS connection_name,
    c.type AS connection_type,
    c.status,
    COUNT(DISTINCT st.id) AS table_count,
    COUNT(DISTINCT sc.id) AS column_count,
    COUNT(DISTINCT sfk.id) AS relationship_count,
    COUNT(DISTINCT e.id) AS endpoint_count,
    c.last_introspected_at,
    c.created_at
FROM connections c
LEFT JOIN schema_tables st ON st.connection_id = c.id
LEFT JOIN schema_columns sc ON sc.table_id = st.id
LEFT JOIN schema_foreign_keys sfk ON sfk.table_id = st.id
LEFT JOIN endpoints e ON e.connection_id = c.id
GROUP BY c.id, c.name, c.type, c.status, c.last_introspected_at, c.created_at;

-- View: Table details with column count
CREATE OR REPLACE VIEW v_table_details AS
SELECT 
    st.id AS table_id,
    st.connection_id,
    st.table_name,
    st.table_schema,
    COUNT(sc.id) AS column_count,
    COUNT(sc.id) FILTER (WHERE sc.is_primary_key) AS pk_count,
    COUNT(sfk.id) AS fk_count,
    st.estimated_row_count,
    st.created_at
FROM schema_tables st
LEFT JOIN schema_columns sc ON sc.table_id = st.id
LEFT JOIN schema_foreign_keys sfk ON sfk.table_id = st.id
GROUP BY st.id, st.connection_id, st.table_name, st.table_schema, st.estimated_row_count, st.created_at;

-- View: API usage statistics
CREATE OR REPLACE VIEW v_api_usage_stats AS
SELECT 
    connection_id,
    endpoint_id,
    method,
    DATE_TRUNC('hour', created_at) AS hour,
    COUNT(*) AS request_count,
    AVG(response_time_ms) AS avg_response_time_ms,
    COUNT(*) FILTER (WHERE response_status >= 400) AS error_count
FROM api_request_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY connection_id, endpoint_id, method, DATE_TRUNC('hour', created_at);

-- =====================================================
-- SAMPLE DATA (Optional - for development/testing)
-- =====================================================

-- Insert a default admin user (password: 'admin123' - should be changed)
-- INSERT INTO users (email, password_hash, name, is_admin)
-- VALUES ('admin@automaticapis.local', crypt('admin123', gen_salt('bf')), 'Administrator', true);

-- =====================================================
-- GRANTS (adjust as needed for your setup)
-- =====================================================

-- Example: Create an application role
-- CREATE ROLE automaticapis_app WITH LOGIN PASSWORD 'secure_password';
-- GRANT USAGE ON SCHEMA public TO automaticapis_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO automaticapis_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO automaticapis_app;

COMMENT ON TABLE users IS 'Application users for authentication and authorization';
COMMENT ON TABLE connections IS 'Database connection configurations';
COMMENT ON TABLE schema_tables IS 'Cached introspected database tables';
COMMENT ON TABLE schema_columns IS 'Cached introspected table columns';
COMMENT ON TABLE schema_foreign_keys IS 'Cached foreign key relationships';
COMMENT ON TABLE endpoints IS 'Custom API endpoints created via visual builder';
COMMENT ON TABLE endpoint_graphs IS 'Visual query builder graph structure';
COMMENT ON TABLE local_database_data IS 'Data storage for Schema Builder local databases';
COMMENT ON TABLE api_request_logs IS 'API request logging for analytics';
COMMENT ON TABLE swagger_cache IS 'Cached OpenAPI specifications';
