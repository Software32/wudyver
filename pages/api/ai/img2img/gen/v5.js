import axios from "axios";
import https from "https";
import OSS from "ali-oss";
import {
  v4 as uuidv4
} from "uuid";
import SpoofHead from "@/lib/spoof-head";
import PROMPT from "@/configs/ai-prompt";
class NoteGpt {
  constructor() {
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true
    });
    this.sboxGuid = this.rnGuid();
    this.anonymousUserId = uuidv4();
    this.cookies = `i18n_redirected=en; sbox-guid=${this.sboxGuid}; anonymous_user_id=${this.anonymousUserId};`;
    this.api = axios.create({
      baseURL: "https://notegpt.io/api",
      httpsAgent: this.httpsAgent,
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "id-ID",
        "content-type": "application/json; charset=UTF-8",
        origin: "https://notegpt.io",
        priority: "u=1, i",
        referer: "https://notegpt.io/ai-image-editor",
        "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
        cookie: this.cookies,
        ...SpoofHead()
      }
    });
    this.ossClient = null;
    this.stsToken = null;
  }
  rnGuid() {
    const timestamp = Math.floor(Date.now() / 1e3);
    const randomNum = this.rnNum(3);
    const randomLong = this.rnNum(9);
    return `MTc1ODAyNjQxNHw${randomNum}f${randomLong}`;
  }
  rnNum(length) {
    return Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, "0");
  }
  async sts() {
    console.log("Proses: Mendapatkan token STS...");
    try {
      const response = await axios.get("https://notegpt.io/api/v1/oss/sts-token", {
        httpsAgent: this.httpsAgent,
        headers: {
          accept: "*/*",
          "accept-language": "id-ID",
          cookie: this.cookies,
          priority: "u=1, i",
          referer: "https://notegpt.io/ai-image-editor",
          "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
          "x-token": "",
          ...SpoofHead()
        },
        timeout: 1e4
      });
      const responseData = response.data;
      const tokenData = responseData?.data;
      if (!tokenData) {
        console.error("Response data:", responseData);
        throw new Error("Token STS tidak ditemukan dalam response");
      }
      this.stsToken = tokenData;
      console.log("Proses: Token STS berhasil didapatkan.");
      return tokenData;
    } catch (error) {
      console.error("Error saat mendapatkan token STS:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
      throw error;
    }
  }
  async initOSSClient(stsToken) {
    if (!this.ossClient || !this.isTokenValid(stsToken)) {
      console.log("Menginisialisasi OSS client...");
      this.ossClient = new OSS({
        region: "oss-us-west-1",
        endpoint: "https://oss-us-west-1.aliyuncs.com",
        accessKeyId: stsToken.AccessKeyId,
        accessKeySecret: stsToken.AccessKeySecret,
        stsToken: stsToken.SecurityToken,
        bucket: "nc-cdn",
        secure: true,
        timeout: 3e4
      });
    }
    return this.ossClient;
  }
  isTokenValid(token) {
    if (!token || !token.Expiration) return false;
    const expirationTime = new Date(token.Expiration).getTime();
    const currentTime = Date.now();
    return expirationTime > currentTime + 6e4;
  }
  async upload(imageUrl, stsToken) {
    console.log("Proses: Mengunggah gambar...");
    try {
      let imageBuffer;
      if (typeof imageUrl === "string" && imageUrl.startsWith("http")) {
        const response = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          httpsAgent: this.httpsAgent,
          timeout: 15e3
        });
        imageBuffer = Buffer.from(response.data);
      } else if (typeof imageUrl === "string") {
        imageBuffer = Buffer.from(imageUrl, "base64");
      } else if (imageUrl instanceof Buffer) {
        imageBuffer = imageUrl;
      } else {
        throw new Error("Format imageUrl tidak valid");
      }
      const fileName = `notegpt/web3in1/${uuidv4()}.jpg`;
      const client = await this.initOSSClient(stsToken);
      console.log("Mengupload ke OSS...");
      const result = await client.put(fileName, imageBuffer, {
        headers: {
          "Content-Type": "image/jpeg"
        },
        timeout: 3e4
      });
      console.log("Proses: Gambar berhasil diunggah ke:", result.url);
      return result.url;
    } catch (error) {
      console.error("Error saat mengunggah gambar:", error.message);
      throw error;
    }
  }
  async task(prompt, uploadedImageUrl, rest) {
    console.log("Proses: Membuat tugas pemrosesan gambar...");
    try {
      const payload = {
        image_url: uploadedImageUrl,
        type: rest.type || 60,
        user_prompt: prompt,
        aspect_ratio: rest.aspect_ratio || "match_input_image",
        num: rest.num ?? 1,
        model: rest.model || "google/nano-banana",
        sub_type: rest.sub_type ?? 3
      };
      const response = await axios.post("https://notegpt.io/api/v2/images/handle", payload, {
        httpsAgent: this.httpsAgent,
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json; charset=UTF-8",
          cookie: this.cookies,
          origin: "https://notegpt.io",
          referer: "https://notegpt.io/ai-image-editor",
          "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
          ...SpoofHead()
        },
        timeout: 15e3
      });
      const sessionId = response.data?.data?.session_id;
      if (!sessionId) {
        console.error("Response data:", response.data);
        throw new Error("Session ID tidak ditemukan dalam response");
      }
      console.log(`Proses: Tugas berhasil dibuat dengan session_id: ${sessionId}`);
      return sessionId;
    } catch (error) {
      console.error("Error saat membuat tugas:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
      throw error;
    }
  }
  async poll(sessionId) {
    console.log(`Proses: Memulai polling untuk session_id: ${sessionId}...`);
    const maxAttempts = 20;
    let attempts = 0;
    try {
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 3e3));
        console.log(`Proses: Mengecek status untuk session_id: ${sessionId} (percobaan ${attempts}/${maxAttempts})...`);
        const response = await axios.get(`https://notegpt.io/api/v2/images/status?session_id=${sessionId}`, {
          httpsAgent: this.httpsAgent,
          headers: {
            accept: "application/json, text/plain, */*",
            cookie: this.cookies,
            referer: "https://notegpt.io/ai-image-editor",
            "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
            ...SpoofHead()
          },
          timeout: 1e4
        });
        const statusData = response.data?.data;
        if (!statusData) {
          console.error("Response data:", response.data);
          throw new Error("Data status tidak ditemukan dalam response");
        }
        const status = statusData.status;
        console.log(`Proses: Status saat ini: ${status}`);
        if (status === "succeeded") {
          console.log("Proses: Polling berhasil, tugas selesai.");
          return statusData.results;
        } else if (status === "failed") {
          throw new Error("Pemrosesan gambar di server gagal.");
        }
      }
      throw new Error("Polling timeout - tugas tidak selesai dalam waktu yang ditentukan");
    } catch (error) {
      console.error("Error saat polling:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
      throw error;
    }
  }
  async generate({
    prompt = PROMPT.text,
    imageUrl,
    ...rest
  }) {
    const maxRetries = 60;
    let retries = 0;
    while (retries < maxRetries) {
      try {
        console.log(`\n--- Memulai Proses Generate (Percobaan ${retries + 1}/${maxRetries}) ---`);
        this.sboxGuid = this.rnGuid();
        this.anonymousUserId = uuidv4();
        this.cookies = `i18n_redirected=en; sbox-guid=${this.sboxGuid}; anonymous_user_id=${this.anonymousUserId};`;
        const token = await this.sts();
        const uploadedUrl = await this.upload(imageUrl, token);
        const sessionId = await this.task(prompt, uploadedUrl, rest);
        const result = await this.poll(sessionId);
        console.log("--- Proses Generate Selesai ---");
        return result;
      } catch (error) {
        retries++;
        console.error(`Percobaan ${retries} gagal:`, error.message);
        if (retries >= maxRetries) {
          console.error("Semua percobaan gagal.");
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 3e3));
      }
    }
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
    const api = new NoteGpt();
    const response = await api.generate(params);
    return res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Internal Server Error"
    });
  }
}