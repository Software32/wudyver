import axios from "axios";
import crypto from "crypto";
import CryptoJS from "crypto-js";
const API_BASE_URL = "https://apiv1.deepfakemaker.io/api";
const APP_ID = "ai_df";
const SECRET_STRING = "NHGNy5YFz7HeFb";
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDa2oPxMZe71V4dw2r8rHWt59gH
W5INRmlhepe6GUanrHykqKdlIB4kcJiu8dHC/FJeppOXVoKz82pvwZCmSUrF/1yr
rnmUDjqUefDu8myjhcbio6CnG5TtQfwN2pz3g6yHkLgp8cFfyPSWwyOCMMMsTU9s
snOjvdDb4wiZI8x3UwIDAQAB
-----END PUBLIC KEY-----`;
class DeepFakeAPI {
  constructor() {
    this.userId = this._generateUserId();
    console.log(`Proses dimulai dengan User ID: ${this.userId}`);
  }
  _generateUserId() {
    return crypto.randomBytes(32).toString("hex");
  }
  _getAuthParams() {
    console.log("Membuat parameter otentikasi...");
    try {
      const timestamp = Math.floor(new Date().getTime() / 1e3);
      const nonce = crypto.randomBytes(16).toString("hex");
      const aesKey = crypto.randomBytes(8).toString("hex");
      const secretKeyEncrypted = crypto.publicEncrypt({
        key: PUBLIC_KEY,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, Buffer.from(aesKey, "utf8")).toString("base64");
      const stringToSign = `${APP_ID}:${SECRET_STRING}:${timestamp}:${nonce}:${secretKeyEncrypted}`;
      const key = CryptoJS.enc.Utf8.parse(aesKey);
      const iv = CryptoJS.enc.Utf8.parse(aesKey);
      const encrypted = CryptoJS.AES.encrypt(stringToSign, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      const sign = encrypted.toString();
      const authParams = {
        app_id: APP_ID,
        t: timestamp,
        nonce: nonce,
        sign: sign,
        secret_key: secretKeyEncrypted
      };
      console.log("Parameter otentikasi berhasil dibuat.");
      return authParams;
    } catch (error) {
      console.error("Gagal membuat parameter otentikasi:", error);
      throw new Error("Gagal dalam proses otentikasi.");
    }
  }
  async _getImageBuffer(imageSource) {
    console.log("Memproses sumber gambar...");
    if (Buffer.isBuffer(imageSource)) {
      console.log("Sumber gambar adalah Buffer.");
      return imageSource;
    }
    if (typeof imageSource === "string") {
      if (imageSource.startsWith("http")) {
        console.log("Mengunduh gambar dari URL...");
        const response = await axios.get(imageSource, {
          responseType: "arraybuffer"
        });
        return Buffer.from(response.data);
      }
      console.log("Mengonversi gambar dari Base64.");
      return Buffer.from(imageSource, "base64");
    }
    throw new Error("Format imageUrl tidak didukung. Harap gunakan URL, Base64, atau Buffer.");
  }
  async _upload(imageBuffer) {
    console.log("Memulai proses unggah gambar...");
    try {
      const imageHash = crypto.createHash("sha256").update(imageBuffer).digest("hex");
      const filename = `image_${Date.now()}.jpg`;
      console.log("Meminta URL unggah terotorisasi...");
      const signResponse = await axios.post(`${API_BASE_URL}/user/v2/upload-sign`, {
        filename: filename,
        hash: imageHash,
        user_id: this.userId
      }, {
        params: this._getAuthParams()
      });
      const uploadUrl = signResponse?.data?.data?.url;
      const objectName = signResponse?.data?.data?.object_name;
      if (!uploadUrl) throw new Error("Gagal mendapatkan URL unggah dari API.");
      console.log("URL unggah berhasil didapatkan.");
      console.log("Mengunggah gambar ke penyimpanan...");
      await axios.put(uploadUrl, imageBuffer, {
        headers: {
          "Content-Type": "image/jpeg"
        }
      });
      console.log("Gambar berhasil diunggah.");
      return `https://cdn.deepfakemaker.io/${objectName}`;
    } catch (error) {
      console.error("Proses unggah gagal:", error?.response?.data || error.message);
      throw new Error("Gagal mengunggah gambar.");
    }
  }
  async generate({
    prompt,
    imageUrl,
    ...rest
  }) {
    console.log(`\nMemulai tugas generasi dengan prompt: "${prompt}"`);
    try {
      const outputFormat = rest.outputFormat ? rest.outputFormat : "png";
      const imageBuffer = await this._getImageBuffer(imageUrl);
      const uploadedImageUrl = await this._upload(imageBuffer);
      console.log("Mengirim permintaan untuk membuat tugas...");
      const payload = {
        prompt: `Transform ${prompt}  into a high-quality Disney-style animated scene. Preserve all original details, including character appearance, clothing, composition, and background. Add soft lighting, expressive eyes, glowing atmosphere, magical sparkles, and a painterly fairytale aesthetic.Other ideas about how to edit my image`,
        output_format: outputFormat,
        aspect_ratio: "1:1",
        platform: "viking",
        image: uploadedImageUrl,
        user_id: this.userId,
        ...rest
      };
      const response = await axios.post(`${API_BASE_URL}/replicate/v1/free/flux/task`, payload, {
        params: this._getAuthParams()
      });
      const resultGen = response?.data || null;
      return resultGen;
    } catch (error) {
      console.error("Gagal membuat tugas:", error?.response?.data || error.message);
      return null;
    }
  }
  async status({
    task_id,
    ...rest
  }) {
    console.log(`\nMemeriksa status untuk ID tugas: ${task_id}`);
    if (!task_id) {
      console.error("ID tugas tidak disediakan.");
      return null;
    }
    try {
      const authParams = this._getAuthParams();
      const params = {
        ...authParams,
        task_id: task_id,
        user_id: this.userId,
        ...rest
      };
      console.log("Mengambil status tugas dari API...");
      const response = await axios.get(`${API_BASE_URL}/replicate/v1/free/flux/task`, {
        params: params
      });
      const resultTask = response?.data || null;
      return resultTask;
    } catch (error) {
      console.error("Gagal memeriksa status tugas:", error?.response?.data || error.message);
      return null;
    }
  }
}
export default async function handler(req, res) {
  const {
    action,
    ...params
  } = req.method === "GET" ? req.query : req.body;
  if (!action) {
    return res.status(400).json({
      error: "Action (create or status) is required."
    });
  }
  const api = new DeepFakeAPI();
  try {
    switch (action) {
      case "create":
        if (!params.prompt || !params.imageUrl) {
          return res.status(400).json({
            error: "Prompt and imageUrl are required for 'create' action."
          });
        }
        const createResponse = await api.generate(params);
        return res.status(200).json(createResponse);
      case "status":
        if (!params.task_id) {
          return res.status(400).json({
            error: "task_id is required for 'status' action."
          });
        }
        const statusResponse = await api.status(params);
        return res.status(200).json(statusResponse);
      default:
        return res.status(400).json({
          error: "Invalid action. Supported actions are 'create' and 'status'."
        });
    }
  } catch (error) {
    res.status(500).json({
      error: error.message || "Internal Server Error"
    });
  }
}