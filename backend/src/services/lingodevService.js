const axios = require("axios");

const LINGODEV_API_URL =
  process.env.LINGODEV_API_URL || "https://api.lingo.dev/v1";
const LINGODEV_API_KEY = process.env.LINGODEV_API_KEY || "";

const lingodevService = {
  /**
   * Translate an array of texts into multiple target languages.
   * Falls back to mock translations if API key is not configured.
   */
  async expandDataset(texts, sourceLanguage, targetLanguages) {
    if (!LINGODEV_API_KEY) {
      console.log(
        "[LingodevService] No API key — using mock translations for demo"
      );
      return this.mockTranslate(texts, sourceLanguage, targetLanguages);
    }

    const results = [];

    for (const lang of targetLanguages) {
      try {
        const response = await axios.post(
          `${LINGODEV_API_URL}/translate`,
          {
            texts,
            source: sourceLanguage,
            target: lang,
          },
          {
            headers: {
              Authorization: `Bearer ${LINGODEV_API_KEY}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        );

        results.push({
          language: lang,
          translations: response.data.translations || response.data,
        });
      } catch (err) {
        console.error(`Failed to translate to ${lang}:`, err.message);
        results.push({
          language: lang,
          translations: texts.map((t) => `[${lang}] ${t}`),
          error: err.message,
        });
      }
    }

    return results;
  },

  /**
   * Mock translation for demo/testing without API key.
   * Prefixes text with language code to simulate translation.
   */
  mockTranslate(texts, sourceLanguage, targetLanguages) {
    const mockPrefixes = {
      hi: "हिन्दी: ",
      mr: "मराठी: ",
      es: "Español: ",
      fr: "Français: ",
      de: "Deutsch: ",
      pt: "Português: ",
      ja: "日本語: ",
      zh: "中文: ",
      ar: "عربي: ",
      ko: "한국어: ",
    };

    return targetLanguages.map((lang) => ({
      language: lang,
      translations: texts.map(
        (t) => `${mockPrefixes[lang] || `[${lang}] `}${t}`
      ),
    }));
  },
};

module.exports = lingodevService;
