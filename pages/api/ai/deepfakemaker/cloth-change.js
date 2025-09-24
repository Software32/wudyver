import axios from "axios";
import crypto from "crypto";
import CryptoJS from "crypto-js";
import FormData from "form-data";
import SpoofHead from "@/lib/spoof-head";
class SignatureGenerator {
  constructor() {
    this.publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCwlO+boC6cwRo3UfXVBadaYwcX
0zKS2fuVNY2qZ0dgwb1NJ+/Q9FeAosL4ONiosD71on3PVYqRUlL5045mvH2K9i8b
AFVMEip7E6RMK6tKAAif7xzZrXnP1GZ5Rijtqdgwh+YmzTo39cuBCsZqK9oEoeQ3
r/myG9S+9cR5huTuFQIDAQAB
-----END PUBLIC KEY-----`;
  }
  generateRandomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz01234_";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  aesEncrypt(text, key) {
    const keyUtf8 = CryptoJS.enc.Utf8.parse(key);
    const iv = keyUtf8;
    const encrypted = CryptoJS.AES.encrypt(text, keyUtf8, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.toString();
  }
  rsaEncrypt(text) {
    const buffer = Buffer.from(text, "utf8");
    const encrypted = crypto.publicEncrypt({
      key: this.publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, buffer);
    return encrypted.toString("base64");
  }
}
class DeepFakeAPI {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || "https://api.deepfakemaker.io";
    this.pollInterval = config.pollInterval || 3e3;
    this.maxPollAttempts = config.maxPollAttempts || 100;
    this.appId = "aifaceswap";
    this.fingerprint = "817ddfb1-ea6c-4e07-b37d-3aa9281e4fb7";
    this.originFrom = "7cc7af6c758b6e74";
    this.themeVersion = "83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q";
    this.signatureGenerator = new SignatureGenerator();
    this.baseHeaders = {
      accept: "application/json, text/plain, */*",
      "accept-language": "id-ID",
      origin: "https://deepfakemaker.io",
      referer: "https://deepfakemaker.io/",
      priority: "u=1, i",
      "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
      ...SpoofHead()
    };
  }
  generateApiHeaders() {
    const aesSecret = this.signatureGenerator.generateRandomString(16);
    const secret_key = this.signatureGenerator.rsaEncrypt(aesSecret);
    const fp1Text = `${this.appId}:${this.fingerprint}`;
    const fp1 = this.signatureGenerator.aesEncrypt(fp1Text, aesSecret);
    return {
      ...this.baseHeaders,
      "content-type": "application/json",
      fp: this.fingerprint,
      fp1: fp1,
      "x-guide": secret_key,
      "x-code": new Date().getTime().toString(),
      "theme-version": this.themeVersion
    };
  }
  generateUploadHeaders(boundary) {
    const nonce = crypto.randomUUID();
    const aesSecret = this.signatureGenerator.generateRandomString(16);
    const secret_key = this.signatureGenerator.rsaEncrypt(aesSecret);
    const textToSign = `${this.appId}:${nonce}:${secret_key}`;
    const sign = this.signatureGenerator.aesEncrypt(textToSign, aesSecret);
    return {
      ...this.baseHeaders,
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "x-guide": secret_key,
      "x-sign": sign,
      "x-code": new Date().getTime().toString(),
      "theme-version": this.themeVersion
    };
  }
  async handleImage(imageUrl) {
    try {
      if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
        throw new Error("Hanya URL gambar publik yang didukung.");
      }
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer"
      });
      return Buffer.from(response.data, "binary");
    } catch (error) {
      console.error("Gagal mengambil gambar dari URL:", error.message);
      throw new Error("Gagal mengunduh gambar.");
    }
  }
  async uploadImg(imageUrl, fnName) {
    console.log("📤 Mengunggah gambar untuk:", fnName);
    const imageBuffer = await this.handleImage(imageUrl);
    const form = new FormData();
    form.append("file", imageBuffer, {
      filename: `image-${Date.now()}.jpg`,
      contentType: "image/jpeg"
    });
    form.append("fn_name", fnName);
    form.append("request_from", "4");
    form.append("origin_from", this.originFrom);
    const headers = this.generateUploadHeaders(form.getBoundary());
    try {
      const {
        data: result
      } = await axios.post(`${this.baseUrl}/aitools/upload-img`, form, {
        headers: headers
      });
      if (result?.code !== 200) throw new Error(result?.message || "Gagal mengunggah");
      console.log("✅ Gambar diunggah:", result.data?.path);
      return result.data?.path;
    } catch (error) {
      console.log("❌ Kesalahan unggah:", error.message);
      throw error;
    }
  }
  async createTask(fnName, input) {
    console.log("🎯 Membuat tugas:", fnName);
    const payload = {
      fn_name: fnName,
      call_type: 3,
      input: {
        ...input,
        request_from: 4,
        type: 1
      },
      request_from: 4,
      origin_from: this.originFrom
    };
    const headers = this.generateApiHeaders();
    try {
      const {
        data: result
      } = await axios.post(`${this.baseUrl}/aitools/of/create`, payload, {
        headers: headers
      });
      if (result?.code !== 200) throw new Error(result?.message || "Pembuatan tugas gagal");
      console.log("✅ Tugas dibuat:", result.data?.task_id);
      return result.data;
    } catch (error) {
      console.log("❌ Kesalahan pembuatan tugas:", error.message);
      throw error;
    }
  }
  async status({
    task_id: taskId,
    fnName = "cloth-change"
  }) {
    const payload = {
      task_id: taskId,
      fn_name: fnName,
      call_type: 3,
      consume_type: 0,
      request_from: 4,
      origin_from: this.originFrom
    };
    const headers = this.generateApiHeaders();
    try {
      const {
        data: result
      } = await axios.post(`${this.baseUrl}/aitools/of/check-status`, payload, {
        headers: headers
      });
      if (result?.code !== 200) throw new Error(result?.message || "Pemeriksaan status gagal");
      return result.data;
    } catch (error) {
      console.log("❌ Kesalahan pemeriksaan status:", error.message);
      throw error;
    }
  }
  async generate({
    prompt,
    imageUrl,
    clothType = "full_outfits"
  }) {
    try {
      console.log("🎨 Memulai proses pembuatan");
      const imagePath = await this.uploadImg(imageUrl, "cloth-change");
      const taskData = await this.createTask("cloth-change", {
        source_image: imagePath,
        prompt: prompt,
        cloth_type: clothType
      });
      console.log("🎊 Pembuatan selesai dengan sukses");
      return taskData;
    } catch (error) {
      console.log("💥 Pembuatan gagal:", error.message);
      return {
        success: false,
        error: error.message
      };
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