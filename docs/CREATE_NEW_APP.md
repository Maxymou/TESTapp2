# Créer une nouvelle app depuis TESTapp2

`TESTapp2` est un template GitHub pour démarrer rapidement une application PWA mobile-first avec auth, gestion utilisateurs, page DEV, Host API et mise à jour Docker Compose déjà câblées.

## 1. Créer le dépôt

1. Sur GitHub, ouvrez le dépôt `Maxymou/TESTapp2`.
2. Cliquez sur **Use this template**.
3. Choisissez le nom du nouveau dépôt.
4. Le nouveau dépôt est indépendant: il a son propre historique futur, ses issues, ses secrets, ses branches et ses déploiements.

## 2. Personnaliser l'identité versionnée

L'identité non secrète de l'application est dans `frontend/app.config.js`, réexportée par `frontend/src/config/appConfig.js` pour le frontend React.

Modifiez ce fichier dans le nouveau dépôt pour changer:

- l'identifiant applicatif (`appId`);
- le nom affiché (`appName`, `appTitle`, `shortName`);
- la description;
- les couleurs PWA (`themeColor`, `backgroundColor`, `accentColor`);
- le port par défaut documenté (`defaultPort`).

Exemple pour une app appelée `PAPOTO`:

```js
export const appConfig = {
  appId: 'papoto',
  appName: 'PAPOTO',
  appTitle: 'PAPOTO',
  appDescription: 'Application PAPOTO pour suivre les données métier de l’équipe.',
  shortName: 'PAPOTO',
  themeColor: '#111827',
  backgroundColor: '#111827',
  accentColor: '#38BDF8',
  defaultPort: 3000
};

export default appConfig;
```

Cette configuration est volontairement versionnée: elle peut être relue, revue en PR et partagée avec l'équipe.

## 3. Configurer le serveur avec `.env`

Copiez `.env.example` vers `.env` sur le serveur ou dans votre environnement local:

```bash
cp .env.example .env
nano .env
```

`.env` reste local et ne doit jamais être versionné. Il contient les secrets, tokens, ports réels, noms de conteneurs et chemins serveur.

Variables à adapter en priorité:

```env
APP_PORT=3000
APP_VERSION=0.1.0
DOCKER_PROJECT_NAME=papoto
FRONTEND_CONTAINER=papoto-frontend
BACKEND_CONTAINER=papoto-backend
APP_WORKDIR=/opt/PAPOTO
SESSION_COOKIE_NAME=papoto_session
SESSION_SECRET=mettre-un-secret-long-et-aléatoire
DEV_ADMIN_TOKEN=mettre-un-token-admin-long-et-aléatoire
DEV_ALLOWED_TOKEN=mettre-un-token-host-long-et-aléatoire
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changer-ce-mot-de-passe
ADMIN_DISPLAY_NAME=Administrateur
```

## 4. Lancer l'application

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:${APP_PORT:-3000}/health
```

Le port 3000 reste le port par défaut si `APP_PORT` n'est pas défini.

## 5. Mise à jour depuis la page DEV

`scripts/update.sh` conserve `.env`, les volumes Docker, les utilisateurs et les sessions persistés. Il fait une mise à jour Git puis relance Docker Compose.

Important:

- `scripts/update.sh` ne lance aucun script d'initialisation;
- il ne redemande jamais les informations de création de l'app;
- la configuration propre à l'app doit rester dans `.env`, `frontend/app.config.js` et les volumes Docker.

## 6. Développer la nouvelle app

Après création du dépôt, vous pouvez ajouter progressivement vos besoins métier:

- schéma SQL et service de base de données dans Docker Compose;
- service FastAPI ou autre API métier;
- routes backend supplémentaires;
- pages React métier;
- calculs, imports, exports et traitements spécifiques.

Le template n'ajoute volontairement ni SQL ni FastAPI par défaut.

## 7. Zones à modifier avec prudence

Évitez de modifier ces zones sauf besoin clair, car elles garantissent le socle de maintenance:

- authentification et sessions;
- routes admin et gestion utilisateurs;
- page `DEV`;
- Host API (`host-tools/dev-host-api.js`);
- `scripts/update.sh`.

Si vous les modifiez, testez le login, le mode admin, la gestion utilisateurs, la page DEV, les statuts backend/Host API et les boutons update/restart/logs.
