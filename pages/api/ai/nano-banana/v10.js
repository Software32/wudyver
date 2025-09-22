import axios from "axios";
import FormData from "form-data";
import SpoofHead from "@/lib/spoof-head";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
class AinanobananaAPI {
  constructor() {
    this.api = axios.create({
      baseURL: "https://ainanobanana.ai/api/",
      headers: {
        accept: "*/*",
        "accept-language": "id-ID",
        origin: "https://ainanobanana.ai",
        referer: "https://ainanobanana.ai/dashboard",
        "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
        ...SpoofHead()
      }
    });
    console.log("API client initialized");
  }
  async _upload(imageUrl) {
    console.log(`Uploading image from: ${imageUrl}`);
    try {
      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer"
      });
      const imageBuffer = Buffer.from(imageResponse.data, "binary");
      const form = new FormData();
      form.append("image", imageBuffer, "image.jpg");
      const uploadResponse = await this.api.post("/upload/image", form, {
        headers: form.getHeaders()
      });
      const uploadedUrl = uploadResponse.data?.url;
      if (!uploadedUrl) {
        throw new Error("Image URL not found in upload response.");
      }
      console.log(`Image uploaded successfully, URL: ${uploadedUrl}`);
      return uploadedUrl;
    } catch (error) {
      console.error("Image upload failed:", error.message);
      throw new Error(error.response?.data?.error || "Failed to upload image");
    }
  }
  async _poll(taskId) {
    console.log(`Polling for taskId: ${taskId}`);
    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      try {
        const response = await this.api.get(`image/status/${taskId}`);
        const status = response.data?.status;
        console.log(`Poll attempt ${attempts + 1}: Status is ${status}`);
        if (status === 1) {
          console.log("Processing finished successfully.");
          return response.data;
        } else if (status === 2) {
          console.error("Processing failed.");
          throw new Error(response.data?.error || "Generation failed with status 2");
        }
        attempts++;
        await sleep(3e3);
      } catch (error) {
        console.error("Error during polling:", error.message);
        throw error;
      }
    }
    throw new Error("Polling timed out.");
  }
  async img2img({
    prompt,
    imageUrl,
    ...rest
  }) {
    console.log("Starting img2img process...");
    try {
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("addWatermark", rest.addWatermark ?? "true");
      form.append("inputMode", "upload");
      const imageUrls = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        console.log(`Fetching image from ${url}...`);
        const imageResponse = await axios.get(url, {
          responseType: "arraybuffer"
        });
        const imageBuffer = Buffer.from(imageResponse.data, "binary");
        form.append("images", imageBuffer, {
          filename: `image${i}.png`,
          contentType: "image/png"
        });
      }
      console.log("Sending generation request for img2img...");
      const response = await this.api.post("image/generate", form, {
        headers: form.getHeaders()
      });
      const taskId = response.data?.taskId;
      console.log("Received taskId:", taskId);
      if (!taskId) {
        throw new Error("Failed to get taskId from response.");
      }
      return await this._poll(taskId);
    } catch (error) {
      console.error("Error in img2img:", error.message);
      throw new Error(error.response?.data?.error ? error.response.data.error : "An unknown error occurred in img2img");
    }
  }
  async txt2img({
    prompt,
    ...rest
  }) {
    console.log("Starting txt2img process...");
    try {
      const payload = {
        prompt: prompt,
        aspectRatio: rest.aspectRatio || "1:1"
      };
      console.log("Sending generation request with payload:", payload);
      const response = await this.api.post("text-to-image/generate", payload, {
        headers: {
          "Content-Type": "application/json"
        }
      });
      const taskId = response.data?.taskId;
      console.log("Received taskId:", taskId);
      if (!taskId) {
        throw new Error("Failed to get taskId from response.");
      }
      return await this._poll(taskId);
    } catch (error) {
      console.error("Error in txt2img:", error.message);
      throw new Error(error.response?.data?.error ?? "An unknown error occurred in txt2img");
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
      error: "Action is required."
    });
  }
  const api = new AinanobananaAPI();
  try {
    let response;
    switch (action) {
      case "img2img":
        if (!params.prompt || !params.imageUrl) {
          return res.status(400).json({
            error: "Prompt and imageUrl are required for img2img."
          });
        }
        response = await api.img2img(params);
        return res.status(200).json(response);
      case "txt2img":
        if (!params.prompt) {
          return res.status(400).json({
            error: "Prompt is required for txt2img."
          });
        }
        response = await api.txt2img(params);
        return res.status(200).json(response);
      default:
        return res.status(400).json({
          error: `Invalid action: ${action}. Supported actions are 'img2img', and 'txt2img'.`
        });
    }
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({
      error: error.message || "Internal Server Error"
    });
  }
}