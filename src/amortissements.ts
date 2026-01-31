/**
 * Calcul des amortissements LMNP
 * Module standalone - zero dependances
 */

import {
  BienImmobilier,
  Mobilier,
  Travaux,
  LigneAmortissement,
  TableauAmortissements,
  ComposantBien,
  DonneesReprise,
  COMPOSANTS_STANDARD,
  DUREES_TRAVAUX,
  DUREE_MOBILIER_DEFAUT,
  DUREE_REPRISE_GLOBALE_DEFAUT,
} from "./types";

// =============================================================================
// HELPERS
// =============================================================================

/** Arrondit a 2 decimales */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Calcule le nombre de jours entre deux dates */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calcule le prorata temporis pour la premiere annee
 * @param dateDebut Date de debut d'amortissement
 * @param annee Annee fiscale
 * @returns Coefficient prorata (0 a 1)
 */
function calculerProrata(dateDebut: string, annee: number): number {
  const debut = new Date(dateDebut);
  const anneeDebut = debut.getFullYear();

  if (anneeDebut > annee) return 0;
  if (anneeDebut < annee) return 1;

  const finAnnee = new Date(annee, 11, 31);
  const joursRestants = daysBetween(dateDebut, finAnnee.toISOString()) + 1;
  const joursAnnee = annee % 4 === 0 ? 366 : 365;

  return joursRestants / joursAnnee;
}

/**
 * Determine la duree d'amortissement selon l'etat du bien
 */
function getDureeAmortissement(
  dureeAncien: number,
  dureeNeuf: number,
  etatBien: "neuf" | "ancien" | "renove"
): number {
  switch (etatBien) {
    case "neuf":
      return dureeNeuf;
    case "renove":
      return Math.round((dureeAncien + dureeNeuf) / 2);
    case "ancien":
    default:
      return dureeAncien;
  }
}

// =============================================================================
// GENERATION DES COMPOSANTS SELON LA STRATEGIE
// =============================================================================

function generateComposantId(): string {
  return `comp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Strategie NOUVEAU : Genere les composants pour un nouvel achat
 * Ventilation automatique : Terrain (non amortissable) + 5 composants standard du bati
 */
export function genererComposantsNouveau(
  bien: BienImmobilier,
  valeurMobilier: number = 0
): ComposantBien[] {
  const composants: ComposantBien[] = [];

  const valeurTerrain = bien.prixAcquisition * (bien.quotePartTerrain / 100);
  composants.push({
    id: generateComposantId(),
    nom: "Terrain",
    valeurInitiale: round2(valeurTerrain),
    duree: 0,
    dateDebut: bien.dateAcquisition,
    amortissementAnterieur: 0,
    estAmortissable: false,
    quotePart: bien.quotePartTerrain,
  });

  const valeurBati = bien.prixAcquisition - valeurTerrain - valeurMobilier;

  COMPOSANTS_STANDARD.forEach((comp) => {
    const duree = getDureeAmortissement(comp.dureeAncien, comp.dureeNeuf, bien.etatBien);
    const valeur = valeurBati * comp.quotePart;

    composants.push({
      id: generateComposantId(),
      nom: comp.nom,
      valeurInitiale: round2(valeur),
      duree,
      dateDebut: bien.dateAcquisition,
      amortissementAnterieur: 0,
      estAmortissable: true,
      quotePart: comp.quotePart * 100 * (1 - bien.quotePartTerrain / 100),
    });
  });

  return composants;
}

/**
 * Strategie REPRISE_GLOBALE : Genere les composants depuis des donnees agregees
 * Utilise quand on reprend depuis les impots ou un ancien comptable avec juste les totaux
 *
 * Logique "Reverse Engineering" :
 * - Duree restante = Valeur Brute Constructions / Dotation N-1
 * - On continue lineairement sur cette duree
 */
export function genererComposantsRepriseGlobale(
  bien: BienImmobilier,
  donneesReprise: DonneesReprise
): ComposantBien[] {
  const composants: ComposantBien[] = [];
  const dateDebut = `${donneesReprise.anneeReprise - 1}-01-01`;

  if (donneesReprise.valeurBruteTerrains > 0) {
    composants.push({
      id: generateComposantId(),
      nom: "Terrain",
      valeurInitiale: donneesReprise.valeurBruteTerrains,
      duree: 0,
      dateDebut: bien.dateAcquisition,
      amortissementAnterieur: 0,
      estAmortissable: false,
    });
  }

  if (donneesReprise.valeurBruteConstructions > 0) {
    let dureeRestante = DUREE_REPRISE_GLOBALE_DEFAUT;
    if (donneesReprise.dotationDerniereAnnee > 0) {
      const vnc = donneesReprise.valeurBruteConstructions - donneesReprise.amortissementsCumules;
      dureeRestante = Math.ceil(vnc / donneesReprise.dotationDerniereAnnee);
      dureeRestante = Math.max(1, Math.min(80, dureeRestante));
    }

    const anneesDejaAmorties =
      donneesReprise.dotationDerniereAnnee > 0
        ? Math.ceil(donneesReprise.amortissementsCumules / donneesReprise.dotationDerniereAnnee)
        : 0;
    const dureeTotale = dureeRestante + anneesDejaAmorties;

    composants.push({
      id: generateComposantId(),
      nom: "Immeuble (reprise)",
      valeurInitiale: donneesReprise.valeurBruteConstructions,
      duree: dureeTotale,
      dateDebut,
      amortissementAnterieur: donneesReprise.amortissementsCumules,
      estAmortissable: true,
    });
  }

  if (donneesReprise.valeurBruteMobilier && donneesReprise.valeurBruteMobilier > 0) {
    const amortMobilierCumule = donneesReprise.amortissementsMobilierCumules || 0;

    composants.push({
      id: generateComposantId(),
      nom: "Mobilier (reprise)",
      valeurInitiale: donneesReprise.valeurBruteMobilier,
      duree: DUREE_MOBILIER_DEFAUT,
      dateDebut,
      amortissementAnterieur: amortMobilierCumule,
      estAmortissable: true,
    });
  }

  return composants;
}

/**
 * Valide les composants fournis pour une reprise detaillee
 */
export function validerComposantsRepriseDetaillee(composants: ComposantBien[]): {
  valide: boolean;
  erreurs: string[];
} {
  const erreurs: string[] = [];

  if (!composants || composants.length === 0) {
    erreurs.push("Au moins un composant est requis");
    return { valide: false, erreurs };
  }

  composants.forEach((comp, index) => {
    if (!comp.nom || comp.nom.trim() === "") {
      erreurs.push(`Composant ${index + 1}: Nom requis`);
    }
    if (comp.valeurInitiale < 0) {
      erreurs.push(`Composant ${index + 1}: Valeur initiale invalide`);
    }
    if (comp.estAmortissable && comp.duree <= 0) {
      erreurs.push(`Composant ${index + 1}: Duree invalide pour un composant amortissable`);
    }
    if (comp.amortissementAnterieur < 0) {
      erreurs.push(`Composant ${index + 1}: Amortissement anterieur invalide`);
    }
    if (comp.amortissementAnterieur > comp.valeurInitiale) {
      erreurs.push(
        `Composant ${index + 1}: Amortissement anterieur superieur a la valeur initiale`
      );
    }
  });

  return { valide: erreurs.length === 0, erreurs };
}

/**
 * Genere ou recupere les composants d'amortissement selon la strategie du bien
 */
export function getComposantsAmortissement(
  bien: BienImmobilier,
  valeurMobilier: number = 0
): ComposantBien[] {
  if (bien.composantsAmortissement && bien.composantsAmortissement.length > 0) {
    return bien.composantsAmortissement;
  }

  const strategy = bien.strategyAmortissement || "NOUVEAU";

  switch (strategy) {
    case "NOUVEAU":
      return genererComposantsNouveau(bien, valeurMobilier);
    case "REPRISE_GLOBALE":
      if (!bien.donneesReprise) {
        return genererComposantsNouveau(bien, valeurMobilier);
      }
      return genererComposantsRepriseGlobale(bien, bien.donneesReprise);
    case "REPRISE_DETAILLEE":
      return [];
    default:
      return genererComposantsNouveau(bien, valeurMobilier);
  }
}

// =============================================================================
// AMORTISSEMENT IMMOBILIER (avec support des composants personnalises)
// =============================================================================

export function calculerAmortissementDepuisComposants(
  composants: ComposantBien[],
  annee: number,
  cumulAnterieurs: Record<string, number> = {}
): LigneAmortissement[] {
  return composants
    .filter((comp) => comp.estAmortissable && comp.duree > 0)
    .map((comp) => {
      const prorata = calculerProrata(comp.dateDebut, annee);
      const valeurBrute = comp.valeurInitiale;
      const dotationTheoriqueTotale = valeurBrute / comp.duree;
      const cumulPrecedent = cumulAnterieurs[comp.id] || comp.amortissementAnterieur || 0;
      const vncAvant = valeurBrute - cumulPrecedent;

      if (vncAvant <= 0) {
        return {
          composant: comp.nom,
          valeurBrute: round2(valeurBrute),
          duree: comp.duree,
          dateDebut: comp.dateDebut,
          dotationAnnuelle: 0,
          cumulAmortissements: round2(valeurBrute),
          valeurNetteComptable: 0,
        };
      }

      const dotationAnnuelle = round2(Math.min(dotationTheoriqueTotale * prorata, vncAvant));
      const cumulAmortissements = round2(cumulPrecedent + dotationAnnuelle);
      const vnc = round2(valeurBrute - cumulAmortissements);

      return {
        composant: comp.nom,
        valeurBrute: round2(valeurBrute),
        duree: comp.duree,
        dateDebut: comp.dateDebut,
        dotationAnnuelle,
        cumulAmortissements,
        valeurNetteComptable: vnc,
      };
    });
}

// =============================================================================
// AMORTISSEMENT IMMOBILIER (methode legacy avec COMPOSANTS_STANDARD)
// =============================================================================

export function calculerAmortissementImmobilier(
  bien: BienImmobilier,
  annee: number,
  cumulAnterieur: Record<string, number> = {}
): LigneAmortissement[] {
  const baseAmortissable = bien.prixAcquisition * (1 - bien.quotePartTerrain / 100);
  const prorata = calculerProrata(bien.dateAcquisition, annee);

  return COMPOSANTS_STANDARD.map((composant) => {
    const valeurBrute = baseAmortissable * composant.quotePart;
    const duree = getDureeAmortissement(composant.dureeAncien, composant.dureeNeuf, bien.etatBien);
    const dotationAnnuelle = round2((valeurBrute / duree) * prorata);
    const cumulPrecedent = cumulAnterieur[composant.nom] || 0;
    const cumulAmortissements = Math.min(cumulPrecedent + dotationAnnuelle, valeurBrute);
    const estAmortiCompletement = cumulAmortissements >= valeurBrute;

    return {
      composant: composant.nom,
      valeurBrute: round2(valeurBrute),
      duree,
      dateDebut: bien.dateAcquisition,
      dotationAnnuelle: estAmortiCompletement ? 0 : dotationAnnuelle,
      cumulAmortissements: round2(cumulAmortissements),
      valeurNetteComptable: round2(valeurBrute - cumulAmortissements),
    };
  });
}

// =============================================================================
// AMORTISSEMENT MOBILIER
// =============================================================================

export function calculerAmortissementMobilier(
  mobilier: Mobilier,
  annee: number,
  cumulAnterieur: number = 0
): LigneAmortissement | null {
  if (mobilier.valeurTotale <= 0) return null;

  const prorata = calculerProrata(mobilier.dateAchat, annee);
  const duree = mobilier.dureeAmortissement || 7;
  const valeur = mobilier.valeurTotale;
  const dotationAnnuelle = round2((valeur / duree) * prorata);
  const cumulAmortissements = Math.min(cumulAnterieur + dotationAnnuelle, valeur);
  const estAmortiCompletement = cumulAmortissements >= valeur;

  return {
    composant: "Mobilier",
    valeurBrute: valeur,
    duree,
    dateDebut: mobilier.dateAchat,
    dotationAnnuelle: estAmortiCompletement ? 0 : dotationAnnuelle,
    cumulAmortissements: round2(cumulAmortissements),
    valeurNetteComptable: round2(valeur - cumulAmortissements),
  };
}

// =============================================================================
// AMORTISSEMENT TRAVAUX
// =============================================================================

export function calculerAmortissementTravaux(
  travaux: Travaux,
  annee: number,
  cumulAnterieur: number = 0
): LigneAmortissement | null {
  if (travaux.type === "petits_travaux" || travaux.montant < 600) {
    return null;
  }

  const duree = DUREES_TRAVAUX[travaux.type];
  if (duree === 0) return null;

  const prorata = calculerProrata(travaux.date, annee);
  const montant = travaux.montant;
  const dotationAnnuelle = round2((montant / duree) * prorata);
  const cumulAmortissements = Math.min(cumulAnterieur + dotationAnnuelle, montant);
  const estAmortiCompletement = cumulAmortissements >= montant;

  return {
    composant: `Travaux: ${travaux.description}`,
    valeurBrute: montant,
    duree,
    dateDebut: travaux.date,
    dotationAnnuelle: estAmortiCompletement ? 0 : dotationAnnuelle,
    cumulAmortissements: round2(cumulAmortissements),
    valeurNetteComptable: round2(montant - cumulAmortissements),
  };
}

// =============================================================================
// AMORTISSEMENT FRAIS DE NOTAIRE
// =============================================================================

const DUREE_AMORTISSEMENT_FRAIS_NOTAIRE = 20;

export function calculerAmortissementFraisNotaire(
  bien: BienImmobilier,
  annee: number,
  cumulAnterieur: number = 0
): LigneAmortissement | null {
  if (bien.traitementFraisNotaire !== "immobilisation" || bien.fraisNotaire <= 0) {
    return null;
  }

  const prorata = calculerProrata(bien.dateAcquisition, annee);
  const valeur = bien.fraisNotaire;
  const duree = DUREE_AMORTISSEMENT_FRAIS_NOTAIRE;
  const dotationAnnuelle = round2((valeur / duree) * prorata);
  const cumulAmortissements = Math.min(cumulAnterieur + dotationAnnuelle, valeur);
  const estAmortiCompletement = cumulAmortissements >= valeur;

  return {
    composant: "Frais de notaire",
    valeurBrute: valeur,
    duree,
    dateDebut: bien.dateAcquisition,
    dotationAnnuelle: estAmortiCompletement ? 0 : dotationAnnuelle,
    cumulAmortissements: round2(cumulAmortissements),
    valeurNetteComptable: round2(valeur - cumulAmortissements),
  };
}

// =============================================================================
// TABLEAU CONSOLIDE
// =============================================================================

/**
 * Genere le tableau complet des amortissements pour un bien et une annee
 * Supporte les 3 strategies : NOUVEAU, REPRISE_GLOBALE, REPRISE_DETAILLEE
 */
export function genererTableauAmortissements(
  bien: BienImmobilier,
  mobilier: Mobilier | null,
  travaux: Travaux[],
  annee: number,
  cumulAnterieurs: {
    immobilier: Record<string, number>;
    mobilier: number;
    travaux: Record<string, number>;
    fraisNotaire: number;
    composants?: Record<string, number>;
  } = { immobilier: {}, mobilier: 0, travaux: {}, fraisNotaire: 0 }
): TableauAmortissements {
  let lignesImmobilier: LigneAmortissement[];
  let ligneMobilier: LigneAmortissement | undefined;

  const strategy = bien.strategyAmortissement || "NOUVEAU";
  const hasCustomComposants =
    bien.composantsAmortissement && bien.composantsAmortissement.length > 0;

  if (strategy === "REPRISE_GLOBALE" || strategy === "REPRISE_DETAILLEE" || hasCustomComposants) {
    const composants = getComposantsAmortissement(bien, mobilier?.valeurTotale || 0);
    const composantsImmo = composants.filter((c) => !c.nom.toLowerCase().includes("mobilier"));
    const composantMobilier = composants.find((c) => c.nom.toLowerCase().includes("mobilier"));

    lignesImmobilier = calculerAmortissementDepuisComposants(
      composantsImmo,
      annee,
      cumulAnterieurs.composants || {}
    );

    if (composantMobilier) {
      const prorata = calculerProrata(composantMobilier.dateDebut, annee);
      const valeur = composantMobilier.valeurInitiale;
      const cumulPrecedent = composantMobilier.amortissementAnterieur || 0;
      const vncAvant = valeur - cumulPrecedent;

      if (vncAvant > 0 && composantMobilier.duree > 0) {
        const dotation = round2(Math.min((valeur / composantMobilier.duree) * prorata, vncAvant));
        ligneMobilier = {
          composant: composantMobilier.nom,
          valeurBrute: valeur,
          duree: composantMobilier.duree,
          dateDebut: composantMobilier.dateDebut,
          dotationAnnuelle: dotation,
          cumulAmortissements: round2(cumulPrecedent + dotation),
          valeurNetteComptable: round2(vncAvant - dotation),
        };
      }
    }

    if (!ligneMobilier && mobilier && mobilier.valeurTotale > 0) {
      ligneMobilier =
        calculerAmortissementMobilier(mobilier, annee, cumulAnterieurs.mobilier) || undefined;
    }
  } else {
    lignesImmobilier = calculerAmortissementImmobilier(bien, annee, cumulAnterieurs.immobilier);

    const ligneFraisNotaire = calculerAmortissementFraisNotaire(
      bien,
      annee,
      cumulAnterieurs.fraisNotaire
    );
    if (ligneFraisNotaire) {
      lignesImmobilier.push(ligneFraisNotaire);
    }

    ligneMobilier = mobilier
      ? calculerAmortissementMobilier(mobilier, annee, cumulAnterieurs.mobilier) || undefined
      : undefined;
  }

  const lignesTravaux = travaux
    .map((t) => calculerAmortissementTravaux(t, annee, cumulAnterieurs.travaux[t.id] || 0))
    .filter((l): l is LigneAmortissement => l !== null);

  const totalDotationAnnuelle =
    lignesImmobilier.reduce((sum, l) => sum + l.dotationAnnuelle, 0) +
    (ligneMobilier?.dotationAnnuelle || 0) +
    lignesTravaux.reduce((sum, l) => sum + l.dotationAnnuelle, 0);

  const totalCumulAmortissements =
    lignesImmobilier.reduce((sum, l) => sum + l.cumulAmortissements, 0) +
    (ligneMobilier?.cumulAmortissements || 0) +
    lignesTravaux.reduce((sum, l) => sum + l.cumulAmortissements, 0);

  return {
    bienId: bien.id,
    annee,
    lignesImmobilier,
    ligneMobilier,
    lignesTravaux,
    totalDotationAnnuelle: round2(totalDotationAnnuelle),
    totalCumulAmortissements: round2(totalCumulAmortissements),
  };
}
