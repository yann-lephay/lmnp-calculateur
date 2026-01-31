/**
 * Types pour le calculateur d'amortissements LMNP
 */

export interface BienImmobilier {
  id: string;
  adresse: string;
  codePostal: string;
  ville: string;
  typeBien: "appartement" | "maison" | "studio" | "autre";
  dateAcquisition: string;
  prixAcquisition: number;
  fraisNotaire: number;
  traitementFraisNotaire?: "charge" | "immobilisation";
  quotePartTerrain: number;
  anneeConstruction: number;
  etatBien: "neuf" | "ancien" | "renove";
  strategyAmortissement?: StrategyAmortissement;
  composantsAmortissement?: ComposantBien[];
  donneesReprise?: DonneesReprise;
}

export interface Mobilier {
  id: string;
  bienId: string;
  valeurTotale: number;
  dateAchat: string;
  dureeAmortissement?: number;
}

export interface Travaux {
  id: string;
  bienId: string;
  type: TypeTravaux;
  description: string;
  montant: number;
  date: string;
}

export type TypeTravaux =
  | "toiture"
  | "facade"
  | "plomberie"
  | "electricite"
  | "cuisine"
  | "salle_de_bain"
  | "peinture"
  | "sols"
  | "chauffage"
  | "climatisation"
  | "menuiseries"
  | "isolation"
  | "amenagements_exterieurs"
  | "petits_travaux";

export type StrategyAmortissement = "NOUVEAU" | "REPRISE_GLOBALE" | "REPRISE_DETAILLEE";

export interface ComposantBien {
  id: string;
  nom: string;
  valeurInitiale: number;
  duree: number;
  dateDebut: string;
  amortissementAnterieur: number;
  estAmortissable: boolean;
  quotePart?: number;
}

export interface DonneesReprise {
  anneeReprise: number;
  valeurBruteTerrains: number;
  valeurBruteConstructions: number;
  amortissementsCumules: number;
  dotationDerniereAnnee: number;
  valeurBruteMobilier?: number;
  amortissementsMobilierCumules?: number;
}

export interface LigneAmortissement {
  composant: string;
  valeurBrute: number;
  duree: number;
  dateDebut: string;
  dotationAnnuelle: number;
  cumulAmortissements: number;
  valeurNetteComptable: number;
}

export interface TableauAmortissements {
  bienId: string;
  annee: number;
  lignesImmobilier: LigneAmortissement[];
  ligneMobilier?: LigneAmortissement;
  lignesTravaux: LigneAmortissement[];
  totalDotationAnnuelle: number;
  totalCumulAmortissements: number;
}

export interface RevenusAnnuels {
  annee: number;
  bienId: string;
  loyersBruts: number;
  chargesLocataire?: number;
  indemnitesAssurance?: number;
  autresRevenus?: number;
}

export interface ChargesAnnuelles {
  annee: number;
  bienId: string;
  interetsEmprunt: number;
  assuranceEmprunteur: number;
  fraisBancaires?: number;
  taxeFonciere: number;
  cfe?: number;
  assurancePNO: number;
  assuranceGLI?: number;
  chargesCoproNonRecup?: number;
  fraisGestion?: number;
  fraisComptable?: number;
  petitsTravaux?: number;
  fraisDeplacement?: number;
  fournitures?: number;
  autresCharges?: number;
}

export interface ResultatFiscal {
  annee: number;
  bienId: string;
  recettesTotales: number;
  chargesDeductibles: number;
  resultatBrut: number;
  amortissementsCalcules: number;
  amortissementsUtilises: number;
  amortissementsDifferes: number;
  resultatFiscal: number;
  isDeficit: boolean;
  deficitReportable: number;
}

export interface DeficitAnterieur {
  annee: number;
  montant: number;
  anneeExpiration: number;
}

export interface ResultatFiscalConsolide {
  annee: number;
  recettesTotales: number;
  chargesDeductibles: number;
  amortissementsUtilises: number;
  amortissementsDifferes: number;
  deficitsAnterieursImputes: number;
  ardAnterieursImputes: number;
  ardRestants: number;
  resultatFiscal: number;
  isDeficit: boolean;
}

/** Composants standard pour la ventilation d'un bien immobilier */
export const COMPOSANTS_STANDARD = [
  { nom: "Structure / Gros oeuvre", quotePart: 0.50, dureeAncien: 50, dureeNeuf: 80 },
  { nom: "Toiture", quotePart: 0.10, dureeAncien: 25, dureeNeuf: 30 },
  { nom: "Electricite / Plomberie", quotePart: 0.15, dureeAncien: 20, dureeNeuf: 25 },
  { nom: "Amenagements interieurs", quotePart: 0.15, dureeAncien: 15, dureeNeuf: 20 },
  { nom: "Facades / Etancheite", quotePart: 0.10, dureeAncien: 20, dureeNeuf: 30 },
];

/** Durees d'amortissement par type de travaux (en annees) */
export const DUREES_TRAVAUX: Record<string, number> = {
  toiture: 25,
  facade: 20,
  plomberie: 15,
  electricite: 20,
  cuisine: 10,
  salle_de_bain: 10,
  peinture: 10,
  sols: 10,
  chauffage: 15,
  climatisation: 15,
  menuiseries: 20,
  isolation: 20,
  amenagements_exterieurs: 15,
  petits_travaux: 0,
};

export const DUREE_MOBILIER_DEFAUT = 7;
export const DUREE_REPRISE_GLOBALE_DEFAUT = 25;
