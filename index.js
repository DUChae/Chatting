require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const { default: mongoose } = require("mongoose");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Load GCP API Client
const { TranslationServiceClient } = require("@google-cloud/translate");
const translateClient = new TranslationServiceClient();

//MongoDB 연결
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

//api 연동 부분 (GCP 로직 유지)
const translateText = async (text, targetLang) => {
  if (!text || targetLang === "ko") {
    return text;
  }

  const projectId = process.env.GCP_PROJECT_ID;
  const location = "global";

  const request = {
    parent: `projects/${projectId}/locations/${location}`,
    contents: [text],
    mimeType: "text/plain",
    targetLanguageCode: targetLang,
    sourceLanguageCode: "auto",
  };

  try {
    const [response] = await translateClient.translateText(request);

    if (response.translations && response.translations.length > 0) {
      return response.translations[0].translatedText;
    }
    return text;
  } catch (error) {
    console.error(
      `GCP Translation API 오류 (${targetLang}):`,
      error.details || error.message
    );

    return `[번역 오류 발생]: ${text}`;
  }
};

//유저 연결 시
io.on("connection", async (socket) => {
  let username = null;
  // 💡 1. preferredLanguage를 socket 객체의 속성으로 초기화 (다른 곳에서 접근 가능)
  socket.preferredLanguage = "ko";

  socket.on("new user and lang", async (data) => {
    username = data.name;
    // 💡 2. 소켓 객체에 언어 설정 저장
    socket.preferredLanguage = data.lang;

    // 💡 3. 채팅 기록 불러오기와 번역 전송 로직을 이 블록 안으로 이동 (가장 중요)
    try {
      const messages = await ChatMessage.find()
        .sort({ timestamp: 1 })
        .limit(100);

      // 기록된 메시지를 현재 접속 유저의 언어에 맞게 번역하여 전송
      const translatedHistory = await Promise.all(
        messages.map(async (msg) => {
          if (msg.user === username) {
            return { user: msg.user, msg: msg.msg };
          }
          // 💡 소켓에 저장된 언어 설정 사용
          const translatedMsg = await translateText(
            msg.msg,
            socket.preferredLanguage
          );
          return { user: msg.user, msg: translatedMsg };
        })
      );

      // 현재 접속한 유저에게만 번역된 채팅 기록 전송
      socket.emit("chat history", translatedHistory);
    } catch (err) {
      console.error("채팅 기록 번역/전송 오류:", err);
    }

    // 입장 알림
    io.emit("chat message", {
      user: "시스템",
      msg: `${username}님이 입장하셨습니다.`,
    });
  });

  // 💡 4. 불필요하고 충돌을 일으키는 이벤트 삭제 (클라이언트가 더 이상 new user를 사용하지 않음)
  /*
  socket.on("new user", (name) => {
    username = name;
    io.emit("chat message", {
      user: "시스템",
      msg: `${username}님이 입장하셨습니다.`,
    });
  });
  */

  // 💡 5. 기존의 'chat history' 로직 삭제 (new user and lang 안에서 처리됨)
  /*
  try {
    const messages = await ChatMessage.find().sort({ timestamp: 1 }).limit(100);
    socket.emit("chat history", messages);
  } catch (err) {
    console.error("채팅 기록 불러오기 오류:", err);
  }
  */

  //채팅 메시지 수신 시
  socket.on("chat message", async (data) => {
    // DB에는 원본 메시지 저장
    const chatMessage = new ChatMessage({
      user: data.user,
      msg: data.msg,
    });

    await chatMessage.save();

    // 💡 6. 접속 중인 소켓을 Array.from으로 변환하여 안전하게 순회하며 번역 후 전송
    Array.from(io.sockets.sockets).forEach(async (receiverSocket) => {
      // 💡 소켓 객체에 저장된 언어 설정 사용
      const receiverLang = receiverSocket.preferredLanguage || "ko";

      // 발신자가 보낸 원본 메시지를 수신자의 언어에 맞게 번역
      const translateMsg = await translateText(data.msg, receiverLang);

      // 번역된 메세지 전송
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
