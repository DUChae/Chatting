const socket = io();
const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");

const usernameModal = document.getElementById("username-modal");
const usernameInput = document.getElementById("username-input");
const usernameSubmit = document.getElementById("username-submit");
const chatContainer = document.getElementById("chat-container");
const languageSelect = document.getElementById("language-select");

let username;

//유저 이름 제출 시
usernameSubmit.addEventListener("click", () => {
  const desiredUsername = usernameInput.value.trim();
  if (desiredUsername) {
    //선택한 언어 가져오기
    const selectedLanguage = languageSelect.value;

    //서버에 유저 이름과 선호 언어 전송
    socket.emit("new user and lang", {
      name: desiredUsername,
      lang: selectedLanguage,
    });

    //전송 후 클라이언트 전역 변수 설정 및 모달 숨기기
    username = desiredUsername;
    usernameModal.style.display = "none";
    chatContainer.style.display = "flex";
  } else {
    alert("이름을 입력해주세요.");
  }
});

// 채팅 메시지 전송
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value) {
    socket.emit("chat message", { user: username, msg: input.value });
    input.value = "";
  }
});

// 채팅 기록 수신 시
socket.on("chat history", (msgs) => {
  messages.innerHTML = ""; // 전역 변수 messages(HTML 요소)에 접근
  msgs.forEach((data) => {
    const item = document.createElement("li");
    if (data.user == username) {
      item.classList.add("my-message");
      item.innerHTML = `${data.msg}`;
    } else if (data == "시스템") {
      item.classList.add("system-message");
      item.textContent = data.msg;
    } else {
      item.classList.add("other-message");
      item.innerHTML = `<strong>${data.user}</strong>: ${data.msg}`;
    }

    if (data.originalMsg) {
      item.title = data.originalMsg; //원본 메시지를 툴팁으로 설정
    }
    messages.appendChild(item); // 전역 변수 messages(HTML 요소)에 추가
  });
  window.scrollTo(0, document.body.scrollHeight);
});

// 실시간 채팅 메시지 수신 시
socket.on("chat message", (data) => {
  const item = document.createElement("li");

  if (data.user == username) {
    item.classList.add("my-message");
    item.innerHTML = `${data.msg}`;
  } else if (data.user == "시스템") {
    item.classList.add("system-message");
    item.textContent = data.msg;
  } else {
    item.classList.add("other-message");
    item.innerHTML = `<strong>${data.user}</strong>: ${data.msg}`;
  }
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});
