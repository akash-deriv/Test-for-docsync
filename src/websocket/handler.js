const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

let io;

function setupWebSocket(socketIO) {
  io = socketIO;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.userId}`);

    socket.join(`user:${socket.userId}`);

    socket.on('subscribe:task', (taskId) => {
      socket.join(`task:${taskId}`);
      logger.debug(`User ${socket.userId} subscribed to task ${taskId}`);
    });

    socket.on('unsubscribe:task', (taskId) => {
      socket.leave(`task:${taskId}`);
      logger.debug(`User ${socket.userId} unsubscribed from task ${taskId}`);
    });

    socket.on('subscribe:comments', (taskId) => {
      socket.join(`task:${taskId}:comments`);
      logger.debug(`User ${socket.userId} subscribed to comments on task ${taskId}`);
    });

    socket.on('unsubscribe:comments', (taskId) => {
      socket.leave(`task:${taskId}:comments`);
      logger.debug(`User ${socket.userId} unsubscribed from comments on task ${taskId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.userId}`);
    });
  });
}

function emitTaskUpdate(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

function emitCommentUpdate(event, data) {
  if (io && data.taskId) {
    io.to(`task:${data.taskId}:comments`).emit(event, data);
  }
}

function emitToTask(taskId, event, data) {
  if (io) {
    io.to(`task:${taskId}`).emit(event, data);
  }
}

module.exports = {
  setupWebSocket,
  emitTaskUpdate,
  emitToUser,
  emitCommentUpdate,
  emitToTask,
};
