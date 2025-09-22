import axios from "axios";
import * as cheerio from "cheerio";
class StickerSearch {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: "https://stickers.wiki",
      headers: {
        Accept: "application/json, text/html",
        "Accept-Language": "id-ID",
        Referer: "https://stickers.wiki/telegram/search/",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
      }
    });
  }
  _parse(rawData) {
    const packs = [];
    if (!Array.isArray(rawData) || rawData.length < 3) return packs;
    const [positions, templateMap, ...allData] = rawData;
    if (!Array.isArray(positions) || typeof templateMap !== "object" || !templateMap) {
      console.warn("Format data tidak valid - positions atau templateMap tidak sesuai");
      return packs;
    }
    console.log(`Parsing ${positions.length} sticker packs...`);
    console.log("Template map:", templateMap);
    positions.forEach((startPos, index) => {
      try {
        const baseIndex = startPos - 1;
        const pack = {
          slug: allData[baseIndex] || null,
          title: allData[baseIndex + 1] || "Tanpa Judul",
          format: allData[baseIndex + 2] || "webp",
          total: allData[baseIndex + 3] || 0,
          id: allData[baseIndex + 4] || null
        };
        console.log(`Pack ${index + 1}:`, {
          startPos: startPos,
          baseIndex: baseIndex,
          slug: pack.slug,
          title: pack.title,
          total: pack.total,
          rawData: allData.slice(baseIndex, baseIndex + 6)
        });
        if (typeof pack.slug === "string" && pack.slug.trim() !== "") {
          packs.push(pack);
        } else {
          console.warn(`Pack pada posisi ${startPos} memiliki slug tidak valid:`, pack.slug);
        }
      } catch (error) {
        console.error(`Error parsing pack pada posisi ${startPos}:`, error.message);
      }
    });
    console.log(`Berhasil parsing ${packs.length} dari ${positions.length} packs`);
    return packs;
  }
  _parseCorrect(rawData) {
    const packs = [];
    if (!Array.isArray(rawData) || rawData.length < 3) return packs;
    const positions = rawData[0];
    const data = rawData.slice(2);
    positions.forEach((pos, index) => {
      const startIdx = pos - 1;
      const slug = data[startIdx];
      const title = data[startIdx + 1];
      const format = data[startIdx + 2];
      const total = data[startIdx + 3];
      const id = data[startIdx + 4];
      console.log(`Correct Parse ${index + 1}:`);
      console.log(`  Slug: "${slug}"`);
      console.log("  ---");
      if (typeof slug === "string" && slug.trim() !== "") {
        packs.push({
          slug: slug,
          title: title || "Tanpa Judul",
          format: format || "webp",
          total: total || 0,
          id: id || null
        });
      }
    });
    return packs;
  }
  async search({
    query,
    limit = 5,
    detail = true
  }) {
    console.log(`Memulai proses pencarian untuk: "${query}"`);
    try {
      const {
        data
      } = await this.axiosInstance.post("/_actions/searchTags/", {
        query: query
      }, {
        headers: {
          "Content-Type": "application/json"
        }
      });
      console.log("Raw data structure preview:", {
        length: data.length,
        positions: data[0],
        templateMap: data[1],
        firstFewElements: data.slice(2, 12)
      });
      let parsedResults = this._parse(data);
      if (parsedResults.length === 0) {
        console.log("Parsing utama gagal, mencoba correct parsing...");
        parsedResults = this._parseCorrect(data);
      }
      if (parsedResults.length === 0) {
        console.log("Semua metode parsing gagal - tidak ada hasil yang ditemukan");
        return [];
      }
      console.log(`Berhasil parsing ${parsedResults.length} paket stiker`);
      parsedResults.slice(0, 3).forEach((pack, index) => {
        console.log(`Result ${index + 1}: ${pack.slug} - "${pack.title}" (${pack.total} stickers)`);
      });
      const limitedResults = parsedResults.slice(0, limit);
      const finalResults = [];
      for (const item of limitedResults) {
        if (detail && item.slug) {
          console.log(`Mengambil detail untuk: "${item.title}" (${item.slug})`);
          try {
            const {
              data: html
            } = await this.axiosInstance.get(`/telegram/${item.slug}/`);
            const $ = cheerio.load(html);
            item.addToTelegramLink = $('a[href^="https://t.me/addstickers/"]').attr("href") ?? null;
            item.stickers = [];
            $("main .grid > div > div > img[src]").each((i, el) => {
              const stickerElement = $(el);
              const stickerUrl = stickerElement.attr("src");
              const scriptContent = stickerElement.next('script[type="application/ld+json"]').html();
              let tags = [];
              if (scriptContent) {
                try {
                  const jsonData = JSON.parse(scriptContent);
                  const description = jsonData?.description || "";
                  tags = description ? description.split(",").map(tag => tag.trim()) : [];
                } catch (e) {
                  console.warn(`Gagal parsing JSON LD untuk stiker: ${e.message}`);
                }
              }
              if (stickerUrl) {
                item.stickers.push({
                  url: stickerUrl,
                  tags: tags
                });
              }
            });
            console.log(`Detail berhasil diambil: ${item.stickers.length} stiker ditemukan`);
          } catch (error) {
            console.error(`Gagal mengambil detail untuk "${item.slug}": ${error.message}`);
            item.stickers = [];
            item.addToTelegramLink = null;
          }
        }
        finalResults.push(item);
      }
      console.log(`Proses pencarian selesai. Total hasil: ${finalResults.length}`);
      return finalResults;
    } catch (error) {
      console.error(`Terjadi kesalahan fatal selama pencarian: ${error.message}`);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
      }
      return [];
    }
  }
}
export default async function handler(req, res) {
  const params = req.method === "GET" ? req.query : req.body;
  if (!params.query) {
    return res.status(400).json({
      error: "query are required"
    });
  }
  try {
    const sticker = new StickerSearch();
    const response = await sticker.search(params);
    return res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Internal Server Error"
    });
  }
}