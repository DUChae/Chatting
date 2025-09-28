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

//api 연동 부분
const translateText = async (text, targetLang) => {
  //api 로직 구현
  return `[Translated to ${targetLang}]: ${text}`;
};

//유저 연결 시
io.on("connection", async (socket) => {
  let username = null;
  let preferredLanguage = "ko"; // 기본값 한국어

  socket.on("new user and lang", (data) => {
    username = data.name;
    preferredLanguage = data.lang;
    io.emit("chat message", {
      user: "시스템",
      msg: `${username}님이 입장하셨습니다.`,
    });
  });

  //DB에서 모든 채팅 기록 불러오기
  try {
    const messages = await ChatMessage.find().sort({ timestamp: 1 }).limit(100);
    //현재 접속한 유저에게 채팅 기록 전송
    socket.emit("chat history", messages);
  } catch (err) {
    console.error("채팅 기록 불러오기 오류:", err);
  }

  socket.on("new user", (name) => {
    username = name;
    io.emit("chat message", {
      user: "시스템",
      msg: `${username}님이 입장하셨습니다.`,
    });
  });

  //채팅 메시지 수신 시
  socket.on("chat message", async (data) => {
    //메세지 객체 생성 및 필터링
    const chatMessage = new ChatMessage({
      user: data.user,
      msg: data.msg,
    });

    //메세지 저장
    await chatMessage.save();

    //접속 중인 소켓 순회하며 번역 후 전송
    io.sockets.sockets.forEach(async (receiverSocket) => {
      const receiverLang = receiverSocket.preferredLanguage || "ko";

      //번역 수행
      const translateMsg = await translateText(data.msg, receiverLang);

      //번역된 메세지 전송
      receiverSocket.emit("chat message", {
        user: data.user,
        msg: translateMsg,
        originalMsg: data.msg,
      });
    });
  });

  //유저 연결 해제 시
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
