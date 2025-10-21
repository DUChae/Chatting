// clearChat.js
const mongoose = require("mongoose");
const ChatMessage = require("./index");

const MONGO_URI = "mongodb://localhost:27017/chat-app";

async function clearChat() {
  try {
    await mongoose.connect(MONGO_URI);
    const result = await ChatMessage.deleteMany({});
    console.log(`✅ ${result.deletedCount}개의 채팅 메시지가 삭제되었습니다.`);
  } catch (err) {
    console.error("❌ 삭제 중 오류 발생:", err);
  } finally {
    await mongoose.disconnect();
  }
}

clearChat();
