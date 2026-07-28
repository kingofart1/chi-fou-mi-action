# Chi-Fou-Mi Action — multijoueur

## Structure
- `/server` : Node.js + Socket.io, arbitre la partie (choix PFC secrets, votes, contenu) + génère les tokens vocaux LiveKit
- `/client` : React (Vite), une page unique qui s'adapte à chaque phase du jeu

## 1. Vocal de groupe (LiveKit)
1. Crée un compte gratuit sur https://cloud.livekit.io (le plan gratuit suffit largement pour tester)
2. Crée un projet → récupère `API Key`, `API Secret` et l'URL du projet (`wss://....livekit.cloud`)
3. Renseigne ces 3 valeurs dans `server/.env` (copie `.env.example`)

## 2. Lancer en local (test avant déploiement)
```bash
cd server
npm install
cp .env.example .env   # puis remplis les clés LiveKit
npm run dev             # démarre sur http://localhost:3001

cd ../client
npm install
cp .env.example .env    # VITE_SERVER_URL=http://localhost:3001
npm run dev              # démarre sur http://localhost:5173
```
Ouvre plusieurs onglets/téléphones sur l'URL du client pour simuler plusieurs joueurs.

## 3. Déploiement gratuit
- **Serveur** : Render.com → "New Web Service" → connecte le dossier `server`, build command `npm install`, start command `npm start`. Ajoute les variables d'environnement (LIVEKIT_*) dans le dashboard Render.
- **Client** : Vercel ou Netlify → connecte le dossier `client`, ajoute la variable `VITE_SERVER_URL` = l'URL Render de ton serveur (ex: `https://ton-serveur.onrender.com`).
- Pense à autoriser l'URL du client dans le CORS du serveur une fois en prod (actuellement ouvert à `*` pour simplifier les tests).

## Limites connues à améliorer ensuite
- Les prénoms doivent être uniques par salle (le prototype ne gère pas encore les homonymes)
- Pas de reconnexion automatique si un joueur perd sa connexion en cours de manche
- Render gratuit met le serveur en veille après inactivité (premier chargement un peu lent)
