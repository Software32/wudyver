import axios from "axios";
const FIGURE_PROMPT = "Using the nano-banana model, a commercial 1/7 scale figurine of the character in the picture was created, depicting a realistic style and a realistic environment. The figurine is placed on a computer desk with a round transparent acrylic base. There is no text on the base. The computer screen shows the Zbrush modeling process of the figurine. Next to the computer screen is a BANDAI-style toy box with the original painting printed on it.";
class AIGenerator {
  constructor() {
    this.config = {
      baseURL: "https://veo3-backend-alpha.vercel.app/api",
      endpoints: {
        login: "/v1/user/login",
        chat: "/v1/chat",
        uploadImages: "/v1/chat/upload-images",
        chatPoll: "/v1/chat/poll/status/"
      },
      defaultLoginPayload: {
        build: "1.2.1",
        country: "US",
        language: "en",
        platform: "Android",
        version: "1.2.1",
        osVersion: "33",
        timeZone: "America/Los_Angeles"
      }
    };
    this.token = null;
  }
  _generateRandomString(length) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  }
  _createLoginData() {
    const randomId = this._generateRandomString(21);
    return {
      ...this.config.defaultLoginPayload,
      googleAccountId: `10${randomId}`,
      email: `user.${this._generateRandomString(5)}@example.com`,
      displayName: `User ${this._generateRandomString(5)}`,
      deviceId: `device_${this._generateRandomString(16)}`,
      deviceModel: `SDK_${this._generateRandomString(4)}`
    };
  }
  async _login() {
    try {
      console.log("Mencoba login...");
      const response = await axios.post(this.config.baseURL + this.config.endpoints.login, this._createLoginData());
      if (response.data?.token) {
        this.token = response.data.token;
        console.log("Login berhasil.");
      } else throw new Error("Respons login tidak valid.");
    } catch (error) {
      console.error("Login gagal:", error.response?.data || error.message);
      throw error;
    }
  }
  async _ensureLogin() {
    if (!this.token) await this._login();
  }
  _getAuthHeaders() {
    if (!this.token) throw new Error("Token tidak ada.");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`
    };
  }
  async _uploadFile(file) {
    console.log(` -> Meminta izin unggah untuk ${file.fileName}...`);
    const presignResponse = await axios.post(this.config.baseURL + this.config.endpoints.uploadImages, {
      images: [{
        fileName: file.fileName,
        fileType: file.fileType
      }]
    }, {
      headers: this._getAuthHeaders()
    });
    const uploadInfo = presignResponse.data.data[0];
    if (!uploadInfo?.uploadUrl) throw new Error("Gagal mendapatkan pre-signed URL.");
    console.log(` -> Mengunggah data ${file.fileName}...`);
    await axios.put(uploadInfo.uploadUrl, file.data, {
      headers: {
        "Content-Type": file.fileType
      }
    });
    console.log(` -> Unggah ${file.fileName} berhasil.`);
    return uploadInfo.fileUrl;
  }
  async _pollStatus(requestId) {
    console.log(`Memulai polling untuk requestId: ${requestId}...`);
    const pollUrl = this.config.baseURL + this.config.endpoints.chatPoll + requestId;
    while (true) {
      try {
        const {
          data
        } = await axios.get(pollUrl, {
          headers: this._getAuthHeaders()
        });
        if (data.isCompleted) {
          console.log("Tugas selesai!");
          return data;
        }
        console.log("Status: Belum selesai. Mencoba lagi...");
      } catch (error) {
        console.error("Error saat polling:", error.response?.data || error.message);
      }
      await new Promise(resolve => setTimeout(resolve, 3e3));
    }
  }
  async generate({
    prompt = FIGURE_PROMPT,
    imageUrl,
    ...rest
  }) {
    if (!prompt) throw new Error("`prompt` wajib diisi.");
    await this._ensureLogin();
    const imageArray = imageUrl ? Array.isArray(imageUrl) ? imageUrl : [imageUrl] : [];
    const finalImageUrls = [];
    if (imageArray.length > 0) {
      console.log(`Memproses ${imageArray.length} gambar secara sekuensial...`);
      for (const image of imageArray) {
        let processedUrl;
        if (typeof image === "string" && image.startsWith("http")) {
          console.log("Mendeteksi URL web, menambahkannya secara langsung.");
          processedUrl = image;
        } else if (typeof image === "string" && image.startsWith("data:")) {
          console.log("Mendeteksi data Base64, memproses untuk diunggah...");
          const match = image.match(/^data:(.+);base64,(.*)$/);
          if (!match) throw new Error("Format string Base64 tidak valid.");
          const [, fileType, data] = match;
          const extension = fileType.split("/")[1] || "bin";
          processedUrl = await this._uploadFile({
            fileName: `upload.${extension}`,
            fileType: fileType,
            data: Buffer.from(data, "base64")
          });
        } else if (typeof image === "object" && image.data instanceof Buffer) {
          console.log(`Mendeteksi Buffer untuk file "${image.fileName}", memproses untuk diunggah...`);
          if (!image.fileType || !image.fileName) throw new Error("Objek gambar Buffer harus memiliki `fileType` dan `fileName`.");
          processedUrl = await this._uploadFile(image);
        } else {
          throw new Error("Format gambar tidak didukung.");
        }
        finalImageUrls.push(processedUrl);
      }
    }
    const chatData = {
      prompt: prompt,
      imageUrls: finalImageUrls,
      ...rest
    };
    console.log("Mengirim permintaan tugas final:", chatData);
    const initialResponse = await axios.post(this.config.baseURL + this.config.endpoints.chat, chatData, {
      headers: this._getAuthHeaders()
    });
    if (initialResponse.data.requestId) {
      return await this._pollStatus(initialResponse.data.requestId);
    }
    return initialResponse.data;
  }
}
export default async function handler(req, res) {
  const params = req.method === "GET" ? req.query : req.body;
  if (!params.imageUrl) {
    return res.status(400).json({
      error: "imageUrl are required"
    });
  }
  try {
    const api = new AIGenerator();
    const response = await api.generate(params);
    return res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Internal Server Error"
    });
  }
}