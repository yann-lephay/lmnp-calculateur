<h1 align="center">Calculateur d'Amortissements LMNP</h1>

<p align="center">
  <strong>Calcul automatique des amortissements pour la location meublee non professionnelle.</strong>
</p>

<p align="center">
  TypeScript &bull; Zero dependances &bull; Conforme au droit fiscal francais
</p>

---

## Pourquoi ce calculateur ?

En LMNP au reel simplifie, les **amortissements** sont le levier fiscal principal. Ils permettent de deduire chaque annee une fraction du prix d'achat du bien, du mobilier et des travaux.

Probleme : les calculs sont complexes (ventilation par composants, prorata temporis, report des amortissements differes...) et les erreurs coutent cher.

Ce module TypeScript implemente **toute la logique d'amortissement LMNP** conforme au CGI (Code General des Impots).

## Installation

```bash
npm install lmnp-calculateur
```

Ou copie directement les fichiers `src/` dans ton projet.

## Utilisation rapide

```typescript
import {
  calculerAmortissementImmobilier,
  calculerAmortissementMobilier,
  calculerAmortissementTravaux,
  genererTableauAmortissements,
} from 'lmnp-calculateur';

// Definir un bien
const bien = {
  id: "1",
  adresse: "12 rue de la Paix",
  codePostal: "75002",
  ville: "Paris",
  typeBien: "appartement",
  dateAcquisition: "2024-06-15",
  prixAcquisition: 200000,
  fraisNotaire: 15000,
  traitementFraisNotaire: "immobilisation",
  quotePartTerrain: 15, // 15% = terrain (non amortissable)
  anneeConstruction: 1980,
  etatBien: "ancien",
};

// Definir le mobilier
const mobilier = {
  id: "1",
  bienId: "1",
  valeurTotale: 6000,
  dateAchat: "2024-07-01",
  dureeAmortissement: 7,
};

// Generer le tableau complet
const tableau = genererTableauAmortissements(bien, mobilier, [], 2024);

console.log(tableau.totalDotationAnnuelle);
// ~3 500 EUR pour 2024 (prorata temporis sur ~6 mois)
```

## Concepts cles

### Ventilation par composants

Un bien immobilier n'est pas amorti en bloc. Il est decompose en **composants** avec des durees differentes :

| Composant | Quote-part | Duree (ancien) | Duree (neuf) |
|-----------|-----------|----------------|--------------|
| Structure/Gros oeuvre | 50% | 50 ans | 80 ans |
| Toiture | 10% | 25 ans | 30 ans |
| Electricite/Plomberie | 15% | 20 ans | 25 ans |
| Amenagements interieurs | 15% | 15 ans | 20 ans |
| Facades/Etancheite | 10% | 20 ans | 30 ans |

Le **terrain** (generalement 10-20% du prix) n'est **jamais amortissable**.

### Prorata temporis

La premiere annee, l'amortissement est calcule au prorata du nombre de jours restants :

```
Achat le 15 juin 2024 :
  Jours restants = 200 jours
  Prorata = 200 / 366 = 0.546
  Dotation annee 1 = Dotation theorique × 0.546
```

### Amortissements differes (Article 39 C)

Les amortissements ne peuvent **jamais creer de deficit**. Si les charges depassent les recettes :

1. Le deficit (charges - recettes) est reportable **10 ans** sur revenus LMNP
2. Les amortissements sont **integralement differes** (reportables sans limite de duree)

```
Recettes :     12 000 EUR
Charges :      14 000 EUR
→ Deficit :     2 000 EUR (reportable 10 ans)
→ Amortissements : 6 000 EUR (differes, sans limite)
```

### Strategies de reprise

Trois cas possibles :

| Strategie | Quand | Composants |
|-----------|-------|-----------|
| **NOUVEAU** | Premiere declaration | Ventilation automatique 5 composants |
| **REPRISE_GLOBALE** | Reprise d'un comptable | Reverse-engineering depuis les totaux |
| **REPRISE_DETAILLEE** | Import FEC | Composants exacts importes |

## API Reference

### `genererTableauAmortissements(bien, mobilier, travaux, annee, cumulAnterieurs?)`

Genere le tableau complet des amortissements pour un bien et une annee.

**Retourne** : `TableauAmortissements` avec :
- `lignesImmobilier` - Amortissement par composant du bati
- `ligneMobilier` - Amortissement du mobilier
- `lignesTravaux` - Amortissement de chaque poste travaux
- `totalDotationAnnuelle` - Total amortissable cette annee
- `totalCumulAmortissements` - Cumul depuis le debut

### `calculerResultatFiscal(revenus, charges, tableauAmortissements, bien?)`

Calcule le resultat fiscal en appliquant les regles de l'Article 39 C.

**Retourne** : `ResultatFiscal` avec :
- `resultatBrut` - Recettes - Charges
- `amortissementsUtilises` - Utilises pour reduire le benefice
- `amortissementsDifferes` - Reportes (pas de creation de deficit)
- `resultatFiscal` - Montant imposable final
- `deficitReportable` - Deficit BIC reportable 10 ans

### `consoliderResultats(resultats, deficitsAnterieurs, ardAnterieurs, annee)`

Consolide les resultats de plusieurs biens et impute les deficits anterieurs.

**Ordre d'imputation (Article 39 C CGI) :**
1. Deficits BIC anterieurs (FIFO, max 10 ans)
2. ARD - Amortissements Reputes Differes (sans limite)

## Exemples

### Cas 1 : Appartement ancien avec mobilier

```typescript
// Achat 200 000 EUR le 15/06/2024, terrain 15%, ancien
// Mobilier 6 000 EUR, duree 7 ans
// → Dotation 2024 : ~3 500 EUR (prorata ~6 mois)
// → Dotation 2025 : ~7 000 EUR (annee pleine)
```

### Cas 2 : Reprise depuis un comptable

```typescript
import { genererComposantsRepriseGlobale } from 'lmnp-calculateur';

const donneesReprise = {
  anneeReprise: 2025,
  valeurBruteTerrains: 30000,
  valeurBruteConstructions: 170000,
  amortissementsCumules: 34000,     // 4 ans deja amortis
  dotationDerniereAnnee: 6800,      // ~6 800/an
};

// Reverse-engineering automatique :
// VNC = 170 000 - 34 000 = 136 000
// Duree restante = 136 000 / 6 800 = 20 ans
// Duree totale = 20 + 5 = 25 ans
```

### Cas 3 : Travaux amortissables

```typescript
const travaux = [
  {
    id: "t1",
    bienId: "1",
    type: "cuisine",     // 10 ans
    description: "Renovation cuisine complete",
    montant: 8000,
    date: "2024-09-01",
  },
  {
    id: "t2",
    bienId: "1",
    type: "petits_travaux", // < 600 EUR → charge directe, pas d'amortissement
    description: "Remplacement robinet",
    montant: 150,
    date: "2024-10-15",
  },
];
```

## Durees d'amortissement par type de travaux

| Type | Duree |
|------|-------|
| Toiture / Structure | 25 ans |
| Facade | 20 ans |
| Plomberie | 15 ans |
| Electricite | 20 ans |
| Cuisine / Salle de bain | 10 ans |
| Peinture / Sols | 10 ans |
| Chauffage / Climatisation | 15 ans |
| Menuiseries | 20 ans |
| Isolation | 20 ans |
| Amenagements exterieurs | 15 ans |
| Petits travaux (< 600 EUR) | Charge directe |

## Tu veux la declaration complete ?

Ce module calcule les amortissements. Pour generer la **liasse fiscale complete** (formulaires 2031, 2033A/B/C) prete a envoyer aux impots :

**[LMNP Facile - Ta declaration LMNP en 10 minutes, 49 EUR &rarr;](https://lmnp-facile.fr)**

- Import de tes declarations precedentes (comptable, JD2M, Decla.fr)
- Extraction IA des documents (actes, prets, factures)
- Calculs automatiques (amortissements + resultat fiscal)
- Generation PDF des formulaires Cerfa
- Generation FEC (Fichier d'Echanges Comptable)
- Zero donnees conservees (privacy-first)

## License

MIT - Utilise-le librement dans tes projets.

---

<p align="center">
  <a href="https://lmnp-facile.fr"><strong>Declaration LMNP complete &rarr; lmnp-facile.fr</strong></a>
</p>

<p align="center">
  <sub>&copy; 2025-2026 LMNP Facile. Fait a Paris.</sub>
</p>
