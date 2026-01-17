-- Create enum type for user roles
CREATE TYPE user_role AS ENUM ('admin', 'user', 'moderator');

-- Add role column to users table (if it doesn't exist)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user';

-- If role column exists but is wrong type, you might need to:
-- ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role;