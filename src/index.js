const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const config = require('./config');
const logger = require('./utils/logger');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const { errorHandler } = require('./middleware/errorHandler');
const { connectDatabase } = require('./database/connection');
const { initializeRedis } = require('./cache/redis');
const { setupWebSocket } = require('./websocket/handler');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handling
app.use(errorHandler);

// WebSocket setup
setupWebSocket(io);

const PORT = config.port || 3000;

async function startServer() {
  try {
    await connectDatabase();
    await initializeRedis();

    server.listen(PORT, () => {
      logger.info(`TaskFlow API running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
