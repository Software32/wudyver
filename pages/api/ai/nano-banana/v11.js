import axios from "axios";
import crypto from "crypto";
import apiConfig from "@/configs/apiConfig";
const wudysoftApiClient = axios.create({
  baseURL: `https://${apiConfig.DOMAIN_URL}/api`
});
class WudysoftAPI {
  constructor() {
    this.client = wudysoftApiClient;
  }
  async createPaste(title, content) {
    try {
      const response = await this.client.get("/tools/paste/v1", {
        params: {
          action: "create",
          title: title,
          content: content
        }
      });
      return response.data?.key || null;
    } catch (error) {
      console.error(`[ERROR] Gagal dalam 'WudysoftAPI.createPaste': ${error.message}`);
      throw error;
    }
  }
  async getPaste(key) {
    try {
      const response = await this.client.get("/tools/paste/v1", {
        params: {
          action: "get",
          key: key
        }
      });
      return response.data?.content || null;
    } catch (error) {
      console.error(`[ERROR] Gagal dalam 'WudysoftAPI.getPaste' untuk kunci ${key}: ${error.message}`);
      return null;
    }
  }
  async listPastes() {
    try {
      const response = await this.client.get("/tools/paste/v1", {
        params: {
          action: "list"
        }
      });
      return response.data || [];
    } catch (error) {
      console.error(`[ERROR] Gagal dalam 'WudysoftAPI.listPastes': ${error.message}`);
      return [];
    }
  }
  async delPaste(key) {
    try {
      const response = await this.client.get("/tools/paste/v1", {
        params: {
          action: "delete",
          key: key
        }
      });
      return response.data || null;
    } catch (error) {
      console.error(`[ERROR] Gagal dalam 'WudysoftAPI.delPaste' untuk kunci ${key}: ${error.message}`);
      return false;
    }
  }
  async createEmail() {
    try {
      const response = await this.client.get("/mails/v9", {
        params: {
          action: "create"
        }
      });
      return response.data?.email;
    } catch (error) {
      console.error(`[ERROR] Gagal dalam 'WudysoftAPI.createEmail': ${error.message}`);
      throw error;
    }
  }
  async checkMessages(email) {
    try {
      const response = await this.client.get("/mails/v9", {
        params: {
          action: "message",
          email: email
        }
      });
      return response.data;
    } catch (error) {
      console.error(`[ERROR] Gagal dalam 'WudysoftAPI.checkMessages' untuk email ${email}: ${error.message}`);
      return null;
    }
  }
  async extractVerificationLink(email) {
    try {
      const messages = await this.checkMessages(email);
      if (!messages?.data?.[0]?.text_content) {
        return null;
      }
      const textContent = messages.data[0].text_content;
      const verifyLinkMatch = textContent.match(/https:\/\/nanobanana\.art\/api\/auth\/verify-email\?token=[^\s]+/);
      return verifyLinkMatch ? verifyLinkMatch[0] : null;
    } catch (error) {
      console.error(`[ERROR] Gagal mengekstrak link verifikasi: ${error.message}`);
      return null;
    }
  }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
class Sockvue {
  constructor() {
    this.wudysoft = new WudysoftAPI();
    this.token = null;
    this.sessionCookies = null;
  }
  random() {
    return Math.random().toString(36).substring(2);
  }
  generatePassword() {
    return this.random() + "@A1";
  }
  generateDeviceFingerprint() {
    return crypto.randomBytes(16).toString("hex");
  }
  createNanoBananaClient() {
    return axios.create({
      baseURL: "https://nanobanana.art/api",
      headers: {
        accept: "*/*",
        "accept-language": "id-ID",
        "content-type": "application/json",
        origin: "https://nanobanana.art",
        priority: "u=1, i",
        "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
        "x-device-fingerprint": this.generateDeviceFingerprint(),
        "x-initial-landing-page": "https://nanobanana.art/ai-image-effects/ai-figure-generator",
        "x-initial-referrer": "https://www.google.com/"
      }
    });
  }
  async register() {
    try {
      console.log("Memulai proses registrasi Nano Banana...");
      const email = await this.wudysoft.createEmail();
      if (!email) throw new Error("Gagal mendapatkan email temporary");
      console.log(`Email didapat: ${email}`);
      const password = this.generatePassword();
      const name = "User" + this.random().substring(0, 8);
      const nanoClient = this.createNanoBananaClient();
      const signupResponse = await nanoClient.post("/auth/sign-up/email", {
        email: email,
        password: password,
        name: name,
        callbackURL: "/"
      });
      console.log("Registrasi awal berhasil, menunggu verifikasi email...");
      let verifyLink = null;
      for (let i = 0; i < 60; i++) {
        console.log(`Menunggu email verifikasi (${i + 1}/60)...`);
        verifyLink = await this.wudysoft.extractVerificationLink(email);
        if (verifyLink) break;
        await sleep(3e3);
      }
      if (!verifyLink) throw new Error("Gagal mendapatkan link verifikasi");
      await axios.get(verifyLink, {
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "accept-language": "id-ID",
          "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
        }
      });
      console.log("Email berhasil diverifikasi");
      const loginResponse = await nanoClient.post("/auth/sign-in/email", {
        mode: "password",
        email: email,
        password: password
      });
      this.token = loginResponse.data?.token;
      if (!this.token) throw new Error("Gagal mendapatkan token setelah login");
      this.sessionCookies = `__Secure-better-auth.session_token=${this.token}; NEXT_LOCALE=en`;
      console.log("Login berhasil, melakukan checkin...");
      await nanoClient.post("/checkin", {}, {
        headers: {
          cookie: this.sessionCookies,
          referer: "https://nanobanana.art/"
        }
      });
      const sessionData = {
        token: this.token,
        email: email,
        password: password,
        cookies: this.sessionCookies,
        createdAt: new Date().toISOString()
      };
      const sessionTitle = `nanobanana-session-${this.random()}`;
      const sessionKey = await this.wudysoft.createPaste(sessionTitle, JSON.stringify(sessionData));
      if (!sessionKey) throw new Error("Gagal menyimpan session");
      console.log(`Registrasi berhasil! Key: ${sessionKey}`);
      return {
        success: true,
        key: sessionKey,
        email: email,
        message: "Registrasi Nano Banana berhasil"
      };
    } catch (error) {
      console.error("Error dalam registrasi:", error.response?.data || error.message);
      throw error;
    }
  }
  async loadSession(key) {
    try {
      const sessionData = await this.wudysoft.getPaste(key);
      if (!sessionData) {
        throw new Error("Session tidak ditemukan");
      }
      const session = JSON.parse(sessionData);
      this.token = session.token;
      this.sessionCookies = session.cookies;
      return session;
    } catch (error) {
      console.error("Error loading session:", error.message);
      throw error;
    }
  }
  async generate({
    key,
    prompt,
    imageUrl,
    mode = "edit",
    aspectRatio = "16:9"
  }) {
    try {
      if (!key) {
        console.log("Key tidak ditemukan, mendaftarkan sesi baru secara otomatis...");
        const registrationResult = await this.register();
        key = registrationResult.key;
        if (!key) {
          throw new Error("Gagal mendaftarkan sesi baru. Proses dibatalkan.");
        }
      }
      await this.loadSession(key);
      const nanoClient = this.createNanoBananaClient();
      const isUrl = s => typeof s === "string" && (s.startsWith("http://") || s.startsWith("https://"));
      const isBase64 = s => {
        if (typeof s !== "string") return false;
        const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
        const coreBase64 = s.split(",").pop();
        return base64Regex.test(coreBase64);
      };
      const getMimeTypeFromBuffer = buffer => {
        if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
          return {
            mime: "image/jpeg",
            ext: "jpg"
          };
        }
        if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71) {
          return {
            mime: "image/png",
            ext: "png"
          };
        }
        return {
          mime: "image/jpeg",
          ext: "jpg"
        };
      };
      const uploadedImageUrls = [];
      if (imageUrl) {
        const images = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
        for (const imageInput of images) {
          try {
            let imageDataBuffer;
            let contentType = null;
            if (Buffer.isBuffer(imageInput)) {
              console.log("Memproses input Buffer...");
              imageDataBuffer = imageInput;
            } else if (isBase64(imageInput)) {
              console.log("Memproses input Base64...");
              const parts = imageInput.split(",");
              if (parts.length > 1 && parts[0].startsWith("data:")) {
                contentType = parts[0].split(":")[1].split(";")[0];
              }
              imageDataBuffer = Buffer.from(parts.pop(), "base64");
            } else if (isUrl(imageInput)) {
              console.log(`Mengunduh gambar dari URL: ${imageInput}`);
              const response = await axios.get(imageInput, {
                responseType: "arraybuffer"
              });
              imageDataBuffer = response.data;
              contentType = response.headers["content-type"];
            } else {
              console.warn("Format imageUrl tidak dikenali, item dilewati.");
              continue;
            }
            let fileExtension;
            if (!contentType || !contentType.startsWith("image/")) {
              const typeInfo = getMimeTypeFromBuffer(imageDataBuffer);
              contentType = typeInfo.mime;
              fileExtension = typeInfo.ext;
            } else {
              fileExtension = contentType.split("/")[1] || "jpg";
            }
            console.log(`Content-Type yang digunakan: ${contentType}`);
            const timestamp = Date.now();
            const filename = `${timestamp}-${this.random()}.${fileExtension}`;
            const signedUrlResponse = await nanoClient.post(`/uploads/signed-upload-url?bucket=images&path=%2F${filename}`, {}, {
              headers: {
                cookie: this.sessionCookies
              }
            });
            const signedUrl = signedUrlResponse.data?.signedUrl;
            if (!signedUrl) {
              console.error("Gagal mendapatkan signed URL.");
              continue;
            }
            await axios.put(signedUrl, imageDataBuffer, {
              headers: {
                "Content-Type": contentType,
                "Content-Length": imageDataBuffer.length
              }
            });
            const uploadedUrl = `https://nano-banana.s3.us-east-1.amazonaws.com/images//${filename}`;
            uploadedImageUrls.push(uploadedUrl);
            console.log(`Berhasil mengunggah gambar ke: ${uploadedUrl}`);
          } catch (uploadError) {
            console.error("Gagal memproses satu item gambar:", uploadError.message);
          }
        }
      }
      const generatePayload = {
        prompt: prompt,
        mode: mode,
        aspectRatio: aspectRatio,
        model: "nano-banana",
        outputFormat: "jpeg",
        enableTranslation: true,
        promptUpsampling: false,
        safetyTolerance: 2,
        uploadCn: false
      };
      if (uploadedImageUrls.length > 0) {
        generatePayload.inputImages = uploadedImageUrls;
      }
      const generateResponse = await nanoClient.post("/generate-image", generatePayload, {
        headers: {
          cookie: this.sessionCookies
        }
      });
      const imageId = generateResponse.data?.data?.uuid;
      if (!imageId) throw new Error("Gagal memulai proses generate");
      console.log("Proses generate dimulai, menunggu hasil...");
      let result = null;
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 3e3));
        const statusResponse = await nanoClient.post("/get-image", {
          image_id: imageId
        }, {
          headers: {
            cookie: this.sessionCookies
          }
        });
        const imageData = statusResponse.data?.data;
        if (imageData?.status === 3 && imageData?.image_url) {
          result = imageData;
          break;
        } else if (imageData?.status === 2) {
          console.log(`Masih memproses... (${i + 1}/30)`);
        } else if (imageData?.status === 4) {
          throw new Error("Generate gagal");
        }
      }
      if (!result) throw new Error("Timeout menunggu hasil generate");
      return {
        success: true,
        image_url: result.image_url,
        prompt: result.prompt,
        id: result.uuid,
        details: result
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error("Error dalam proses generate:", errorMessage);
      throw new Error(`Proses generate gagal: ${errorMessage}`);
    }
  }
  async list_key() {
    try {
      const allPastes = await this.wudysoft.listPastes();
      const nanoKeys = allPastes.filter(paste => paste.title && paste.title.startsWith("nanobanana-session-")).map(paste => ({
        key: paste.key,
        title: paste.title,
        created: paste.created_at
      }));
      return nanoKeys;
    } catch (error) {
      console.error("Error listing keys:", error.message);
      throw error;
    }
  }
  async del_key({
    key
  }) {
    try {
      if (!key) {
        throw new Error("Key diperlukan");
      }
      const result = await this.wudysoft.delPaste(key);
      return {
        success: true,
        message: `Key ${key} berhasil dihapus`
      };
    } catch (error) {
      console.error("Error deleting key:", error.message);
      throw error;
    }
  }
}
export default async function handler(req, res) {
  const {
    action,
    ...params
  } = req.method === "POST" ? req.body : req.query;
  if (!action) {
    return res.status(400).json({
      error: "Parameter 'action' wajib diisi. Pilihan: register, generate, list_key, del_key"
    });
  }
  const sockvue = new Sockvue();
  try {
    let result;
    switch (action) {
      case "register":
        result = await sockvue.register();
        break;
      case "generate":
        if (!params.prompt) {
          return res.status(400).json({
            error: "Parameter 'prompt' wajib untuk generate"
          });
        }
        result = await sockvue.generate(params);
        break;
      case "list_key":
        result = await sockvue.list_key();
        break;
      case "del_key":
        if (!params.key) {
          return res.status(400).json({
            error: "Parameter 'key' wajib untuk del_key"
          });
        }
        result = await sockvue.del_key(params);
        break;
      default:
        return res.status(400).json({
          error: `Action '${action}' tidak dikenali`
        });
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error(`Error dalam action ${action}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      action: action
    });
  }
}