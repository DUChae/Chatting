# 🌐 Real-Time Multilingual Chat (다국어 실시간 번역 채팅 웹)

> 서로 다른 언어를 사용하는 사람들이 **자신의 언어로 대화해도 실시간으로 소통할 수 있는 웹 채팅 서비스**  
> Node.js, Socket.io, Google Cloud Translation API를 활용하여 구현하였습니다.

---

## 📌 프로젝트 개요

이 프로젝트의 목표는 **언어의 장벽을 허무는 실시간 커뮤니케이션 플랫폼**을 만드는 것입니다.  
사용자는 한국어, 영어, 일본어 등 자신이 편한 언어로 메시지를 입력하면,  
서버가 Google Cloud Translation API를 통해 다른 사용자들의 언어로 자동 번역하여 전달합니다.

즉, 각 사용자는 **"자신의 언어로만 대화하지만 모든 사용자가 서로 이해할 수 있는"** 환경을 경험하게 됩니다.

---

## ⚙️ 주요 기능

- **실시간 채팅 (Socket.io 기반)**

  - 모든 클라이언트가 즉시 메시지를 주고받을 수 있습니다.
  - 새 사용자가 입장하거나 퇴장할 때 시스템 메시지가 자동으로 전송됩니다.

- **자동 번역 기능 (Google Cloud Translation API)**

  - 사용자가 설정한 언어로 자동 번역됩니다.
  - 메시지마다 번역 결과를 캐싱하여 불필요한 API 호출을 최소화했습니다.

- **다국어 사용자 지원**

  - 한국어, 영어, 일본어 등 다국어 사용자를 동시에 지원합니다.
  - 각 사용자는 자신의 언어로만 채팅 내용을 확인할 수 있습니다.

- **번역 캐싱 (MongoDB 기반)**
  - 동일 문장의 반복 번역을 줄이기 위해 MongoDB에 번역 결과를 저장합니다.
  - 성능 최적화 및 API 호출 비용 절감을 동시에 달성했습니다.

---

## 🧠 기술 스택

| 분야                        | 사용 기술                         |
| --------------------------- | --------------------------------- |
| **Backend**                 | Node.js, Express.js               |
| **Real-Time Communication** | Socket.io                         |
| **Database**                | MongoDB, Mongoose                 |
| **Translation API**         | Google Cloud Translation API (v3) |
| **Environment**             | dotenv                            |
| **Runtime**                 | Node.js v20                       |

---

## 🧩 시스템 구조

\`\`\`bash
📂 node_prac/
┣ 📂 public/ # 클라이언트(프론트엔드) 정적 파일
┃ ┣ index.html # 기본 채팅 UI
┃ ┗ style.css # UI 스타일
┣ 📜 index.js # 서버 진입점 (Express + Socket.io)
┣ 📜 clearChat.js # DB 대화 내용 초기화 스크립트
┣ 📜 .env # 환경 변수 파일 (MongoDB URI, GCP 인증 정보)
┣ 📜 package.json
┗ 📜 README.md
\`\`\`

---

## 🧱 주요 구현 내용

### 1️⃣ Socket.io를 이용한 실시간 채팅

- 클라이언트가 \`socket.emit("chat message", data)\`로 메시지를 전송하면  
  서버에서 \`io.emit("chat message", data)\`로 전체 사용자에게 전달합니다.
- 입장 시 \`socket.emit("new user and lang")\` 이벤트로 언어 정보를 서버에 전달합니다.
- 서버는 언어별로 번역된 채팅 내역을 불러와 사용자에게 맞게 전송합니다.

### 2️⃣ Google Cloud Translation API 연동

- 서버 측에서 번역을 처리하여 클라이언트는 오직 번역 결과만 수신합니다.
- \`TranslationServiceClient\`를 사용하여 Google Cloud Translation v3 API 호출.
- 메시지 원문과 번역 결과는 MongoDB에 저장되어,  
  동일 문장의 반복 번역 시 API 호출을 생략합니다.

### 3️⃣ MongoDB 기반 메시지 및 번역 캐시 저장

\`\`\`js
const chatMessageSchema = new mongoose.Schema({
user: String,
msg: String,
translations: { type: Map, of: String, default: {} },
timestamp: { type: Date, default: Date.now },
});
\`\`\`

- \`translations\` 필드(Map 타입)를 통해  
  \`언어코드 → 번역문\` 형태로 저장합니다.
- 이 구조를 통해 다국어 번역 결과를 효율적으로 관리합니다.

### 4️⃣ 번역 캐시 로직

- 새 메시지가 등록될 때:

  1. 원문 저장
  2. 다른 사용자의 언어로 번역
  3. 번역 결과를 DB에 캐시

- 이미 번역된 문장이 있으면, API 호출 없이 DB의 캐시를 즉시 사용합니다.

---

## 🧰 개선 아이디어

- JWT 인증을 통한 사용자 로그인 기능 추가
- WebSocket 클러스터링 (Redis Pub/Sub)으로 확장성 개선
- 번역 품질 향상을 위한 언어 감지 및 캐싱 정책 고도화

---

## 👨‍💻 개발자 메모

이 프로젝트는 단순한 채팅 앱을 넘어서,  
“**기술이 언어의 벽을 허무는 방식**”을 실험적으로 보여주는 목적을 가지고 있습니다.

Node.js의 실시간 처리 능력과 Google Cloud의 AI 번역 기능이  
서로 맞물려 인간의 언어적 한계를 기술적으로 완화시키는 작은 예시입니다.
