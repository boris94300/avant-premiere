import { cookies } from "next/headers";
import { COOKIE_LANG, type Lang } from "./i18n";

export async function langServeur(): Promise<Lang> {
  return (await cookies()).get(COOKIE_LANG)?.value === "en" ? "en" : "fr";
}
