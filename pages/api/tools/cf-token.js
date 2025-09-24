import axios from "axios";
class CaptchaSolver {
  constructor() {
    this.config = {
      v1: {
        baseUrl: "https://api.paxsenix.org/tools/"
      },
      v2: {
        baseUrl: "https://anabot.my.id/api/tools/bypass"
      }
    };
  }
  async run({
    url,
    sitekey,
    ver = "v2",
    act = "turnstile",
    type = "turnstile-min",
    ...rest
  }) {
    try {
      let result = {};
      if (ver === "v1") {
        const endpoint = {
          turnstile: "cf-turnstile-solver",
          hcaptcha: "hcaptcha-invisible-solver",
          recaptchav3: "recaptchav3-invis-solver"
        } [act] || "cf-turnstile-solver";
        const apiUrl = `${this.config.v1.baseUrl}${endpoint}`;
        const response = await axios.get(apiUrl, {
          params: {
            url: url,
            sitekey: sitekey
          },
          headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"
          }
        });
        const token = response.data?.solution_token;
        if (response.data?.ok && token) {
          result = {
            token: token,
            ver: ver,
            act: act
          };
        } else {
          const message = response.data?.message || "Respons tidak valid atau token tidak ditemukan";
          throw new Error(`Penyelesaian captcha Paxsenix gagal: ${message}`);
        }
      } else if (ver === "v2") {
        const params = {
          url: url,
          siteKey: sitekey,
          type: type,
          apikey: "freeApikey",
          ...rest
        };
        const response = await axios.get(this.config.v2.baseUrl, {
          params: params,
          headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"
          }
        });
        const token = response.data?.data?.result?.token;
        if (response.data?.success && token) {
          result = {
            token: token,
            ver: ver,
            act: type
          };
        } else {
          throw new Error("Penyelesaian captcha Anabot gagal: Respons tidak berhasil atau token tidak ditemukan");
        }
      } else {
        throw new Error(`Versi API tidak didukung: ${ver}`);
      }
      return result;
    } catch (error) {
      throw error;
    }
  }
}
export default async function handler(req, res) {
  const params = req.method === "GET" ? req.query : req.body;
  if (!params.sitekey || !params.url) {
    return res.status(400).json({
      error: "sitekey and url are required for CaptchaSolver."
    });
  }
  try {
    const solver = new CaptchaSolver();
    const response = await solver.run(params);
    return res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Internal Server Error"
    });
  }
}