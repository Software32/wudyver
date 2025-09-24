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
    this.config = {
      endpoints: {
        flux: {
          task: `${API_BASE_URL}/replicate/v1/free/flux/task`,
          list: `${API_BASE_URL}/replicate/v1/free/flux/list`
        },
        nano_banana: {
          task: `${API_BASE_URL}/replicate/v1/free/nano/banana/task`
        },
        upload: `${API_BASE_URL}/user/v2/upload-sign`
      },
      platforms: {
        "ai-disney": "viking",
        img2img: "img2img",
        "nano-banana": "nano_banana"
      },
      statusCodes: {
        PENDING: 0,
        PROCESSING: 1,
        COMPLETED: 2,
        FAILED: 3
      }
    };
    console.log(`Proses dimulai dengan User ID: ${this.userId}`);
  }
  _generateUserId() {
    return crypto.randomBytes(32).toString("hex");
  }
  _getAuthParams() {
    console.log("Membuat parameter otentikasi...");
    try {
      const timestamp = Math.floor(Date.now() / 1e3);
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
      const signResponse = await axios.post(this.config.endpoints.upload, {
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
    mode = "img2img",
    ...rest
  }) {
    console.log(`\nMemulai tugas generasi [${mode}] dengan prompt: "${prompt}"`);
    try {
      const platform = this.config.platforms[mode] || mode;
      const outputFormat = rest.outputFormat || "png";
      let uploadedImageUrl = null;
      let uploadedImageUrls = [];
      if (imageUrl) {
        if (mode === "nano-banana") {
          const imageUrls = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
          for (const url of imageUrls) {
            const imageBuffer = await this._getImageBuffer(url);
            const uploadedUrl = await this._upload(imageBuffer);
            uploadedImageUrls.push(uploadedUrl);
          }
        } else {
          const imageBuffer = await this._getImageBuffer(imageUrl);
          uploadedImageUrl = await this._upload(imageBuffer);
        }
      }
      console.log(`Mengirim permintaan untuk membuat tugas [${mode}]...`);
      let payload = {
        prompt: prompt,
        output_format: outputFormat,
        platform: platform,
        user_id: this.userId,
        ...rest
      };
      if (mode === "ai-disney") {
        payload.prompt = `Transform ${prompt} into a high-quality Disney-style animated scene. Preserve all original details, including character appearance, clothing, composition, and background. Add soft lighting, expressive eyes, glowing atmosphere, magical sparkles, and a painterly fairytale aesthetic. Other ideas about how to edit my image`;
        payload.aspect_ratio = "1:1";
        payload.image = uploadedImageUrl;
      } else if (mode === "img2img") {
        payload.aspect_ratio = "match_input_image";
        payload.image = uploadedImageUrl;
      } else if (mode === "nano-banana") {
        payload.images = uploadedImageUrls;
      }
      let endpoint;
      if (mode === "nano-banana") {
        endpoint = this.config.endpoints.nano_banana.task;
      } else {
        endpoint = this.config.endpoints.flux.task;
      }
      const response = await axios.post(endpoint, payload, {
        params: this._getAuthParams()
      });
      const task_id = response?.data?.data?.task_id || null;
      return await this.autoPolling({
        task_id: task_id,
        mode: mode
      });
    } catch (error) {
      console.error(`Gagal membuat tugas [${mode}]:`, error?.response?.data || error.message);
      return null;
    }
  }
  async status({
    task_id,
    mode = "img2img",
    ...rest
  }) {
    console.log(`\nMemeriksa status [${mode}] untuk ID tugas: ${task_id}`);
    if (!task_id) {
      console.error("ID tugas tidak disediakan.");
      return null;
    }
    try {
      if (mode === "nano-banana") {
        const endpoint = this.config.endpoints.nano_banana.task;
        const params = {
          ...this._getAuthParams(),
          task_id: task_id,
          user_id: this.userId,
          ...rest
        };
        console.log("Mengambil status tugas [Banana] dari API...");
        const response = await axios.get(endpoint, {
          params: params
        });
        const result = response?.data || null;
        if (result && result.code === 2e4) {
          return {
            success: true,
            data: result.data,
            status: result.data.status || 0,
            progress: result.data.progress || 0,
            generate_url: result.data.generate_url,
            code: result.code,
            msg: result.msg
          };
        }
        return result;
      } else {
        const endpoint = this.config.endpoints.flux.list;
        const payload = {
          page: 1,
          page_count: 10,
          platform: [this.config.platforms[mode] || mode],
          user_id: this.userId,
          ...rest
        };
        console.log("Mengambil daftar tugas dari API...");
        const response = await axios.post(endpoint, payload, {
          params: this._getAuthParams()
        });
        const result = response?.data || null;
        if (result && result.data && Array.isArray(result.data)) {
          const task = result.data.find(t => t.job_id === task_id);
          if (task) {
            return {
              success: true,
              data: task,
              status: task.status,
              progress: task.status === this.config.statusCodes.COMPLETED ? 100 : 0,
              generate_url: task.generate_url,
              totalCount: result.totalCount
            };
          }
        }
        return {
          success: false,
          error: "Task not found",
          data: result
        };
      }
    } catch (error) {
      console.error(`Gagal memeriksa status tugas [${mode}]:`, error?.response?.data || error.message);
      return {
        success: false,
        error: error?.response?.data || error.message
      };
    }
  }
  async autoPolling({
    task_id,
    mode = "img2img",
    interval = 3e3,
    maxAttempts = 60
  }) {
    console.log(`Memulai auto-polling untuk tugas [${mode}] ID: ${task_id}`);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Polling attempt ${attempt}/${maxAttempts}`);
      try {
        const statusResult = await this.status({
          task_id: task_id,
          mode: mode
        });
        if (statusResult.success) {
          let taskData, progress, status, generate_url;
          if (mode === "nano-banana") {
            taskData = statusResult.data;
            progress = taskData.progress || 0;
            status = taskData.status;
            generate_url = taskData.generate_url;
          } else {
            taskData = statusResult.data;
            status = taskData.status;
            generate_url = taskData.generate_url;
            progress = status === this.config.statusCodes.COMPLETED ? 100 : status === this.config.statusCodes.PROCESSING ? 50 : 0;
          }
          console.log(`Progress: ${progress}%, Status: ${status}`);
          if (status === this.config.statusCodes.COMPLETED || generate_url) {
            console.log("Tugas selesai!");
            return {
              success: true,
              completed: true,
              data: taskData,
              generate_url: generate_url,
              progress: 100,
              status: status,
              attempt: attempt
            };
          }
          if (status === this.config.statusCodes.FAILED) {
            console.error("Tugas gagal!");
            return {
              success: false,
              completed: true,
              error: "Task failed",
              data: taskData,
              progress: progress,
              status: status,
              attempt: attempt
            };
          }
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, interval));
          }
        } else {
          console.error(`Status check failed: ${statusResult.error}`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, interval));
          }
        }
      } catch (error) {
        console.error(`Error pada polling attempt ${attempt}:`, error);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }
    }
    console.error("Auto-polling timeout setelah maksimum attempts");
    return {
      success: false,
      completed: false,
      error: "Timeout",
      attempt: maxAttempts
    };
  }
  getStatusText(statusCode) {
    const statusMap = {
      0: "Pending",
      1: "Processing",
      2: "Completed",
      3: "Failed"
    };
    return statusMap[statusCode] || "Unknown";
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
    const api = new DeepFakeAPI();
    const response = await api.generate(params);
    return res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Internal Server Error"
    });
  }
}