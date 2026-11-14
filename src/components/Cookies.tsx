"use client";
import { useEffect, useState } from "react";

import { useLang } from "./Langue";
import { t } from "@/lib/i18n";

const CLE = "ap-cookies";

export default function Cookies() {
  useLang();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try { setVisible(!localStorage.getItem(CLE)); } catch { setVisible(true); }
  }, []);
  if (!visible) return null;
  const choisir = (choix: "accepte" | "refuse") => {
    try { localStorage.setItem(CLE, choix); } catch { /* stockage indisponible */ }
    setVisible(false);
  };
  return (
    <div className="cookies" role="dialog" aria-label="Cookies">
      <p><b>Cookies</b> — {t("Ce site ne dépose aucun traceur publicitaire. Il retient seulement votre choix, sur cet appareil.")}</p>
      <div className="cookies-actions">
        <button type="button" className="btn btn-fantome" onClick={() => choisir("refuse")}>{t("Refuser")}</button>
        <button type="button" className="btn" onClick={() => choisir("accepte")}>{t("Accepter")}</button>
      </div>
    </div>
  );
}
