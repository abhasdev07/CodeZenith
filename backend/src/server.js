import express from "express";
import path from "path";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { serve } from "inngest/express";
import { clerkMiddleware } from "@clerk/express";

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";

import chatRoutes from "./routes/chatRoutes.js";
import codeExecutionRoutes from "./routes/codeExecutionRoute.js";
import sessionRoutes from "./routes/sessionRoute.js";
import userRoutes from "./routes/userRoute.js";

const app = express();
const server = http.createServer(app);

const __dirname = path.resolve();

// middleware
app.use(express.json());
// credentials:true means the browser can include auth cookies/headers
const allowedOrigins = [
  ENV.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
].filter(Boolean);

const io = new Server(server, {
  cors: {
    credentials: true,
    origin: allowedOrigins,
  },
});

const getSessionRoom = (sessionId) => `session:${sessionId}`;

io.on("connection", (socket) => {
  console.log("[socket] connected", socket.id);

  socket.on("join-session", ({ sessionId, userId, role } = {}) => {
    if (!sessionId) return;

    const room = getSessionRoom(sessionId);
    socket.join(room);
    socket.data.sessionId = sessionId;
    socket.data.userId = userId;
    socket.data.role = role;

    socket.to(room).emit("participant-joined", {
      sessionId,
      userId,
      role,
      socketId: socket.id,
      timestamp: Date.now(),
    });
    console.log("[socket] joined room", { socketId: socket.id, room, userId, role });
  });

  socket.on("leave-session", ({ sessionId } = {}) => {
    if (!sessionId) return;
    socket.leave(getSessionRoom(sessionId));
  });

  socket.on("code-change", (payload = {}) => {
    if (!payload.sessionId) return;
    socket.to(getSessionRoom(payload.sessionId)).emit("code-update", payload);
  });

  socket.on("code-patch", (payload = {}) => {
    if (!payload.sessionId) return;
    socket.to(getSessionRoom(payload.sessionId)).emit("code-patch", payload);
  });

  socket.on("code-snapshot", (payload = {}) => {
    if (!payload.sessionId) return;
    socket.to(getSessionRoom(payload.sessionId)).emit("code-update", payload);
  });

  socket.on("language-change", (payload = {}) => {
    if (!payload.sessionId) return;
    socket.to(getSessionRoom(payload.sessionId)).emit("language-update", payload);
  });

  socket.on("cursor-change", (payload = {}) => {
    if (!payload.sessionId) return;
    socket.to(getSessionRoom(payload.sessionId)).emit("cursor-update", payload);
  });

  socket.on("run-code", (payload = {}) => {
    if (!payload.sessionId) return;
    socket.to(getSessionRoom(payload.sessionId)).emit("run-code", payload);
  });

  socket.on("submit-code", (payload = {}) => {
    if (!payload.sessionId) return;
    socket.to(getSessionRoom(payload.sessionId)).emit("submit-code", payload);
  });

  socket.on("execution-result", (payload = {}) => {
    if (!payload.sessionId) return;
    socket.to(getSessionRoom(payload.sessionId)).emit("execution-result", payload);
  });

  socket.on("submission-result", (payload = {}) => {
    if (!payload.sessionId) return;
    socket.to(getSessionRoom(payload.sessionId)).emit("submission-result", payload);
  });

  socket.on("question-switched", (payload = {}) => {
    if (!payload.sessionId) return;
    socket.to(getSessionRoom(payload.sessionId)).emit("question-switched", payload);
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected", { socketId: socket.id, reason });
  });
});

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // allow non-browser tools (no origin) and configured app origins
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(clerkMiddleware()); // this adds auth field to request object: req.auth()

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/chat", chatRoutes);
app.use("/api/code", codeExecutionRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/users", userRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ msg: "api is up and running" });
});

// make our app ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

const startServer = async () => {
  try {
    await connectDB();
    server.listen(ENV.PORT, () => console.log("Server is running on port:", ENV.PORT));
  } catch (error) {
    console.error("💥 Error starting the server", error);
  }
};

startServer();
