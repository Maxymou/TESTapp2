# Sauvegarde et restauration des données utilisateurs

Ce guide explique comment sauvegarder et restaurer les données utilisateurs persistantes du template `TESTapp2`.

## Données concernées

Le backend Express stocke par défaut les utilisateurs et les sessions applicatives dans le fichier JSON suivant :

```txt
/data/users.json
```

En Docker Compose, ce chemin est persistant grâce au volume nommé `user-data`. Le fichier contient des données sensibles : identifiants, hash de mots de passe, sessions et métadonnées de connexion. Il ne doit jamais être versionné ni partagé publiquement.

## Identifier le volume Docker réel

Le nom visible dans `docker-compose.yml` est `user-data`, mais Docker préfixe généralement le volume avec le nom du projet Compose. Pour identifier le volume réel :

```bash
docker volume ls | grep user-data
```

Vous pouvez aussi inspecter les volumes rattachés au conteneur backend :

```bash
docker compose ps backend
docker inspect $(docker compose ps -q backend) --format '{{ json .Mounts }}'
```

## Sauvegarder le volume `user-data`

1. Créez un dossier local pour les sauvegardes :

```bash
mkdir -p backups
```

2. Remplacez `<volume_user_data>` par le nom réel identifié précédemment, puis créez l'archive :

```bash
docker run --rm \
  -v <volume_user_data>:/data:ro \
  -v "$PWD/backups":/backup \
  alpine sh -c 'cd /data && tar czf /backup/user-data-$(date +%Y%m%d-%H%M%S).tar.gz .'
```

3. Vérifiez que l'archive existe :

```bash
ls -lh backups/
```

## Restaurer le volume `user-data`

> Attention : la restauration remplace les données utilisateurs courantes. Faites toujours une sauvegarde de l'état actuel avant de restaurer.

1. Arrêtez les conteneurs applicatifs :

```bash
docker compose down
```

2. Conservez une copie de sécurité du volume actuel si possible :

```bash
mkdir -p backups

docker run --rm \
  -v <volume_user_data>:/data:ro \
  -v "$PWD/backups":/backup \
  alpine sh -c 'cd /data && tar czf /backup/user-data-before-restore-$(date +%Y%m%d-%H%M%S).tar.gz .'
```

3. Restaurez l'archive souhaitée dans le volume :

```bash
docker run --rm \
  -v <volume_user_data>:/data \
  -v "$PWD/backups":/backup \
  alpine sh -c 'rm -rf /data/* && tar xzf /backup/<archive-user-data>.tar.gz -C /data'
```

4. Vérifiez les permissions et la présence du fichier :

```bash
docker run --rm -v <volume_user_data>:/data alpine sh -c 'ls -la /data && test -f /data/users.json'
```

5. Redémarrez l'application :

```bash
docker compose up -d
```

6. Vérifiez l'état de l'application puis connectez-vous avec un compte admin :

```bash
curl http://localhost:3000/health
```

## Méthode alternative pour une installation dans `/opt/TESTapp2`

Si l'application est installée dans `/opt/TESTapp2`, placez-vous dans ce dossier pour utiliser le bon projet Compose et les bons fichiers `.env` :

```bash
cd /opt/TESTapp2
mkdir -p backups

docker compose down

docker run --rm \
  -v $(docker volume ls --format '{{.Name}}' | grep user-data | head -n 1):/data:ro \
  -v /opt/TESTapp2/backups:/backup \
  alpine sh -c 'cd /data && tar czf /backup/user-data-$(date +%Y%m%d-%H%M%S).tar.gz .'
```

Pour restaurer :

```bash
cd /opt/TESTapp2

docker compose down

docker run --rm \
  -v $(docker volume ls --format '{{.Name}}' | grep user-data | head -n 1):/data \
  -v /opt/TESTapp2/backups:/backup \
  alpine sh -c 'rm -rf /data/* && tar xzf /backup/<archive-user-data>.tar.gz -C /data'

docker compose up -d
curl http://localhost:3000/health
```

Cette méthode est volontairement simple. Sur un serveur hébergeant plusieurs projets, préférez identifier explicitement le volume avec `docker volume ls | grep user-data` pour éviter de restaurer le mauvais volume.

## Précautions avant restauration

- Arrêter les conteneurs avec `docker compose down` pour éviter une écriture concurrente dans `/data/users.json`.
- Garder une copie de l'ancien fichier ou de l'ancien volume avant toute restauration.
- Vérifier que l'archive restaurée correspond à la bonne application et au bon environnement.
- Vérifier les permissions et la présence de `/data/users.json` après extraction.
- Ne jamais versionner les fichiers de données, `.env`, secrets, tokens, sauvegardes ou archives contenant des utilisateurs.

## Vérification après restauration

Après `docker compose up -d` :

1. contrôler la santé de l'application avec `curl http://localhost:3000/health` ;
2. ouvrir l'application dans le navigateur ;
3. se connecter avec un compte admin connu ;
4. vérifier la page `Paramètres → Gestion des utilisateurs` en mode admin.
