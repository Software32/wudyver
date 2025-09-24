import axios from "axios";
import crypto from "crypto";
import FormData from "form-data";
class OverchatAPI {
  constructor() {
    this.getRandomValues = crypto.getRandomValues.bind(crypto);
    this._SU = (t, n) => {
      let r = "";
      for (let e = 0; e < 16; e++) {
        const i = t[e];
        (n || e) && e % 4 === 0 && (r += "-");
        r += (i < 16 ? "0" : "") + i.toString(16);
      }
      return r;
    };
    this.getUuidV4 = n => {
      try {
        const t = new Uint8Array(16);
        this.getRandomValues(t);
        t[8] &= 63;
        t[8] |= 128;
        t[6] &= 15;
        t[6] |= 64;
        return this._SU(t, n);
      } catch (i) {
        return "";
      }
    };
    this.deviceUUID = this.getUuidV4();
    this.deviceVersion = "1.0.44";
    this.apiKey = "";
    this.baseURL = "https://widget-api.overchat.ai/v1";
    this.headers = {
      accept: "*/*",
      "accept-language": "id-ID,id;q=0.9",
      authorization: `Bearer ${this.apiKey}`,
      "cache-control": "no-cache",
      origin: "https://widget.overchat.ai",
      pragma: "no-cache",
      priority: "u=1, i",
      referer: "https://widget.overchat.ai/",
      "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24", "Microsoft Edge Simulate";v="131", "Lemur";v="131"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      "x-device-language": "id-ID",
      "x-device-platform": "web",
      "x-device-uuid": this.deviceUUID,
      "x-device-version": this.deviceVersion
    };
    this.userId = null;
  }
  async getId() {
    try {
      const response = await axios.get(`${this.baseURL}/auth/me`, {
        headers: this.headers
      });
      this.userId = response.data.id;
      return this.userId;
    } catch (error) {
      throw error;
    }
  }
  async createId(personaId = "best-free-ai-chat") {
    try {
      if (!this.userId) {
        await this.getId();
      }
      const response = await axios.post(`${this.baseURL}/chat/${this.userId}`, {
        personaId: personaId
      }, {
        headers: {
          ...this.headers,
          "content-type": "application/json"
        }
      });
      return response.data.id;
    } catch (error) {
      throw error;
    }
  }
  async downloadImage(imageUrl) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer"
      });
      const contentType = response.headers["content-type"] || "application/octet-stream";
      const filename = imageUrl.substring(imageUrl.lastIndexOf("/") + 1);
      return {
        buffer: Buffer.from(response.data),
        filename: filename,
        contentType: contentType
      };
    } catch (error) {
      throw new Error(`Failed to download image from URL: ${imageUrl}, Error: ${error.message}`);
    }
  }
  async uploadImage(fileBuffer, filename, contentType = "image/png") {
    try {
      const formData = new FormData();
      formData.append("file", fileBuffer, {
        filename: filename,
        contentType: contentType
      });
      const response = await axios.post(`${this.baseURL}/chat/upload`, formData, {
        headers: {
          ...this.headers,
          "content-type": `multipart/form-data; boundary=${formData._boundary}`
        }
      });
      return response.data;
    } catch (error) {
      console.error("Error uploading image:", error.response ? error.response.data : error.message);
      throw error;
    }
  }
  async chat({
    chatId,
    prompt,
    messages,
    model,
    personaId,
    mode = "chat",
    frequency_penalty = 0,
    max_tokens = 2048,
    presence_penalty = 0,
    stream = false,
    temperature = .5,
    top_p = .95,
    imageUrl,
    imageUrls = [],
    endpointType = "thread",
    ...rest
  }) {
    try {
      if (!this.userId) {
        await this.getId();
      }
      let requestEndpoint = "";
      let requestData = {};
      let isImageMode = mode.toLowerCase() === "image";
      if (isImageMode) {
        if (!prompt) {
          throw new Error("Prompt is required for image generation.");
        }
        requestEndpoint = `${this.baseURL}/images/generations`;
        requestData = {
          chatId: chatId,
          prompt: prompt,
          model: model || "alibaba/qwen-image",
          personaId: personaId || "qwen-image",
          ...rest
        };
      } else {
        requestEndpoint = endpointType === "thread" ? `${this.baseURL}/chat/thread` : `${this.baseURL}/chat/completions`;
        requestData = {
          model: model || "x-ai/gpt-4.1",
          personaId: personaId || "grok-3-beta-mini",
          frequency_penalty: frequency_penalty,
          max_tokens: max_tokens,
          presence_penalty: presence_penalty,
          stream: stream,
          temperature: temperature,
          top_p: top_p,
          ...rest
        };
        const allImageUrls = [];
        if (typeof imageUrl === "string" && imageUrl) allImageUrls.push(imageUrl);
        if (Array.isArray(imageUrls) && imageUrls.length > 0) allImageUrls.push(...imageUrls);
        let uploadedFilesInfo = [];
        let messageLinks = [];
        if (allImageUrls.length > 0) {
          if (endpointType === "completions") {
            console.warn("Warning: Image uploads are not supported for the 'completions' endpoint and will be ignored.");
          } else {
            for (const url of allImageUrls) {
              const downloadedFile = await this.downloadImage(url);
              const uploadResult = await this.uploadImage(downloadedFile.buffer, downloadedFile.filename, downloadedFile.contentType);
              uploadedFilesInfo.push({
                path: downloadedFile.filename,
                link: uploadResult.link,
                croppedImageLink: uploadResult.croppedImageLink
              });
              messageLinks.push(uploadResult.link);
            }
          }
        }
        if (prompt) {
          requestData.messages = [{
            id: crypto.randomUUID(),
            role: "user",
            content: prompt
          }];
          if (endpointType === "thread" && uploadedFilesInfo.length > 0) {
            requestData.messages[0].metadata = {
              files: uploadedFilesInfo
            };
          }
        } else if (messages) {
          requestData.messages = messages.map(msg => ({
            ...msg,
            id: msg.id || crypto.randomUUID()
          }));
          if (endpointType === "thread" && uploadedFilesInfo.length > 0) {
            const lastUserMessageIndex = requestData.messages.findLastIndex(msg => msg.role === "user");
            if (lastUserMessageIndex !== -1) {
              if (!requestData.messages[lastUserMessageIndex].metadata) requestData.messages[lastUserMessageIndex].metadata = {};
              if (!requestData.messages[lastUserMessageIndex].metadata.files) requestData.messages[lastUserMessageIndex].metadata.files = [];
              requestData.messages[lastUserMessageIndex].metadata.files.push(...uploadedFilesInfo);
            }
          }
        } else {
          throw new Error("You must provide a 'prompt', a 'messages' array, or 'imageUrl(s)'.");
        }
        if (endpointType === "thread") {
          let currentChatId = chatId;
          if (!currentChatId) {
            currentChatId = await this.createId(requestData.personaId);
          }
          requestData.chatId = currentChatId;
          if (messageLinks.length > 0) {
            requestData.links = messageLinks;
          }
        }
      }
      const response = await axios.post(requestEndpoint, requestData, {
        headers: {
          ...this.headers,
          "content-type": "application/json"
        }
      });
      return isImageMode ? response.data : this.processChatResponse(response.data);
    } catch (error) {
      console.error("Error in chat function:", error.response ? error.response.data : error.message);
      throw error;
    }
  }
  processChatResponse(responseString) {
    if (typeof responseString !== "string") {
      return responseString;
    }
    const lines = responseString.trim().split("\n");
    const result = {
      result: "",
      array: []
    };
    for (const line of lines) {
      if (line.startsWith("data:")) {
        try {
          const dataJson = line.substring(5).trim();
          if (dataJson === "[DONE]") {
            break;
          }
          const data = JSON.parse(dataJson);
          if (data?.choices?.[0]?.delta?.content) {
            result.result += data.choices[0].delta.content;
            result.array.push(data.choices[0].delta.content);
          }
        } catch (parseError) {
          console.error("Failed to parse streaming data:", parseError, line);
        }
      }
    }
    return result;
  }
}
export default async function handler(req, res) {
  const params = req.method === "GET" ? req.query : req.body;
  if (!params.prompt) {
    return res.status(400).json({
      error: "Parameter 'prompt' is required."
    });
  }
  try {
    const overchat = new OverchatAPI();
    const result = await overchat.chat(params);
    return res.status(200).json(result);
  } catch (error) {
    console.error("API Handler Error:", error);
    res.status(500).json({
      error: error.message || "Internal Server Error"
    });
  }
}