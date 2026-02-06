# TaskFlow API - Claude Context

This document provides additional context for Claude Code when working with this project.

## Project Overview

TaskFlow API is a production-ready task management system built with Node.js and Express. It demonstrates best practices for building scalable REST APIs with real-time capabilities.

## Architecture Decisions

### Authentication Strategy
We use JWT tokens with a dual-token system:
- **Access tokens** (short-lived, 7 days): Used for API requests
- **Refresh tokens** (long-lived, 30 days): Used to obtain new access tokens

This approach balances security with user experience.

### Caching Strategy
Redis is used strategically for:
- **User task lists**: Cached with 5-minute TTL to reduce database load
- **Task queries**: Cache key includes filters to ensure correct results
- **Cache invalidation**: Explicit invalidation on create/update/delete operations

### Database Schema

#### Users Table
```sql
id: UUID (primary key)
email: VARCHAR(255) UNIQUE
password: VARCHAR(255) (bcrypt hashed)
first_name: VARCHAR(100)
last_name: VARCHAR(100)
created_at: TIMESTAMP
last_login: TIMESTAMP
```

#### Tasks Table
```sql
id: UUID (primary key)
title: VARCHAR(255)
description: TEXT
priority: ENUM('low', 'medium', 'high', 'urgent')
status: ENUM('todo', 'in_progress', 'completed', 'archived')
due_date: TIMESTAMP
tags: VARCHAR[] (array)
created_by: UUID (foreign key -> users.id)
assigned_to: UUID (foreign key -> users.id)
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

## Key Design Patterns

### Controller Pattern
Each controller is a singleton class that handles related endpoints. This keeps code organized and makes testing easier.

### Repository Pattern
Models act as repositories, encapsulating all database queries. This separates data access logic from business logic.

### Middleware Chain
Authentication middleware validates tokens and attaches user data to requests, making it available in all protected routes.

## Common Development Tasks

### Adding a New Endpoint
1. Create/update controller in `src/controllers/`
2. Add route in appropriate file under `src/routes/`
3. Add authentication middleware if needed
4. Update cache invalidation logic if relevant
5. Add tests in corresponding test file

### Adding Database Migrations
Run migrations with:
```bash
npm run migrate
```

### Testing WebSocket Connections
Use the following pattern to test WebSocket functionality:
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000', {
  auth: { token: 'valid_jwt_token' }
});

socket.on('connect', () => {
  console.log('Connected');
});

socket.on('task:created', (data) => {
  console.log('New task:', data);
});
```

## Performance Considerations

### Query Optimization
- All task queries include proper indexes on `created_by`, `assigned_to`, `status`, and `priority`
- Pagination is enforced on list endpoints to prevent large result sets
- Use `ILIKE` for case-insensitive search (consider full-text search for production)

### Caching Best Practices
- Always include relevant filters in cache keys
- Set appropriate TTLs based on data volatility
- Invalidate caches on mutations
- Consider cache warming for frequently accessed data

## Security Notes

### Password Requirements
Enforced in validators:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Token Security
- Tokens are signed with HS256 algorithm
- Store JWT_SECRET securely (use environment variables)
- Rotate secrets periodically in production
- Implement token blacklisting for logout (future enhancement)

## Known Limitations

1. **No email verification**: Users can register without email confirmation
2. **No password reset**: Password recovery not implemented
3. **No file attachments**: Tasks don't support file uploads
4. **Single workspace**: Users can't create separate workspaces
5. **No team features**: No team/organization support

## Future Enhancements

- Task comments and activity logs
- File attachments support
- Team workspaces
- Task templates
- Recurring tasks
- Email notifications
- Two-factor authentication
- Audit logs

## Debugging Tips

### Common Issues

**Database connection fails**
- Check PostgreSQL is running
- Verify credentials in `.env`
- Ensure database exists

**Redis connection fails**
- Check Redis is running
- Verify Redis host/port in config
- Check Redis password if configured

**WebSocket authentication fails**
- Ensure token is passed in `auth` object
- Verify token hasn't expired
- Check JWT_SECRET matches

### Logging
Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console - In development mode

Set log level with `LOG_LEVEL` environment variable.

## Testing Strategy

### Unit Tests
- Test individual functions in isolation
- Mock external dependencies (database, Redis)
- Focus on business logic

### Integration Tests
- Test API endpoints with real database
- Use test database separate from development
- Test authentication flows

### WebSocket Tests
- Test connection/disconnection
- Test event emission
- Test authentication

## Code Style

- Use async/await for asynchronous operations
- Prefer const over let
- Use descriptive variable names
- Comment complex business logic
- Handle errors at controller level
- Log important events and errors

## Dependencies Overview

**Production**
- `express`: Web framework
- `jsonwebtoken`: JWT authentication
- `bcryptjs`: Password hashing
- `pg`: PostgreSQL client
- `redis`: Redis client
- `socket.io`: WebSocket support
- `winston`: Logging
- `joi`: Validation

**Development**
- `jest`: Testing framework
- `supertest`: HTTP testing
- `nodemon`: Auto-restart server
- `eslint`: Code linting
