-- Example database schema for testing Automatic APIs
-- This creates a simple blog system with users, posts, and comments

-- Drop tables if they exist
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Posts table
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  published BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Comments table
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample data
INSERT INTO users (name, email, bio) VALUES
  ('John Doe', 'john@example.com', 'Software developer and blogger'),
  ('Jane Smith', 'jane@example.com', 'Tech enthusiast and writer'),
  ('Bob Johnson', 'bob@example.com', 'Database administrator');

INSERT INTO posts (user_id, title, content, published, view_count) VALUES
  (1, 'Introduction to PostgreSQL', 'PostgreSQL is a powerful open-source database...', true, 150),
  (1, 'Advanced SQL Queries', 'Learning advanced SQL techniques...', true, 89),
  (2, 'Building REST APIs', 'REST APIs are essential for modern web development...', true, 234),
  (2, 'Database Design Best Practices', 'Good database design is crucial...', false, 12),
  (3, 'PostgreSQL Performance Tuning', 'Optimizing database performance...', true, 456);

INSERT INTO comments (post_id, user_id, text) VALUES
  (1, 2, 'Great article! Very informative.'),
  (1, 3, 'Thanks for sharing this.'),
  (2, 2, 'I learned a lot from this post.'),
  (3, 1, 'Excellent explanation of REST principles.'),
  (3, 3, 'This helped me understand APIs better.'),
  (5, 1, 'Very useful performance tips!'),
  (5, 2, 'Implemented these suggestions and saw great results.');

-- Create indexes for better performance
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
