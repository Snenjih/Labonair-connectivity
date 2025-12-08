import React from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Globe } from "lucide-react";
import { updateUserLanguage } from "../../main-axios";
import { toast } from "sonner";

const languages = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "de", name: "German", nativeName: "Deutsch" },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = async (value: string) => {
    // Update i18n language immediately for instant UI feedback
    i18n.changeLanguage(value);
    localStorage.setItem("i18nextLng", value);

    // Save to backend (user needs to be logged in)
    try {
      await updateUserLanguage(value);
    } catch (error) {
      // Silently fail if user is not logged in
      // The language will still be saved in localStorage
      console.log("Language preference not saved to backend (user may not be logged in)");
    }
  };

  return (
    <div className="flex items-center gap-2 relative z-[99999]">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select value={i18n.language} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder={t("placeholders.language")} />
        </SelectTrigger>
        <SelectContent className="z-[99999]">
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.nativeName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
