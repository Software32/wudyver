import axios from "axios";
const FIGURE_PROMPT = "Using the nano-banana model, a commercial 1/7 scale figurine of the character in the picture was created, depicting a realistic style and a realistic environment. The figurine is placed on a computer desk with a round transparent acrylic base. There is no text on the base. The computer screen shows the Zbrush modeling process of the figurine. Next to the computer screen is a BANDAI-style toy box with the original painting printed on it.";
class NanoBananaAI {
  constructor(apiKey = null) {
    this.apiKey = apiKey || "05120a7d-66b6-4973-b8c4-d3604f7087e7:baef4baa908c8010604ade6d3076274b";
    this.baseURL = "https://queue.fal.run/fal-ai/gemini-25-flash-image";
    this.enableLogging = true;
  }
  log(message) {
    if (this.enableLogging) {
      console.log(`[NanoBananaAI LOG] ${message}`);
    }
  }
  async generate({
    imageUrl,
    prompt = FIGURE_PROMPT,
    numImages = 1,
    outputFormat = "jpeg"
  }) {
    if (!imageUrl || Array.isArray(imageUrl) && imageUrl.length === 0) {
      throw new Error("imageUrl (URL, Base64, atau Buffer, tunggal atau dalam array) diperlukan");
    }
    if (!prompt) throw new Error("prompt diperlukan untuk image editing");
    this.log(`Memulai proses image editing dengan prompt: "${prompt}"`);
    try {
      const urlsToProcess = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
      this.log(`Memproses ${urlsToProcess.length} gambar.`);
      const processedImageUrls = urlsToProcess.map((img, index) => {
        if (typeof img === "string") {
          this.log(`Input gambar #${index + 1} terdeteksi sebagai string (URL/Base64)`);
          return img;
        } else if (Buffer.isBuffer(img)) {
          const mimeType = "image/jpeg";
          this.log(`Input gambar #${index + 1} terdeteksi sebagai Buffer dan telah dikonversi ke Base64`);
          return `data:${mimeType};base64,${img.toString("base64")}`;
        } else {
          throw new Error(`Format imageUrl #${index + 1} tidak didukung. Gunakan URL, Base64, atau Buffer.`);
        }
      });
      this.log("Mengirim permintaan editing ke API...");
      const createResponse = await axios.post(`${this.baseURL}/edit`, {
        prompt: prompt,
        num_images: numImages,
        output_format: outputFormat,
        image_urls: processedImageUrls
      }, {
        headers: {
          Authorization: `Key ${this.apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "@fal-ai/client/1.6.2"
        }
      });
      const {
        status_url: statusUrl,
        response_url: responseUrl
      } = createResponse.data;
      if (!statusUrl || !responseUrl) {
        throw new Error("Gagal mendapatkan URL status atau response dari API");
      }
      this.log("Permintaan diterima, menunggu proses selesai...");
      let status = "WAIT";
      const maxAttempts = 60;
      for (let attempts = 1; attempts <= maxAttempts; attempts++) {
        const statusResponse = await axios.get(statusUrl, {
          headers: {
            Authorization: `Key ${this.apiKey}`,
            "User-Agent": "@fal-ai/client/1.6.2"
          }
        });
        status = statusResponse.data.status;
        this.log(`Status proses: ${status} (Percobaan ${attempts}/${maxAttempts})`);
        if (status === "COMPLETED") break;
        if (status === "FAILED") throw new Error("Proses editing gambar gagal di server.");
        if (attempts === maxAttempts) {
          throw new Error("Proses editing memakan waktu terlalu lama (timeout).");
        }
        await new Promise(resolve => setTimeout(resolve, 3e3));
      }
      this.log("Proses selesai, mengambil data hasil...");
      const resultResponse = await axios.get(responseUrl, {
        headers: {
          Authorization: `Key ${this.apiKey}`,
          "User-Agent": "@fal-ai/client/1.6.2"
        }
      });
      this.log("Image editing berhasil. Mengembalikan data gambar.");
      return resultResponse.data.images;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message;
      console.error("Terjadi error dalam proses image editing:", errorMessage);
      throw new Error(errorMessage);
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
    const api = new NanoBananaAI();
    const response = await api.generate(params);
    return res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Internal Server Error"
    });
  }
}