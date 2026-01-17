# Contributing to Automatic APIs

Thank you for your interest in contributing to Automatic APIs! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**When submitting a bug report, include:**
- Clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment details (OS, Node.js version, PostgreSQL version)
- Error messages and stack traces

### Suggesting Features

Feature requests are welcome! Please:
- Use a clear and descriptive title
- Provide detailed description of the proposed feature
- Explain why this feature would be useful
- Provide examples of how it would work

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/YOUR-USERNAME/automaticApis.git
   cd automaticApis
   ```

2. **Create a branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Write clear, commented code
   - Follow existing code style
   - Add tests if applicable
   - Update documentation

4. **Test your changes**
   ```bash
   # Backend tests
   cd backend
   npm test
   
   # Frontend build
   cd ../frontend
   npm run build
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add amazing feature"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

7. **Open a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template
   - Submit!

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 12.0
- Git

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/automaticApis.git
cd automaticApis

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install --legacy-peer-deps
```

### Running Locally

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Testing

```bash
# Backend tests
cd backend
npm test

# Frontend build test
cd frontend
npm run build
```

## Code Style Guidelines

### JavaScript/JSX

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Use meaningful variable names
- Add JSDoc comments for functions
- Keep functions small and focused

**Example:**
```javascript
/**
 * Build SELECT query with filters
 * @param {object} options - Query options
 * @returns {object} Query object with text and values
 */
buildSelect(options = {}) {
  const { filters = {}, limit, offset } = options;
  // Implementation...
}
```

### React Components

- Use functional components with hooks
- One component per file
- Use descriptive component names
- Keep components focused and reusable
- Use PropTypes or TypeScript for type checking

**Example:**
```jsx
import React from 'react';

const MyComponent = ({ prop1, prop2 }) => {
  return (
    <div>
      {/* Component content */}
    </div>
  );
};

export default MyComponent;
```

### File Organization

```
src/
├── components/        # Reusable UI components
├── pages/            # Page components
├── hooks/            # Custom React hooks
├── services/         # API clients
├── utils/            # Utility functions
└── middleware/       # Express middleware
```

## Documentation

- Update README if you change functionality
- Add JSDoc comments to new functions
- Update API documentation in code
- Include examples where helpful
- Keep documentation up-to-date

## Testing Guidelines

### Backend Tests

Add tests for:
- New query builder features
- API endpoint logic
- Schema introspection changes
- Swagger generation updates

**Example:**
```javascript
test('Description of what it tests', () => {
  // Arrange
  const input = {...};
  
  // Act
  const result = functionToTest(input);
  
  // Assert
  if (result !== expected) throw new Error('Test failed');
});
```

### Frontend Testing

- Ensure components build without errors
- Test major user flows manually
- Check responsive design
- Verify API integration

## Commit Message Guidelines

Use clear, descriptive commit messages:

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

**Examples:**
```
feat: Add support for PostgreSQL views
fix: Correct SQL injection vulnerability in query builder
docs: Update installation guide with Docker instructions
refactor: Simplify connection manager logic
test: Add tests for relationship endpoint generation
```

## Areas for Contribution

We especially welcome contributions in these areas:

### Backend
- [ ] Support for database views
- [ ] Custom query capabilities
- [ ] Performance optimizations
- [ ] Support for other databases (MySQL, MongoDB)
- [ ] Authentication/authorization
- [ ] Rate limiting
- [ ] Caching strategies

### Frontend
- [ ] Improved visualizations
- [ ] Dark mode
- [ ] Accessibility improvements
- [ ] Mobile responsiveness
- [ ] Performance optimizations
- [ ] Better error handling
- [ ] Keyboard shortcuts

### Documentation
- [ ] Video tutorials
- [ ] More examples
- [ ] API recipes
- [ ] Deployment guides
- [ ] Troubleshooting tips

### Testing
- [ ] Integration tests
- [ ] E2E tests
- [ ] Performance tests
- [ ] Security tests

## Questions?

- Open an issue with the "question" label
- Check existing issues and documentation
- Be patient and respectful

## Recognition

Contributors will be recognized in:
- README contributors section
- Release notes
- Project documentation

Thank you for contributing to Automatic APIs! 🚀
