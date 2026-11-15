# Télétravail & bureaux – preuve de concept

Preuve de concept (HTML / CSS / JavaScript, sans dépendance ni étape de build) de l'application de déclaration du télétravail et de réservation de bureaux volants décrite dans le cahier des charges du 14 novembre 2026.

L'objectif est de valider les parcours et les règles métier avant le développement de la version cible en **Symfony**.

> Toutes les données sont **fictives**. Elles sont générées au premier chargement et enregistrées dans le `localStorage` du navigateur : chaque visiteur a sa propre copie. Le bouton « Réinitialiser la démo » restaure le jeu de données initial.

## Lancer la démo

- **GitHub Pages** : *Settings → Pages → Build and deployment → Deploy from a branch*, branche `main`, dossier `/ (root)`. L'application est servie à l'adresse `https://<compte>.github.io/homeoffice/`.
- **En local** : ouvrir `index.html` dans un navigateur, ou lancer un petit serveur (`python3 -m http.server`) à la racine du dépôt.

La connexion Microsoft est simulée : l'écran d'accueil propose une liste de comptes de démonstration (associés, avocats de chaque régime, salariés de chaque régime).

## Ce que couvre la POC

| Besoin du cahier des charges | Où le voir |
|---|---|
| Catégories et régimes (associés ; avocats avec/sans bureau/non éligibles ; salariés droit commun/spécifique/non éligibles) | Écran de connexion, *Administration → Utilisateurs* |
| Calendrier personnel : jours posés, statut, jours non télétravaillables, présence requise | *Mon calendrier* |
| Voir les jours de télétravail des autres, et pour chaque jour les personnes en télétravail et l'occupation des bureaux volants | Clic sur un jour, *Équipe*, *Plan & bureaux* |
| Plan interactif et réservation des bureaux volants (avocats sans bureau attitré) | *Plan & bureaux*, fiche d'une journée |
| Semaine type (avocats éligibles, salariés en régime spécifique), modifiable au cas par cas | *Mon compte* |
| Soldes du droit commun (passés / à venir / restants, crédit annuel et additionnel) | Encart « Mon régime » |
| Circonstances particulières (4 motifs, précision obligatoire pour « Autre ») et dérogation au délai de prévenance | Fiche d'une journée (compte salarié de droit commun) |
| Délais de prévenance (avocats : la veille ; salariés : 2 jours ouvrés) et motif en cas de non-respect | Fiche d'une journée |
| Notifications (pose, retrait, hors délai, opposition, confirmation, présence requise) | Cloche en haut à droite |
| Documents partagés par catégorie et documents individuels | *Documents* |
| Associés : confirmer (en informant ou non le collaborateur) ou s'opposer avec un motif obligatoire, jusqu'à la veille | *Administration → Demandes* |
| E-mail du soir (poses non confirmées prévues dans deux jours ouvrés), activable par associé | *Administration → Demandes* (aperçu) |
| Modifier la catégorie et le régime, les rattachements à un ou plusieurs associés, l'ajustement du crédit, le bureau | *Administration → Utilisateurs* |
| Jours de présence requise pour une ou plusieurs personnes, motif facultatif | *Administration → Présence requise* |
| Paramètres : délais, crédit de base (20), crédit additionnel (10), maximum par semaine (5), jours télétravaillables | *Administration → Paramètres* |
| Régimes spécifiques (nombre de jours par semaine ou par mois, jours possibles, délai) | *Administration → Régimes spécifiques* |
| Reporting par période et par population | *Administration → Reporting* |
| Récapitulatif Excel des utilisateurs | *Administration → Utilisateurs → Exporter* (CSV au format Excel français) |

Les jours fériés français, y compris les fêtes mobiles, sont calculés automatiquement.

## Structure du code

```
index.html              Page unique
css/style.css           Styles
js/dates.js             Dates, jours ouvrés, jours fériés
js/store.js             Persistance localStorage (à remplacer par l'API)
js/rules.js             Règles métier (contrôles de pose, crédits, délais, oppositions, réservations)
js/seed.js              Génération des données fictives
js/ui.js                Socle d'interface (modale, notifications, événements, en-tête)
js/views-*.js           Écrans
js/app.js               Routage par ancre (#calendar, #admin/users…)
```

`js/rules.js` regroupe toute la logique métier : c'est le fichier à transposer en services Symfony.

## Pistes pour la version Symfony

**Entités Doctrine proposées**

- `User` : nom, e-mail, fonction, catégorie, régime, `SpecificRegime`, ajustement de crédit, bureau, semaine type, bureau préféré, associés de rattachement (ManyToMany sur `User`)
- `RemoteDay` : utilisateur, date, statut (`pending` / `confirmed` / `refused`), date de pose, hors délai, motif du retard, circonstances particulières (motif et précision), confirmation, opposition (motif, précision, auteur, date)
- `BlockedDay` : date, utilisateurs concernés, motif, auteur
- `Desk` (bureaux attitrés et volants, avec coordonnées sur le plan) et `DeskBooking`
- `SpecificRegime`, `Settings` (ou paramètres en base), `Notification`, `Document` (avec public cible)

**Briques techniques**

- **Connexion Microsoft** : `knpuniversity/oauth2-client-bundle` avec le fournisseur Azure / Entra ID.
- **Synchronisation Outlook** : Microsoft Graph, par exemple pour ajouter les jours de télétravail à l'agenda.
- **Import/export Excel** : `phpoffice/phpspreadsheet`.
- **E-mail du soir** : Symfony Scheduler ou une tâche cron qui lance une commande, avec Symfony Mailer.
- **Contrôles d'accès** : Voters (associé, rattachement, catégorie de document).

## Points à confirmer dans le cahier des charges

1. **Plafond hebdomadaire du droit commun** : le régime est décrit avec une limite d'**un jour par semaine civile**, mais le paramètre « nombre maximum de jours par semaine » vaut **5 par défaut**. La POC applique 5, modifiable dans les paramètres.
2. **Synchronisation Excel** : la POC propose seulement un export du récapitulatif, ce qui correspond à l'alternative la plus simple évoquée dans le cahier des charges.
3. **Délai pour les avocats** : le non-respect est permis, mais un motif est demandé et transmis aux associés. Pour les salariés de droit commun, seules les circonstances particulières permettent d'y déroger.
4. **Associés** : ils peuvent poser des jours de télétravail sans contrainte ni validation. À confirmer.
