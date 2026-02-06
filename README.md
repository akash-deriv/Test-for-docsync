# TaskFlow API

A comprehensive RESTful API for task management with real-time updates, authentication, caching, and analytics capabilities.

## Features

- **User Authentication**: Secure JWT-based authentication with refresh tokens
- **Task Management**: Full CRUD operations for tasks with filtering, search, and pagination
- **Comments & Activity Tracking**: Add comments to tasks and track activity history
- **Real-time Updates**: WebSocket support for live task updates across clients
- **Caching Layer**: Redis integration for improved performance
- **Analytics**: Track task completion rates, productivity metrics, and user statistics
- **Rate Limiting**: Protect API endpoints from abuse
- **Comprehensive Logging**: Winston-based logging for debugging and monitoring
- **Input Validation**: Joi schemas for request validation
- **Database**: PostgreSQL for reliable data persistence

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **WebSockets**: Socket.io
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Logging**: Winston
- **Testing**: Jest & Supertest

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v13 or higher)
- Redis (v6 or higher)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```env
   PORT=3000
   NODE_ENV=development

   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=taskflow
   DB_USER=postgres
   DB_PASSWORD=your_password

   REDIS_HOST=localhost
   REDIS_PORT=6379

   JWT_SECRET=your_jwt_secret
   JWT_REFRESH_SECRET=your_refresh_secret
   ```

4. Run database migrations:
   ```bash
   npm run migrate
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token

### Tasks
- `GET /api/tasks` - Get all tasks (with filters)
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Comments & Activity
- `POST /api/tasks/:taskId/comments` - Create comment
- `GET /api/tasks/:taskId/comments` - Get task comments
- `GET /api/tasks/:taskId/activity` - Get task activity log
- `PUT /api/tasks/:taskId/comments/:commentId` - Update comment
- `DELETE /api/tasks/:taskId/comments/:commentId` - Delete comment

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/stats` - Get user statistics

### Analytics
- `GET /api/analytics/overview` - Get task analytics overview
- `GET /api/analytics/productivity` - Get productivity metrics
- `GET /api/analytics/trends` - Get task completion trends

## WebSocket Events

Connect to WebSocket with authentication token:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your_jwt_token' }
});
```

### Events
- `task:created` - Emitted when a new task is created
- `task:updated` - Emitted when a task is updated
- `task:deleted` - Emitted when a task is deleted
- `comment:created` - Emitted when a new comment is added
- `comment:updated` - Emitted when a comment is updated
- `comment:deleted` - Emitted when a comment is deleted

### Subscribing to Real-time Updates
```javascript
// Subscribe to task updates
socket.emit('subscribe:task', taskId);

// Subscribe to comment updates
socket.emit('subscribe:comments', taskId);

// Unsubscribe when no longer needed
socket.emit('unsubscribe:task', taskId);
socket.emit('unsubscribe:comments', taskId);
```

## Testing

Run tests with coverage:
```bash
npm test
```

## Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Request handlers
├── models/          # Database models
├── routes/          # API routes
├── middleware/      # Custom middleware
├── utils/           # Utility functions
├── database/        # Database connection and migrations
├── cache/           # Redis cache management
├── websocket/       # WebSocket handlers
└── index.js         # Application entry point
```

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Input validation and sanitization
- SQL injection prevention
- Rate limiting
- CORS configuration

## Performance Optimizations

- Redis caching for frequently accessed data
- Database connection pooling
- Efficient query pagination
- WebSocket for reduced polling overhead

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License
