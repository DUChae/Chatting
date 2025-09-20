const express = require("express");
const app = express();
const http = require("http");
const { default: mongoose } = require("mongoose");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

mongoose
  .connect("mongodb://localhost:27017/chat-app")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const chatMessageSchema = new mongoose.Schema({
  user: String,
  msg: String,
  timestamp: { type: Date, default: Date.now },
});

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

app.use(express.static("public"));

io.on("connection", (socket) => {
  let username = null;
  console.log("유저가 연결되었습니다.");

  socket.on("new user", (name) => {
    username = name;
    io.emit("chat message", {
      user: "시스템",
      msg: `${username}님이 입장하셨습니다.`,
    });
  });

  socket.on("chat message", async (data) => {
    const chatMessage = new ChatMessage({
      user: data.user,
      msg: data.msg,
    });

    await chatMessage.save();

    io.emit("chat message", data);
  });

  socket.on("disconnect", () => {
    console.log("유저가 연결을 끊었습니다.");
    if (username) {
      io.emit("chat message", {
        user: "시스템",
        msg: `${username}님이 퇴장하셨습니다.`,
      });
    }
  });
});

server.listen(3000, () => {
  console.log("서버가 http://localhost:3000 에서 실행 중입니다.");
});
