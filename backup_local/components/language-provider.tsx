// Re-export from the compatibility layer to maintain backward compatibility
// while using Redux under the hood
export { LanguageProvider, useLanguage } from "./language-provider-compat"
export type { Language } from "@/store/languageSlice"