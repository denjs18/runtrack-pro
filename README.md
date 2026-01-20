# RunTrack Pro

Application web mobile-first de suivi de course (running) performante et moderne, construite avec Next.js 14+, MongoDB Atlas et React-Leaflet.

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
- **Base de donnees**: MongoDB Atlas avec Mongoose
- **Cartographie**: Leaflet + React-Leaflet
- **Styling**: Tailwind CSS
- **Icones**: Lucide React
- **TypeScript**: Typage complet

## Prerequis

- Node.js 18+
- Compte MongoDB Atlas (gratuit)
- npm ou yarn

## Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
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

Editer `.env.local` avec votre URI MongoDB Atlas:
```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

4. **Lancer le serveur de developpement**
```bash
npm run dev
```

5. **Ouvrir l'application**

Naviguer vers [http://localhost:3000](http://localhost:3000)

## Configuration MongoDB Atlas

1. Creer un compte gratuit sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Creer un nouveau cluster (le tier gratuit M0 suffit)
3. Creer un utilisateur de base de donnees
4. Ajouter votre IP a la liste blanche (ou `0.0.0.0/0` pour Vercel)
5. Recuperer l'URI de connexion et l'ajouter a `.env.local`

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
│   ├── mongodb.ts                # Connexion DB singleton
│   └── utils.ts                  # Utilitaires (Haversine, formatage)
├── models/
│   └── Activity.ts               # Schema Mongoose
└── types/
    └── index.ts                  # Types TypeScript
```

## Deploiement sur Vercel

1. Pousser le code sur GitHub
2. Importer le projet sur [Vercel](https://vercel.com)
3. Ajouter la variable d'environnement `MONGODB_URI`
4. Deployer

## Variables d'Environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| `MONGODB_URI` | URI de connexion MongoDB Atlas | Oui |

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
- Connexion MongoDB en singleton

## Scripts

```bash
npm run dev      # Serveur de developpement
npm run build    # Build de production
npm run start    # Serveur de production
npm run lint     # Linting ESLint
```

## Licence

MIT
