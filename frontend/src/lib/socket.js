import { io } from "socket.io-client";
import { getApiOrigin } from "./apiBase";

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(getApiOrigin(), {
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 300,
      reconnectionDelayMax: 1500,
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
