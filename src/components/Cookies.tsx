"use client";
import { useEffect, useState } from "react";

const CLE = "ap-cookies";

export default function Cookies() {
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
      <p><b>Cookies</b> — Ce site ne dépose aucun traceur publicitaire. Il retient seulement votre choix, sur cet appareil.</p>
      <div className="cookies-actions">
        <button type="button" className="btn btn-fantome" onClick={() => choisir("refuse")}>Refuser</button>
        <button type="button" className="btn" onClick={() => choisir("accepte")}>Accepter</button>
      </div>
    </div>
  );
}
