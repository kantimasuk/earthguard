import { Server } from 'socket.io';
import { firebaseAuth } from '../services/firebaseAdmin.js';
import { registerSinglePlayer } from './singlePlayer.js';

/**
 * Socket.IO — ใช้กับโหมด Single Player (ตอนนี้) และ Multiplayer (ภายหลัง)
 * client เชื่อมต่อด้วย io(URL, { auth: { token: <Firebase ID token> } })
 */
export function attachSocket(httpServer, origins) {
  const io = new Server(httpServer, { cors: { origin: origins, credentials: true } });

  io.use(async (socket, next) => {
    try {
      socket.data.user = await firebaseAuth.verifyIdToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    socket.emit('hello', { uid: socket.data.user.uid, serverTime: Date.now() });
    socket.on('ping:client', (cb) => typeof cb === 'function' && cb(Date.now()));
    registerSinglePlayer(socket);
  });

  return io;
}
