const socket = io();
const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");

const usernameModal = document.getElementById("username-modal");
const usernameInput = document.getElementById("username-input");
const usernameSubmit = document.getElementById("username-submit");
const chatContainer = document.getElementById("chat-container");
const languageSelect = document.getElementById("language-select");

let username = null;

// --- 유틸: 안전한 텍스트 엘리먼트 생성 (XSS 방지) ---
function createTextEl(tag = "div", text = "") {
  const el = document.createElement(tag);
  el.textContent = text; // 절대 innerHTML 사용 금지
  return el;
}

// --- 유틸: 메시지 항목 추가 (중앙화) ---
// data: { user, msg, originalMsg? }, currentUsername: string
function appendMessage(data, currentUsername) {
  const li = document.createElement("li");

  // 메시지 구분
  if (data.user === currentUsername) {
    li.classList.add("my-message");
  } else if (data.user === "시스템") {
    li.classList.add("system-message");
  } else {
    li.classList.add("other-message");
  }

  // --- 메시지 내용 ---
  const nameEl = document.createElement("strong");
  if (data.user !== "시스템" && data.user !== currentUsername) {
    nameEl.textContent = `${data.user}: `;
    li.appendChild(nameEl);
  }

  const messageText = document.createElement("span");
  messageText.textContent = data.msg;
  li.appendChild(messageText);

  // --- 🌐 원문 보기 아이콘 (번역 메시지인 경우만) ---
  if (data.originalMsg && data.originalMsg !== data.msg) {
    const toggle = document.createElement("span");
    toggle.textContent = " 🌐";
    toggle.classList.add("translate-toggle");

    const original = document.createElement("div");
    original.textContent = data.originalMsg;
    original.classList.add("original-text");

    toggle.addEventListener("click", () => {
      original.style.display =
        original.style.display === "block" ? "none" : "block";
    });

    li.appendChild(toggle);
    li.appendChild(original);
  }

  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

// --- 유저 이름 제출(모달) 처리 ---
// 간단한 검증: 빈값/길이/예약어 방지
usernameSubmit.addEventListener("click", () => {
  const desiredUsername = usernameInput.value.trim();
  const selectedLanguage = languageSelect.value || "ko";

  // 기본 검증
  if (!desiredUsername) {
    alert("이름을 입력해주세요.");
    return;
  }
  if (desiredUsername.length > 30) {
    alert("이름은 30자 이하로 입력해주세요.");
    return;
  }
  // 예약어 방지 (시스템 메시지와 충돌 방지)
  const reserved = ["시스템", "system", "admin"];
  if (reserved.includes(desiredUsername.toLowerCase())) {
    alert("해당 이름은 사용할 수 없습니다. 다른 이름을 입력해주세요.");
    return;
  }

  // 서버에 유저 이름 + 선호 언어 전송
  socket.emit("new user and lang", {
    name: desiredUsername,
    lang: selectedLanguage,
  });

  // 클라이언트 상태 갱신 및 UI 전환
  username = desiredUsername;
  usernameModal.style.display = "none";
  chatContainer.style.display = "flex";
});

// --- 채팅 전송 ---
// 폼 제출 시 동작 (Enter 포함)
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  if (!username) {
    alert("먼저 이름을 입력하고 채팅을 시작하세요.");
    return;
  }

  // 전송 데이터 구조: { user, msg }
  socket.emit("chat message", { user: username, msg: text });

  // 입력창 초기화 (사용자 경험)
  input.value = "";
  input.focus();
});

// --- 서버에서 채팅 기록 수신 ---
// 서버는 이미 해당 유저의 선호 언어에 맞춰 번역된 히스토리를 보냄
socket.on("chat history", (msgs) => {
  // 안전하게 초기화
  messages.innerHTML = "";
  if (!Array.isArray(msgs)) return;

  msgs.forEach((data) => {
    appendMessage(data, username);
  });
});

// --- 실시간 채팅 메시지 수신 ---
socket.on("chat message", (data) => {
  // 간단한 구조 검증
  if (!data || typeof data.msg !== "string") return;
  appendMessage(data, username);
});

// --- 연결 상태 표시(선택) ---
// 연결/재접속/오류 이벤트를 통해 UI 개선 가능
socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});
socket.on("disconnect", (reason) => {
  console.log("Socket disconnected:", reason);
});
socket.on("connect_error", (err) => {
  console.error("Socket connect error:", err);
});
