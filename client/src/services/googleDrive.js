import { gapi } from "gapi-script";

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SCOPE = "https://www.googleapis.com/auth/drive.file";

export const initGoogleDrive = (firebaseEmail) => {
  return new Promise((resolve, reject) => {
    console.log("Memulai pemuatan gapi untuk:", firebaseEmail);
    gapi.load("client:auth2", () => {
      console.log("gapi.client:auth2 dimuat");
      gapi.client
        .init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          scope: SCOPE,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        })
        .then(() => {
          console.log("gapi.client diinisialisasi");
          gapi.client.load("drive", "v3").then(() => {
            console.log("Library Google Drive v3 dimuat");
            const authInstance = gapi.auth2.getAuthInstance();
            const isSignedIn = authInstance.isSignedIn.get();
            if (!isSignedIn) {
              console.log("Belum login ke Google Drive, meminta login...");
              authInstance.signIn({ prompt: "select_account" }).then(() => {
                const user = authInstance.currentUser.get();
                const driveEmail = user.getBasicProfile().getEmail();
                console.log("Login Drive dengan:", driveEmail);
                if (driveEmail.toLowerCase() === firebaseEmail.toLowerCase()) {
                  resolve();
                } else {
                  console.error("Akun tidak cocok. Drive:", driveEmail, "Firebase:", firebaseEmail);
                  authInstance.signOut();
                  reject(new Error("ACCOUNT_MISMATCH"));
                }
              }).catch((err) => {
                console.error("Gagal login ke Google Drive:", err);
                reject(err);
              });
            } else {
              const user = authInstance.currentUser.get();
              const driveEmail = user.getBasicProfile().getEmail();
              console.log("Sudah login Drive dengan:", driveEmail);
              if (driveEmail.toLowerCase() === firebaseEmail.toLowerCase()) {
                resolve();
              } else {
                console.error("Akun tidak cocok. Drive:", driveEmail, "Firebase:", firebaseEmail);
                authInstance.signOut();
                reject(new Error("ACCOUNT_MISMATCH"));
              }
            }
          }).catch((err) => {
            console.error("Gagal memuat library Drive:", err);
            reject(err);
          });
        })
        .catch((err) => {
          console.error("Gagal inisialisasi gapi.client:", err);
          reject(err);
        });
    });
  });
};

export const createFolder = async (folderName) => {
  try {
    console.log("Membuat folder:", folderName);
    const response = await gapi.client.drive.files.create({
      resource: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    console.log("Folder dibuat:", response.result.id);
    return response.result.id;
  } catch (error) {
    console.error("Error membuat folder:", error);
    throw error;
  }
};

export const findOrCreateFolder = async (folderName) => {
  try {
    console.log("Mencari folder:", folderName);
    const response = await gapi.client.drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
    });
    console.log("Hasil pencarian folder:", response.result);

    if (response.result.files.length > 0) {
      console.log("Folder ditemukan:", response.result.files[0].id);
      return response.result.files[0].id;
    }
    return await createFolder(folderName);
  } catch (error) {
    console.error("Error mencari/membuat folder:", error);
    throw error;
  }
};

export const saveAttendanceData = async (fileId, fileName, data) => {
  try {
    console.log("Menyimpan data absensi:", { fileId, fileName });
    const content = JSON.stringify(data);
    const fileMetadata = {
      name: fileName,
      mimeType: "application/json",
    };
    if (data.parents) {
      fileMetadata.parents = data.parents;
    }

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      JSON.stringify(fileMetadata) +
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      content +
      closeDelimiter;

    const request = {
      path: fileId ? `/upload/drive/v3/files/${fileId}` : "/upload/drive/v3/files",
      method: fileId ? "PATCH" : "POST",
      params: { uploadType: "multipart" },
      headers: {
        "Content-Type": `multipart/related; boundary="${boundary}"`,
      },
      body: multipartRequestBody,
    };

    console.log("Mengirim permintaan ke Drive:", request.method, request.path);
    const response = await gapi.client.request(request);
    console.log("Data disimpan:", response.result);
    return response.result.id;
  } catch (error) {
    console.error("Error menyimpan data:", error);
    throw error;
  }
};

export const getAttendanceData = async (fileId) => {
  try {
    console.log("Mengambil data untuk file ID:", fileId);
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: "media",
    });
    console.log("Data diambil:", response.body);
    return JSON.parse(response.body);
  } catch (error) {
    console.error("Error mengambil data:", error);
    throw error;
  }
};