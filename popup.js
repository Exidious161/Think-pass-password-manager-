document.addEventListener("DOMContentLoaded", function () {
  var saveButton = document.getElementById("save");
  saveButton.addEventListener("click", saveCredentials);
});

function saveCredentials() {
  var username = document.getElementById("username").value;
  var password = document.getElementById("password").value;

  chrome.storage.sync.set({ username: username, password: password }, function () {
    console.log("Credentials saved successfully.");
    alert("Credentials saved to local storage.");
    saveFile(username, password);
  });
}

function saveFile(username, password) {
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
          updateFileContent(data.files[0].id, username, password, headers);
        } else {
          // File doesn't exist, create a new one
          createNewFile(username, password, headers);
        }
      })
      .catch(function (error) {
        console.error("Error checking file existence: ", error);
      });
  });
}

function updateFileContent(fileId, username, password, headers) {
  // Fetch the existing content of the file
  fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    method: "GET",
    headers: headers,
  })
    .then(function (response) {
      return response.text();
    })
    .then(function (content) {
      // Append the new credential to the existing content
      var fileContent = content + "\n" + username + ":" + password;

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
    })
    .catch(function (error) {
      console.error("Error fetching file content: ", error);
      alert("Error fetching file content: " + error.message);
    });
}


function createNewFile(username, password, headers) {
  var metadata = {
    name: "passwords.txt",
    mimeType: "text/plain",
    parents: ["root"],
  };

  var fileContent = username + ":" + password;

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
