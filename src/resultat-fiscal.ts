/**
 * Calcul du resultat fiscal LMNP
 * Module standalone - zero dependances
 */

import type {
  RevenusAnnuels,
  ChargesAnnuelles,
  TableauAmortissements,
  ResultatFiscal,
  ResultatFiscalConsolide,
  DeficitAnterieur,
  BienImmobilier,
} from "./types";

// =============================================================================
// HELPERS
// =============================================================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// =============================================================================
// CALCUL DES RECETTES
// =============================================================================

/** Calcule le total des recettes pour une annee */
export function calculerRecettesTotales(revenus: RevenusAnnuels): number {
  return round2(
    revenus.loyersBruts +
      (revenus.indemnitesAssurance || 0) +
      (revenus.autresRevenus || 0)
  );
}

// =============================================================================
// CALCUL DES CHARGES
// =============================================================================

/** Calcule le total des charges deductibles pour une annee */
export function calculerChargesDeductibles(charges: ChargesAnnuelles): number {
  return round2(
    charges.interetsEmprunt +
      charges.assuranceEmprunteur +
      (charges.fraisBancaires || 0) +
      charges.taxeFonciere +
      (charges.cfe || 0) +
      charges.assurancePNO +
      (charges.assuranceGLI || 0) +
      (charges.chargesCoproNonRecup || 0) +
      (charges.fraisGestion || 0) +
      (charges.fraisComptable || 0) +
      (charges.petitsTravaux || 0) +
      (charges.fraisDeplacement || 0) +
      (charges.fournitures || 0) +
      (charges.autresCharges || 0)
  );
}

/**
 * Calcule les frais de notaire deductibles en charge (si traitement = "charge")
 */
export function calculerFraisNotaireEnCharge(
  bien: BienImmobilier,
  annee: number
): number {
  if (bien.traitementFraisNotaire !== "charge") return 0;
  const anneeAcquisition = new Date(bien.dateAcquisition).getFullYear();
  if (anneeAcquisition !== annee) return 0;
  return bien.fraisNotaire || 0;
}

// =============================================================================
// CALCUL DU RESULTAT FISCAL
// =============================================================================

/**
 * Calcule le resultat fiscal pour un bien et une annee
 *
 * Regles importantes :
 * 1. Resultat brut = Recettes - Charges
 * 2. Les amortissements ne peuvent PAS creer de deficit
 * 3. Si resultat brut > 0 : on utilise les amortissements jusqu'a ramener a 0
 * 4. Si resultat brut <= 0 : les amortissements sont integralement differes
 * 5. Le deficit (hors amortissements) est reportable 10 ans sur revenus LMNP
 */
export function calculerResultatFiscal(
  revenus: RevenusAnnuels,
  charges: ChargesAnnuelles,
  tableauAmortissements: TableauAmortissements,
  bien?: BienImmobilier
): ResultatFiscal {
  const recettesTotales = calculerRecettesTotales(revenus);
  const chargesDeductiblesBase = calculerChargesDeductibles(charges);

  const fraisNotaireEnCharge = bien
    ? calculerFraisNotaireEnCharge(bien, revenus.annee)
    : 0;

  const chargesDeductibles = round2(chargesDeductiblesBase + fraisNotaireEnCharge);
  const amortissementsCalcules = tableauAmortissements.totalDotationAnnuelle;

  const resultatBrut = recettesTotales - chargesDeductibles;

  let amortissementsUtilises: number;
  let amortissementsDifferes: number;
  let resultatFiscal: number;
  let deficitReportable: number;

  if (resultatBrut <= 0) {
    amortissementsUtilises = 0;
    amortissementsDifferes = amortissementsCalcules;
    resultatFiscal = resultatBrut;
    deficitReportable = Math.abs(resultatBrut);
  } else if (resultatBrut < amortissementsCalcules) {
    amortissementsUtilises = resultatBrut;
    amortissementsDifferes = amortissementsCalcules - resultatBrut;
    resultatFiscal = 0;
    deficitReportable = 0;
  } else {
    amortissementsUtilises = amortissementsCalcules;
    amortissementsDifferes = 0;
    resultatFiscal = resultatBrut - amortissementsCalcules;
    deficitReportable = 0;
  }

  return {
    annee: revenus.annee,
    bienId: revenus.bienId,
    recettesTotales,
    chargesDeductibles,
    resultatBrut: round2(resultatBrut),
    amortissementsCalcules: round2(amortissementsCalcules),
    amortissementsUtilises: round2(amortissementsUtilises),
    amortissementsDifferes: round2(amortissementsDifferes),
    resultatFiscal: round2(resultatFiscal),
    isDeficit: resultatFiscal < 0,
    deficitReportable: round2(deficitReportable),
  };
}

// =============================================================================
// CONSOLIDATION MULTI-BIENS
// =============================================================================

/**
 * Consolide les resultats fiscaux de plusieurs biens
 * et applique les deficits anterieurs puis les ARD (Article 39 C)
 *
 * Ordre de consommation (Article 39 C CGI) :
 * 1. D'abord les deficits BIC anterieurs (FIFO, max 10 ans)
 * 2. Ensuite les ARD (Amortissements Reputes Differes) - sans limite de temps
 */
export function consoliderResultats(
  resultats: ResultatFiscal[],
  deficitsAnterieurs: DeficitAnterieur[],
  amortissementsDifferesAnterieurs: number,
  annee: number
): ResultatFiscalConsolide {
  const recettesTotales = resultats.reduce((sum, r) => sum + r.recettesTotales, 0);
  const chargesDeductibles = resultats.reduce((sum, r) => sum + r.chargesDeductibles, 0);
  const amortissementsUtilises = resultats.reduce((sum, r) => sum + r.amortissementsUtilises, 0);
  const amortissementsDifferesAnnee = resultats.reduce((sum, r) => sum + r.amortissementsDifferes, 0);

  let resultatCourant = recettesTotales - chargesDeductibles - amortissementsUtilises;

  const deficitsValides = deficitsAnterieurs.filter(
    (d) => d.anneeExpiration >= annee && d.montant > 0
  );

  let deficitsAnterieursImputes = 0;
  if (resultatCourant > 0) {
    const deficitsTries = [...deficitsValides].sort((a, b) => a.annee - b.annee);
    for (const deficit of deficitsTries) {
      if (resultatCourant <= 0) break;
      const imputation = Math.min(deficit.montant, resultatCourant);
      deficitsAnterieursImputes += imputation;
      resultatCourant -= imputation;
    }
  }

  let ardAnterieursImputes = 0;
  if (resultatCourant > 0 && amortissementsDifferesAnterieurs > 0) {
    ardAnterieursImputes = Math.min(amortissementsDifferesAnterieurs, resultatCourant);
    resultatCourant -= ardAnterieursImputes;
  }

  const ardRestants =
    amortissementsDifferesAnterieurs - ardAnterieursImputes + amortissementsDifferesAnnee;

  const resultatFiscal = Math.max(0, resultatCourant);

  return {
    annee,
    recettesTotales: round2(recettesTotales),
    chargesDeductibles: round2(chargesDeductibles),
    amortissementsUtilises: round2(amortissementsUtilises),
    amortissementsDifferes: round2(amortissementsDifferesAnnee),
    deficitsAnterieursImputes: round2(deficitsAnterieursImputes),
    ardAnterieursImputes: round2(ardAnterieursImputes),
    ardRestants: round2(ardRestants),
    resultatFiscal: round2(resultatFiscal),
    isDeficit: resultatCourant < 0,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Met a jour les deficits reportables apres une annee
 */
export function mettreAJourDeficits(
  deficitsAnterieurs: DeficitAnterieur[],
  resultatConsolide: ResultatFiscalConsolide,
  annee: number
): DeficitAnterieur[] {
  let deficits = deficitsAnterieurs.filter((d) => d.anneeExpiration >= annee);

  let resteAImputer = resultatConsolide.deficitsAnterieursImputes;
  deficits = deficits
    .sort((a, b) => a.annee - b.annee)
    .map((d) => {
      if (resteAImputer <= 0) return d;
      const imputation = Math.min(d.montant, resteAImputer);
      resteAImputer -= imputation;
      return { ...d, montant: d.montant - imputation };
    })
    .filter((d) => d.montant > 0);

  if (resultatConsolide.isDeficit) {
    const nouveauDeficit = Math.abs(
      resultatConsolide.recettesTotales -
        resultatConsolide.chargesDeductibles -
        resultatConsolide.amortissementsUtilises
    );
    if (nouveauDeficit > 0) {
      deficits.push({
        annee,
        montant: round2(nouveauDeficit),
        anneeExpiration: annee + 10,
      });
    }
  }

  return deficits;
}

/**
 * Formate le resultat fiscal pour affichage
 */
export function formaterResultat(resultat: ResultatFiscalConsolide): string {
  if (resultat.isDeficit) {
    return `Deficit : ${Math.abs(resultat.resultatFiscal).toLocaleString("fr-FR")} EUR`;
  } else if (resultat.resultatFiscal === 0) {
    return "Resultat nul (pas d'impot LMNP)";
  } else {
    return `Benefice imposable : ${resultat.resultatFiscal.toLocaleString("fr-FR")} EUR`;
  }
}
