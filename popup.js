document.addEventListener("DOMContentLoaded", function () {
  var saveButton = document.getElementById("save");
  saveButton.addEventListener("click", saveCredentials);
  var passwordInput = document.getElementById("password");
  passwordInput.addEventListener("input", checkPasswordStrength);
  var viewPasswordsButton = document.getElementById("view-passwords");
  viewPasswordsButton.addEventListener("click", function() {
    chrome.tabs.create({ url: chrome.runtime.getURL("passwords.html") });
  });
  displaySavedPasswords();
});

// Encryption key (in a real app, this should be user-provided or derived from a master password)
const encryptionKey = "mySecretKey1234567890123456";

// Encrypt data using AES-GCM
async function encryptData(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionKey),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    dataBuffer
  );
  return { encrypted: Array.from(new Uint8Array(encrypted)), iv: Array.from(iv) };
}

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

function checkPasswordStrength() {
  var password = document.getElementById("password").value;
  var strengthDiv = document.getElementById("password-strength");
  var strength = 0;

  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  if (strength <= 2) {
    strengthDiv.innerHTML = "<span style='color: red;'>Weak Password</span>";
  } else if (strength <= 3) {
    strengthDiv.innerHTML = "<span style='color: orange;'>Medium Password</span>";
  } else {
    strengthDiv.innerHTML = "<span style='color: green;'>Strong Password</span>";
  }
}

async function saveCredentials() {
  var saveButton = document.getElementById("save");
  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  var website = document.getElementById("website").value.trim();
  var username = document.getElementById("username").value.trim();
  var password = document.getElementById("password").value.trim();

  if (!website || !username || !password) {
    alert("Please fill in all fields.");
    saveButton.disabled = false;
    saveButton.textContent = "Save";
    return;
  }

  chrome.storage.sync.get(['passwords'], async function(result) {
    let passwords = [];
    if (result.passwords) {
      try {
        passwords = await decryptData(result.passwords);
      } catch (error) {
        console.error("Error decrypting existing passwords: ", error);
        passwords = [];
      }
    }
    passwords.push({ website: website, username: username, password: password });

    // Encrypt the passwords array before saving to local storage
    const encryptedPasswords = await encryptData(passwords);

    chrome.storage.sync.set({ passwords: encryptedPasswords }, function () {
      console.log("Credentials saved successfully.");
      displaySavedPasswords();
      saveFile(passwords);
      // Clear inputs
      document.getElementById("website").value = '';
      document.getElementById("username").value = '';
      document.getElementById("password").value = '';
      saveButton.disabled = false;
      saveButton.textContent = "Save";
    });
  });
}

async function saveFile(passwords) {
  // Encrypt the passwords array for Drive backup
  const encryptedPasswords = await encryptData(passwords);

  chrome.identity.getAuthToken({ interactive: true }, function (token) {
    var headers = new Headers({
      Authorization: "Bearer " + token,
    });

    // Checking if the file already exists
    fetch(
      "https://www.googleapis.com/drive/v3/files?q=name%20%3D%20'passwords.txt'%20and%20'root'%20in%20parents",
      {
        method: "GET",
        headers: headers,
      }
    )
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (data.files.length > 0) {
          // File already exists, update the content
          updateFileContent(data.files[0].id, encryptedPasswords, headers);
        } else {
          // File doesn't exist, create a new one
          createNewFile(encryptedPasswords, headers);
        }
      })
      .catch(function (error) {
        console.error("Error checking file existence: ", error);
      });
  });
}

function updateFileContent(fileId, encryptedPasswords, headers) {
  // Create file content from encrypted data
  var fileContent = JSON.stringify(encryptedPasswords);

  // Update the file with the new content
  fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: headers,
    body: fileContent,
  })
    .then(function (response) {
      console.log("File content updated successfully.");
      alert("Credentials updated in Google Drive.");
    })
    .catch(function (error) {
      console.error("Error updating file content: ", error);
      alert("Error updating credentials in Google Drive: " + error.message);
    });
}


function createNewFile(encryptedPasswords, headers) {
  var metadata = {
    name: "passwords.txt",
    mimeType: "text/plain",
    parents: ["root"],
  };

  var fileContent = JSON.stringify(encryptedPasswords);

  var form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", new Blob([fileContent], { type: "text/plain" }));

  fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: headers,
    body: form,
  })
    .then(function (response) {
      console.log("File saved successfully.");
      alert("Credentials saved to Google Drive.");
    })
    .catch(function (error) {
      console.error("Error saving file: ", error);
      alert("Error saving to Google Drive: " + error.message);
    });
}
