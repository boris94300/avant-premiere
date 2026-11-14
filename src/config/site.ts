// Tous les textes, chiffres et profils du site sont ici : modifiez librement.

export const SITE = {
  nom: "Avant-Première",
  accroche: "Les marchés publics, avant tout le monde.",
  sousTitre:
    "Des agents IA lisent en direct les données publiques (achats annoncés, marchés attribués, budgets des collectivités, Parlement) et vous montrent qui va acheter quoi, où et quand, avant la publication de l'appel d'offres.",
  sourcesMention: "Données lues en direct via Hémicycle (MCP) — sources officielles sous Licence Ouverte.",
};

export type ProfilId = "entreprise" | "collectivite" | "etat";

export const PROFILS: Record<ProfilId, {
  libelle: string;
  question: string;
  placeholder: string;
  exemples: string[];
  promesse: string;
}> = {
  entreprise: {
    libelle: "Entreprise",
    question: "Quelle entreprise veut vendre au secteur public ?",
    placeholder: "Nom ou SIREN : Onet, Sopra Steria, 552081317…",
    exemples: ["Onet Services", "Sopra Steria", "Elior", "Colas"],
    promesse: "Votre pipeline commercial public : achats annoncés, marchés à renouveler, concurrents, chances de gain.",
  },
  collectivite: {
    libelle: "Collectivité",
    question: "Quelle commune veut mieux acheter ?",
    placeholder: "Nom de la commune : Angoulême, Vertou, Lille…",
    exemples: ["Angoulême", "Vertou", "Niort", "Bordeaux"],
    promesse: "Votre diagnostic achats : concurrence réelle sur vos marchés, capacité d'investissement, projets à venir.",
  },
  etat: {
    libelle: "État",
    question: "Quel secteur de la commande publique surveiller ?",
    placeholder: "Secteur : nettoyage, restauration collective, informatique…",
    exemples: ["nettoyage", "restauration collective", "voirie", "logiciel"],
    promesse: "La carte nationale de la concurrence : où l'argent public part sans vraie mise en concurrence.",
  },
};

// Secteur par défaut selon le code NAF (division), si l'IA ne répond pas.
export const NAF_SECTEURS: Record<string, { secteur: string; mots: string[] }> = {
  "81": { secteur: "Nettoyage et services aux bâtiments", mots: ["nettoyage", "propreté", "entretien des locaux"] },
  "41": { secteur: "Construction de bâtiments", mots: ["construction", "réhabilitation", "gros œuvre"] },
  "42": { secteur: "Génie civil", mots: ["voirie", "réseaux", "travaux publics"] },
  "43": { secteur: "Travaux de construction spécialisés", mots: ["électricité", "plomberie", "menuiserie"] },
  "62": { secteur: "Services informatiques", mots: ["logiciel", "informatique", "maintenance applicative"] },
  "63": { secteur: "Services d'information", mots: ["hébergement", "données", "informatique"] },
  "56": { secteur: "Restauration", mots: ["restauration collective", "repas", "denrées alimentaires"] },
  "49": { secteur: "Transport", mots: ["transport", "transport scolaire", "véhicules"] },
  "80": { secteur: "Sécurité", mots: ["gardiennage", "sécurité", "surveillance"] },
  "71": { secteur: "Ingénierie", mots: ["maîtrise d'œuvre", "ingénierie", "études"] },
  "70": { secteur: "Conseil", mots: ["conseil", "accompagnement", "assistance à maîtrise d'ouvrage"] },
  "35": { secteur: "Énergie", mots: ["énergie", "électricité", "chauffage"] },
  "86": { secteur: "Santé", mots: ["médical", "santé", "soins"] },
};

export const OFFRES = [
  { nom: "Veille", prix: 99, cible: "TPE / PME", inclus: ["1 secteur, 3 départements", "Achats annoncés + renouvellements prédits", "Alerte hebdomadaire"] },
  { nom: "Conquête", prix: 290, cible: "PME / ETI", inclus: ["Secteurs et France entière", "Concurrents et chances de gain", "Agent rédacteur de mails d'approche", "Export CRM"], phare: true },
  { nom: "Collectivité", prix: 490, cible: "Communes, EPCI, hôpitaux", inclus: ["Diagnostic concurrence de vos marchés", "Sourcing fournisseurs locaux", "Benchmark avec les voisines"] },
  { nom: "Institution", prix: 990, cible: "État, régions, observatoires", inclus: ["Carte nationale de la concurrence", "API et exports", "Alertes signaux faibles"] },
];

export const MARCHE = {
  commandePubliqueMdEUR: 170,
  entreprisesCandidates: 400000,
  acheteursPublics: 130000,
  hypotheses: [
    { label: "PME qui répondent déjà à des marchés publics", valeur: "≈ 400 000" },
    { label: "Objectif an 3 : 1 % d'entre elles à 290 €/mois", valeur: "4 000 clients" },
    { label: "Revenu récurrent annuel visé an 3", valeur: "≈ 13,9 M€" },
    { label: "Coût données par analyse (≈ 25 crédits Hémicycle + IA)", valeur: "< 0,30 €" },
    { label: "Marge brute estimée", valeur: "> 90 %" },
  ],
};

export const FEUILLE_DE_ROUTE = [
  { quand: "Aujourd'hui", titre: "Démo live", points: ["3 profils : entreprise, collectivité, État", "Agent prospecteur et chat agentique branchés sur Hémicycle (MCP)", "Renouvellements de marchés prédits"] },
  { quand: "M+1", titre: "Alertes", points: ["Alerte e-mail/Slack dès qu'un achat annoncé correspond", "Suivi des prédictions : annoncé → publié (BOAMP) → attribué"] },
  { quand: "M+3", titre: "Chances de gain", points: ["Modèle entraîné sur l'historique des attributions (offres reçues, prix, sortant)", "Score de probabilité de gain par lead"] },
  { quand: "M+6", titre: "Réponse assistée", points: ["Agent qui pré-rédige le mémoire technique", "Veille réglementaire du secteur (amendements + prédictions Orcet)"] },
  { quand: "M+12", titre: "Plateforme", points: ["API pour CRM et ERP (Salesforce, HubSpot)", "Marketplace de groupements et sous-traitance entre PME"] },
];
