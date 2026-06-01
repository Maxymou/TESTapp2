# TESTapp2

`TESTapp2` est un template d'application PWA mobile-first réutilisable comme **GitHub Template**. Il fournit un socle prêt à lancer avec React + Vite + PWA, Nginx, backend Express, authentification, gestion utilisateurs, page DEV, Host API locale et mise à jour Docker Compose.

Le dépôt est conçu pour créer de nouvelles apps sans réécrire le socle technique:

1. créer un nouveau dépôt avec **Use this template** sur GitHub;
2. personnaliser l'identité non secrète dans `frontend/app.config.js`;
3. configurer les secrets, ports, tokens, chemins et noms de conteneurs dans `.env` sur le serveur;
4. développer ensuite les pages, routes et services métier nécessaires.

Consultez aussi [`docs/CREATE_NEW_APP.md`](docs/CREATE_NEW_APP.md) pour un guide complet avec l'exemple `PAPOTO`.

## Architecture

```txt
TESTapp2/
├── docker-compose.yml
├── .env.example
├── frontend/        # React + Vite + PWA, servi par Nginx
├── backend/         # Express, API applicative, auth et proxy sécurisé DEV
├── host-tools/      # API locale systemd exécutant uniquement des commandes whitelistées
├── scripts/         # update.sh avec flock, logs et statut JSON
└── docs/            # documentation template
```

- Le frontend Nginx sert la SPA et proxifie `/api/*` vers le backend.
- Le backend expose `/health`, les routes d'authentification `/api/auth/*`, les routes admin `/api/admin/*` protégées par session et les routes `/api/dev/*` protégées par `DEV_ADMIN_TOKEN`.
- La Host API écoute sur le port `4878` côté hôte/LXC et valide `DEV_ALLOWED_TOKEN`.
- `scripts/update.sh` écrit `runtime/update-status.json` et `logs/update-latest.log`.
- Les utilisateurs applicatifs sont persistés par défaut dans `/data/users.json`, monté par le volume Docker nommé `user-data`.

## Personnalisation du template

### Identité versionnée

L'identité visible de l'app se trouve dans `frontend/app.config.js` et est réexportée par `frontend/src/config/appConfig.js`:

```js
export const appConfig = {
  appId: 'testapp2',
  appName: 'TESTapp2',
  appTitle: 'TESTapp2',
  appDescription: 'Template PWA mobile-first pour créer rapidement de nouvelles applications.',
  shortName: 'TESTapp2',
  themeColor: '#020617',
  backgroundColor: '#020617',
  accentColor: '#A3E635',
  defaultPort: 3000
};
```

Cette configuration alimente l'interface React, le titre HTML et le manifest PWA généré au build.

### Configuration serveur et secrets

`.env` reste local et non versionné. Il sert aux secrets, ports réels, tokens, chemins serveur, noms de conteneurs et paramètres runtime.

L'update depuis la page DEV ne redemande jamais les informations de création: `scripts/update.sh` conserve `.env` et les volumes Docker.

### Évolutions métier

Les nouvelles apps peuvent ajouter leurs propres services Docker, par exemple SQL, FastAPI, workers ou APIs métier. Le template n'ajoute volontairement ni SQL ni FastAPI par défaut.

## Lancement Docker

```bash
cp .env.example .env
nano .env
mkdir -p runtime logs
docker compose up -d --build
docker compose ps
curl http://localhost:${APP_PORT:-3000}/health
```

L'application est servie par défaut sur `http://localhost:3000`. Au premier démarrage, si aucun utilisateur n'existe dans `/data/users.json`, le backend crée le compte admin initial depuis `ADMIN_USERNAME`, `ADMIN_PASSWORD` et `ADMIN_DISPLAY_NAME`.

> Les identifiants `admin` / `admin` présents dans `.env.example` sont uniquement destinés au test local. Changez `ADMIN_PASSWORD`, `SESSION_SECRET` et les tokens DEV avant toute exposition réseau.

## Authentification et gestion des utilisateurs

- Un login est obligatoire avant d'accéder à l'application.
- La session est stockée dans un cookie `HttpOnly`, signé par `SESSION_SECRET`, avec expiration `SESSION_TTL_HOURS`.
- Le nom du cookie est configurable avec `SESSION_COOKIE_NAME`.
- Les mots de passe sont hachés avec `crypto.scrypt` et les hash ne sont jamais renvoyés au frontend.
- Les rôles disponibles sont `user` et `admin`.
- Dans `Paramètres`, un admin peut activer le mode admin local pour afficher `Administration → Gestion des utilisateurs` et `DEV`.
- Les routes `/api/admin/*` restent protégées côté backend: un simple affichage frontend ne suffit pas.
- La gestion intégrée permet de lister, créer, modifier, activer/désactiver, réinitialiser le mot de passe et supprimer des utilisateurs.
- Le backend empêche la suppression, la désactivation ou la rétrogradation du dernier administrateur actif.

## Installation Host API systemd

La Host API doit tourner dans le LXC/hôte qui contient Docker afin de pouvoir exécuter les commandes Docker Compose whitelistées.

```bash
sudo mkdir -p /opt/TESTapp2
sudo rsync -a ./ /opt/TESTapp2/
cd /opt/TESTapp2
sudo cp .env.example .env
sudo nano .env
sudo cp host-tools/pwa-test-lab-dev-host-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pwa-test-lab-dev-host-api.service
sudo systemctl status pwa-test-lab-dev-host-api.service
```

Vérification locale avec le token Host API:

```bash
curl -H "x-dev-host-token: $DEV_ALLOWED_TOKEN" http://127.0.0.1:4878/status
```

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `APP_PORT` | Port HTTP exposé par le frontend Nginx. Défaut: `3000`. |
| `APP_VERSION` | Version affichée dans la page DEV et injectée au build. |
| `DOCKER_PROJECT_NAME` | Nom de projet Docker Compose. |
| `FRONTEND_CONTAINER` | Nom du conteneur frontend. |
| `BACKEND_CONTAINER` | Nom du conteneur backend. |
| `APP_WORKDIR` | Répertoire de travail contenant `docker-compose.yml` pour la Host API. |
| `DEV_ADMIN_TOKEN` | Token saisi dans l'interface DEV, validé par le backend. |
| `DEV_ALLOWED_TOKEN` | Token interne backend → Host API, jamais affiché côté frontend. |
| `DEV_HOST_API_URL` | URL de la Host API vue depuis le conteneur backend. |
| `DEV_REQUEST_TIMEOUT_MS` | Timeout des requêtes backend vers la Host API. |
| `USER_DATA_PATH` | Chemin du fichier JSON persistant des utilisateurs et sessions, `/data/users.json` dans Docker. |
| `SESSION_SECRET` | Secret long utilisé pour signer le cookie de session. À changer impérativement. |
| `SESSION_TTL_HOURS` | Durée de validité d'une session applicative. |
| `SESSION_COOKIE_NAME` | Nom du cookie de session. |
| `COOKIE_SECURE` | Mettre `true` derrière HTTPS pour ajouter l'attribut `Secure` au cookie. |
| `ADMIN_USERNAME` | Identifiant du premier admin créé uniquement si la base utilisateurs est vide. |
| `ADMIN_PASSWORD` | Mot de passe initial du premier admin. À changer après le premier login. |
| `ADMIN_DISPLAY_NAME` | Nom affiché du premier admin. |
| `HOST_API_PORT` | Port d'écoute de la Host API. |
| `HOST_COMMAND_TIMEOUT_MS` | Timeout des commandes lancées par la Host API. |
| `PWA_TEST_LAB_WORKDIR` | Ancien fallback encore accepté par compatibilité. Préférer `APP_WORKDIR`. |

## Sécurité

- Aucune commande arbitraire n'est acceptée par le backend ou la Host API.
- Les modes de mise à jour sont strictement limités à `normal` et `force-pwa`.
- Le frontend ne connaît pas `DEV_ALLOWED_TOKEN`.
- Le token admin DEV est saisi par l'utilisateur et envoyé uniquement dans l'en-tête `x-dev-admin-token` pour la page DEV.
- Les routes applicatives admin exigent une session active avec rôle `admin`.
- Remplacez tous les tokens et mots de passe d'exemple avant d'exposer l'application sur un réseau.
- Gardez la Host API limitée au réseau local/LXC et évitez toute exposition Internet directe.
- Ne versionnez jamais `.env`.

## Commandes utiles

```bash
# Mise à jour normale
./scripts/update.sh normal

# Mise à jour avec nettoyage du build PWA généré
./scripts/update.sh force-pwa

# Vérification manuelle non interactive de la configuration template
./scripts/check-template-config.sh

# Logs applicatifs Docker
docker compose logs --tail=160

# État Docker
docker compose ps

# Statut de mise à jour
cat runtime/update-status.json

# Dernier log de mise à jour
cat logs/update-latest.log
```

## Tests iPhone PWA

1. Ouvrir l'application dans Safari iOS.
2. Vérifier que la page de login et le drawer n'affichent pas de gap bas ni barre blanche.
3. Ajouter l'application à l'écran d'accueil.
4. Ouvrir l'icône installée, se connecter, puis vérifier le mode standalone dans `Paramètres → DEV`.
5. Tester rotation, verrouillage/déverrouillage et retour depuis le multitâche.
6. Utiliser `Mettre à jour + forcer PWA` après modification de version pour valider le rafraîchissement.

## Icônes et assets

Les icônes PWA sont uniquement des SVG texte:

- `frontend/public/icon.svg`
- `frontend/public/maskable-icon.svg`

Le manifest PWA est généré par Vite depuis `frontend/app.config.js` et conserve `sizes: "any"`, `type: "image/svg+xml"` et `purpose: "any maskable"`.
