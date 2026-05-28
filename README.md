# PWA-Test-Lab

Template vierge pour tester des interfaces PWA mobile-first, le mode standalone iOS et un mécanisme de mise à jour robuste dans un conteneur LXC Proxmox avec Docker et Docker Compose.

## Architecture

```txt
PWA-Test-Lab/
├── docker-compose.yml
├── .env.example
├── frontend/        # React + Vite + PWA, servi par Nginx
├── backend/         # Express, API applicative et proxy sécurisé DEV
├── host-tools/      # API locale systemd exécutant uniquement des commandes whitelistées
└── scripts/         # update.sh avec flock, logs et statut JSON
```

- Le frontend Nginx sert la SPA et proxifie `/api/*` vers le backend.
- Le backend expose `/health` et les routes `/api/dev/*` protégées par `DEV_ADMIN_TOKEN`.
- La Host API écoute sur le port `4878` côté hôte/LXC et valide `DEV_ALLOWED_TOKEN`.
- `scripts/update.sh` écrit `runtime/update-status.json` et `logs/update-latest.log`.

## Lancement Docker

```bash
cp .env.example .env
nano .env
mkdir -p runtime logs
docker compose up -d --build
docker compose ps
curl http://localhost:${APP_PORT:-8080}/health
```

L'application est servie par défaut sur `http://localhost:8080`.

## Installation Host API systemd

La Host API doit tourner dans le LXC/hôte qui contient Docker afin de pouvoir exécuter les commandes Docker Compose whitelistées.

```bash
sudo mkdir -p /opt/PWA-Test-Lab
sudo rsync -a ./ /opt/PWA-Test-Lab/
cd /opt/PWA-Test-Lab
sudo cp .env.example .env
sudo nano .env
sudo cp host-tools/pwa-test-lab-dev-host-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pwa-test-lab-dev-host-api.service
sudo systemctl status pwa-test-lab-dev-host-api.service
```

Vérification locale avec le token Host API :

```bash
curl -H "x-dev-host-token: $DEV_ALLOWED_TOKEN" http://127.0.0.1:4878/status
```

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `APP_PORT` | Port HTTP exposé par le frontend Nginx. |
| `APP_VERSION` | Version affichée dans la page DEV et injectée au build. |
| `DEV_ADMIN_TOKEN` | Token saisi dans l'interface DEV, validé par le backend. |
| `DEV_ALLOWED_TOKEN` | Token interne backend → Host API, jamais affiché côté frontend. |
| `DEV_HOST_API_URL` | URL de la Host API vue depuis le conteneur backend. |
| `HOST_API_PORT` | Port d'écoute de la Host API. |
| `PWA_TEST_LAB_WORKDIR` | Répertoire de travail contenant `docker-compose.yml`. |
| `HOST_COMMAND_TIMEOUT_MS` | Timeout des commandes lancées par la Host API. |

## Sécurité

- Aucune commande arbitraire n'est acceptée par le backend ou la Host API.
- Les modes de mise à jour sont strictement limités à `normal` et `force-pwa`.
- Le frontend ne connaît pas `DEV_ALLOWED_TOKEN`.
- Le token admin est saisi par l'utilisateur et envoyé uniquement dans l'en-tête `x-dev-admin-token`.
- Remplacez tous les tokens d'exemple avant d'exposer l'application sur un réseau.
- Gardez la Host API limitée au réseau local/LXC et évitez toute exposition Internet directe.

## Commandes utiles

```bash
# Mise à jour normale
./scripts/update.sh normal

# Mise à jour avec nettoyage du build PWA généré
./scripts/update.sh force-pwa

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
2. Vérifier que le drawer s'ouvre et se ferme sans gap bas ni barre blanche.
3. Ajouter l'application à l'écran d'accueil.
4. Ouvrir l'icône installée et vérifier le mode standalone dans `Paramètres → DEV`.
5. Tester rotation, verrouillage/déverrouillage et retour depuis le multitâche.
6. Utiliser `Mettre à jour + forcer PWA` après modification de version pour valider le rafraîchissement.

## Icônes et assets

Les icônes PWA sont uniquement des SVG texte :

- `frontend/public/icon.svg`
- `frontend/public/maskable-icon.svg`

Le manifest utilise `sizes: "any"`, `type: "image/svg+xml"` et `purpose: "any maskable"`.
