# RunTrack Pro

Application web mobile-first de suivi de course (running) performante et moderne, construite avec Next.js 14+, Firebase Firestore et React-Leaflet.

## Fonctionnalites

- **Suivi GPS en temps reel** avec filtrage de precision (< 30m)
- **Cartographie dynamique** avec trace colore selon la vitesse
- **Calculs de statistiques** : distance (Haversine), allure, vitesse, denivele
- **Historique des courses** avec mini-cartes et statistiques
- **Mode hors-ligne** : sauvegarde locale si la connexion echoue
- **Interface responsive** optimisee pour mobile
- **Dark mode** automatique

## Stack Technique

- **Framework**: Next.js 14+ (App Router)
- **Base de donnees**: Firebase Firestore
- **Cartographie**: Leaflet + React-Leaflet
- **Styling**: Tailwind CSS
- **Icones**: Lucide React
- **TypeScript**: Typage complet

## Prerequis

- Node.js 18+
- Compte Firebase (gratuit)
- npm ou yarn

## Installation

1. **Cloner le projet**
```bash
git clone https://github.com/denjs18/runtrack-pro.git
cd runtrack-pro
```

2. **Installer les dependances**
```bash
npm install
```

3. **Configurer les variables d'environnement**
```bash
cp .env.local.example .env.local
```

Editer `.env.local` avec vos cles Firebase:
```
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
```

4. **Lancer le serveur de developpement**
```bash
npm run dev
```

5. **Ouvrir l'application**

Naviguer vers [http://localhost:3000](http://localhost:3000)

## Configuration Firebase

1. Creer un compte sur [Firebase Console](https://console.firebase.google.com)
2. Creer un nouveau projet
3. Activer Firestore Database (mode production ou test)
4. Aller dans Project Settings > General > Your apps
5. Ajouter une application Web
6. Copier les cles de configuration dans `.env.local`

### Regles Firestore (optionnel)

Pour securiser votre base de donnees en production:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /activities/{activityId} {
      allow read, write: if true; // A securiser en production
    }
  }
}
```

## Structure du Projet

```
src/
├── app/
│   ├── api/
│   │   └── activities/
│   │       ├── route.ts          # GET/POST activites
│   │       └── [id]/route.ts     # GET/DELETE/PATCH activite
│   ├── activities/
│   │   ├── page.tsx              # Historique
│   │   └── [id]/page.tsx         # Detail d'une course
│   ├── profile/
│   │   └── page.tsx              # Page profil
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Dashboard + Tracker
├── components/
│   ├── tracking/
│   │   ├── TrackerInterface.tsx  # Interface principale
│   │   ├── MapComponent.tsx      # Carte Leaflet
│   │   ├── DynamicMap.tsx        # Import dynamique SSR-safe
│   │   └── StatCard.tsx          # Carte de statistique
│   ├── history/
│   │   └── ActivityCard.tsx      # Carte d'activite
│   └── ui/
│       ├── Button.tsx
│       ├── Toast.tsx
│       ├── Navigation.tsx
│       └── ClientLayout.tsx
├── hooks/
│   ├── useGPS.ts                 # Hook GPS avec filtrage
│   └── useActivityStats.ts       # Calculs temps reel
├── lib/
│   ├── firebase.ts               # Configuration Firebase
│   └── utils.ts                  # Utilitaires (Haversine, formatage)
├── models/
│   └── Activity.ts               # Interface TypeScript
└── types/
    └── index.ts                  # Types TypeScript
```

## Deploiement sur Vercel

1. Pousser le code sur GitHub
2. Importer le projet sur [Vercel](https://vercel.com)
3. Ajouter les variables d'environnement Firebase
4. Deployer

## Variables d'Environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Cle API Firebase | Oui |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Domaine d'authentification | Oui |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID du projet Firebase | Oui |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Bucket de stockage | Oui |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ID de messagerie | Oui |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ID de l'application | Oui |

## Fonctionnalites Techniques

### Filtrage GPS
- Les points avec une precision > 30m sont ignores
- Distance minimale entre points : 3m (evite les doublons)

### Calculs
- **Distance**: Formule de Haversine
- **Allure**: Calculee sur les 5 derniers points (lissage)
- **Denivele**: Somme des gains d'altitude positifs

### Optimisations
- Throttle des mises a jour carte (1/s) pour economiser la batterie
- Import dynamique de Leaflet (pas de SSR)
- Firebase SDK optimise pour le web

## Scripts

```bash
npm run dev      # Serveur de developpement
npm run build    # Build de production
npm run start    # Serveur de production
npm run lint     # Linting ESLint
```

## Licence

MIT
