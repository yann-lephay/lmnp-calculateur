/**
 * Calculateur d'amortissements LMNP
 * Module standalone TypeScript - zero dependances
 *
 * @see https://lmnp-facile.fr
 */

export {
  calculerAmortissementImmobilier,
  calculerAmortissementMobilier,
  calculerAmortissementTravaux,
  calculerAmortissementFraisNotaire,
  calculerAmortissementDepuisComposants,
  genererTableauAmortissements,
  genererComposantsNouveau,
  genererComposantsRepriseGlobale,
  getComposantsAmortissement,
  validerComposantsRepriseDetaillee,
} from "./amortissements";

export {
  calculerRecettesTotales,
  calculerChargesDeductibles,
  calculerFraisNotaireEnCharge,
  calculerResultatFiscal,
  consoliderResultats,
  mettreAJourDeficits,
  formaterResultat,
} from "./resultat-fiscal";

export type {
  BienImmobilier,
  Mobilier,
  Travaux,
  TypeTravaux,
  StrategyAmortissement,
  ComposantBien,
  DonneesReprise,
  LigneAmortissement,
  TableauAmortissements,
  RevenusAnnuels,
  ChargesAnnuelles,
  ResultatFiscal,
  ResultatFiscalConsolide,
  DeficitAnterieur,
} from "./types";

export {
  COMPOSANTS_STANDARD,
  DUREES_TRAVAUX,
  DUREE_MOBILIER_DEFAUT,
  DUREE_REPRISE_GLOBALE_DEFAUT,
} from "./types";
