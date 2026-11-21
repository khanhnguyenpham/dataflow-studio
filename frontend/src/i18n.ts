import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import vi from "./locales/vi.json";
const stored = localStorage.getItem("dataflow-locale");
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, vi: { translation: vi } },
  lng:
    stored === "vi" || stored === "en"
      ? stored
      : navigator.language.toLowerCase().startsWith("vi")
        ? "vi"
        : "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});
i18n.on("languageChanged", (lang) => {
  localStorage.setItem("dataflow-locale", lang);
  document.documentElement.lang = lang;
});
document.documentElement.lang = i18n.language;
export default i18n;
