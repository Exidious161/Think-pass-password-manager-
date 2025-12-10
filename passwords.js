// Encryption key (must match the one in popup.js)
const encryptionKey = "mySecretKey1234567890123456";

// Decrypt data using AES-GCM
async function decryptData(encryptedData) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const iv = new Uint8Array(encryptedData.iv);
  const encrypted = new Uint8Array(encryptedData.encrypted);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encrypted
  );
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

async function displaySavedPasswords() {
  chrome.storage.sync.get(['passwords'], async function(result) {
    const encryptedPasswords = result.passwords;
    if (encryptedPasswords) {
      try {
        const passwords = await decryptData(encryptedPasswords);
        const passwordList = document.getElementById('password-list');
        passwordList.innerHTML = '';
        passwords.forEach(function(pwd) {
          const li = document.createElement('li');
          li.textContent = `Website: ${pwd.website}, Username: ${pwd.username}, Password: ${pwd.password}`;
          passwordList.appendChild(li);
        });
      } catch (error) {
        console.error("Error decrypting passwords: ", error);
        alert("Error loading passwords.");
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  displaySavedPasswords();
  var backButton = document.getElementById("back");
  backButton.addEventListener("click", function() {
    window.history.back();
  });
});
