const socket = io();
const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");

const usernameModal = document.getElementById("username-modal");
const usernameInput = document.getElementById("username-input");
const usernameSubmit = document.getElementById("username-submit");
const chatContainer = document.getElementById("chat-container");
let username;

usernameSubmit.addEventListener("click", () => {
  if (usernameInput.value) {
    username = usernameInput.value;
    usernameModal.style.display = "none";
    chatContainer.style.display = "flex";
    socket.emit("new user", username);
  }
});
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value) {
    socket.emit("chat message", { user: username, msg: input.value });
    input.value = "";
  }
});

socket.on("chat message", (data) => {
  const item = document.createElement("li");

  if (data.user === "시스템") {
    item.textContent = data.msg;
    item.style.fontWeight = "bold";
  } else {
    item.innerHTML = `<strong>${data.user}</strong>: ${data.msg}`;
  }
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});