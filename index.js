require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const mongoose = require("mongoose");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const { TranslationServiceClient } = require("@google-cloud/translate").v3;
const translateClient = new TranslationServiceClient();

const checkAuth = async () => {
  try {
    const [response] = await translateClient.getSupportedLanguages({
      parent: `projects/${process.env.GCP_PROJECT_ID}/locations/global`,
    });
    console.log("GCP supported languages:", response.languages?.length || 0);
  } catch (e) {
    console.error("GCP 인증/호출 오류:", e.message);
  }
};
checkAuth();

mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/chat-app", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const chatMessageSchema = new mongoose.Schema({
  user: String,
  msg: String,
  translations: { type: Map, of: String, default: {} }, // language -> translated text
  timestamp: { type: Date, default: Date.now },
});
const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

app.use(express.static("public"));

const translateText = async (text, targetLang) => {
  if (!text) return text; // 빈 문자열은 그대로

  try {
    const projectId = process.env.GCP_PROJECT_ID;
    const location = "global";

    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      contents: [text],
      mimeType: "text/plain",
      targetLanguageCode: targetLang,
      // -> sourceLanguageCode를 제거(또는 미정의)하면 자동 감지 가능
    };

    console.log("번역 요청:", { targetLang, sampleText: text.slice(0, 200) });
    // translateText는 v3에서 [response] 형태로 반환
    const [response] = await translateClient.translateText(request);

    // 안전하게 검사 후 번역 반환
    if (
      response &&
      Array.isArray(response.translations) &&
      response.translations[0]
    ) {
      console.log(
        "번역 결과 예시:",
        response.translations[0].translatedText.slice(0, 200)
      );
      return response.translations[0].translatedText;
    }

    // 혹시 응답이 이상하면 원문 반환
    return text;
  } catch (error) {
    // 에러 메시지와 상세를 로깅
    console.error(
      `GCP 번역 오류 (${targetLang}):`,
      error.code || error.message || error
    );
    // 디버깅을 위해 전체 에러 객체도 간단히 출력(개발 환경에서만)
    console.error(error);
    // 사용자에게는 번역 실패를 나타내는 문자열 대신 원문 반환(원하면 [번역오류] 접두사 사용)
    return text;
  }
};

io.on("connection", (socket) => {
  let username = null;
  socket.preferredLanguage = "ko";

  socket.on("new user and lang", async (data) => {
    username = data.name;
    socket.username = data.name;
    socket.preferredLanguage = data.lang || "ko";

    try {
      const messages = await ChatMessage.find()
        .sort({ timestamp: 1 })
        .limit(100);
      const translatedHistory = await Promise.all(
        messages.map(async (msgDoc) => {
          // 사용자의 자기 메시지는 원문 그대로
          if (msgDoc.user === username) {
            return { user: msgDoc.user, msg: msgDoc.msg };
          }
          const cached = msgDoc.translations.get(socket.preferredLanguage);
          if (cached) return { user: msgDoc.user, msg: cached };
          const translated = await translateText(
            msgDoc.msg,
            socket.preferredLanguage
          );
          // DB에 캐시 추가 (비동기지만 안전하게 처리)
          try {
            msgDoc.translations.set(socket.preferredLanguage, translated);
            await msgDoc.save();
          } catch (e) {
            console.warn("Translation cache save failed:", e.message);
          }
          return { user: msgDoc.user, msg: translated };
        })
      );
      socket.emit("chat history", translatedHistory);
    } catch (err) {
      console.error("채팅 기록 로드/번역 오류:", err);
    }

    io.emit("chat message", {
      user: "시스템",
      msg: `${username}님이 입장하셨습니다.`,
    });
  });

  socket.on("chat message", async (data) => {
    // validation
    if (!data || !data.user || !data.msg) return;

    let chatMessage;
    try {
      chatMessage = new ChatMessage({ user: data.user, msg: data.msg });
      await chatMessage.save();
    } catch (e) {
      console.error("DB 저장 실패:", e);
      return;
    }

    // 각 접속 소켓에 대해 번역(캐시 재사용)
    await Promise.all(
      Array.from(io.of("/").sockets.values()).map(async (receiverSocket) => {
        if (!receiverSocket.username) return;
        const receiverLang = receiverSocket.preferredLanguage || "ko";
        // DB 캐시 확인
        let translated = chatMessage.translations.get(receiverLang);
        if (!translated) {
          translated = await translateText(data.msg, receiverLang);
          // DB에 캐시 추가(시도)
          try {
            chatMessage.translations.set(receiverLang, translated);
            await chatMessage.save();
          } catch (e) {
            console.warn("Translation cache update failed:", e.message);
          }
        }
        receiverSocket.emit("chat message", {
          user: data.user,
          msg: translated,
          originalMsg: data.msg,
        });
      })
    );
  });

  socket.on("disconnect", () => {
    if (username) {
      io.emit("chat message", {
        user: "시스템",
        msg: `${username}님이 퇴장하셨습니다.`,
      });
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("서버 실행:", process.env.PORT || 3000);
});
