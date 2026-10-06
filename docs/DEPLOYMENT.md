# Déploiement du mini-PC

Cette procédure vise une installation simple, locale et sans abonnement logiciel.

## Logiciels nécessaires

- Debian 13 ou Ubuntu Server LTS
- Docker Engine + Docker Compose plugin
- Git
- RewardConnection
- PostgreSQL 17 dans Docker

Aucun abonnement logiciel n'est requis.

## 1. Préparer le serveur

Donne au mini-PC une IP fixe ou une réservation DHCP, par exemple :

```text
192.168.10.10
```

Installe Docker Engine selon la documentation officielle de ta distribution, puis vérifie :

```bash
docker --version
docker compose version
```

## 2. Installer RewardConnection

```bash
sudo mkdir -p /opt/rewardconnection
sudo chown "$USER":"$USER" /opt/rewardconnection
git clone https://github.com/RedakArraid/rewardconnection.git /opt/rewardconnection
cd /opt/rewardconnection
git checkout feature/rewardconnection-v1
```

Quand la branche sera fusionnée dans `main`, le checkout spécifique ne sera plus nécessaire.

## 3. Créer la configuration

```bash
cp .env.example .env
```

Génère deux mots de passe longs :

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Utilise l'un pour `AUTH_SECRET` et l'autre pour `POSTGRES_PASSWORD`.

Avant le branchement du MikroTik :

```env
MIKROTIK_ENABLED="false"
```

Après configuration du routeur :

```env
MIKROTIK_ENABLED="true"
```

## 4. Démarrer

```bash
docker compose up -d --build
```

Vérifie :

```bash
docker compose ps
docker compose logs -f app
```

L'endpoint suivant doit répondre `{"status":"ok"}` :

```text
http://192.168.10.10:3000/api/health
```

## 5. Première initialisation

Sans seed de démonstration, ouvre :

```text
http://192.168.10.10:3000/setup
```

Crée le premier parent.

La route d'installation refuse ensuite de créer une seconde famille dès qu'un utilisateur existe.

## 6. Sauvegarde

Les données PostgreSQL vivent dans le volume Docker `rewardconnection_pg`.

Exemple de sauvegarde :

```bash
docker compose exec -T db pg_dump -U reward rewardconnection > rewardconnection-$(date +%F).sql
```

Restauration sur une base vide :

```bash
cat sauvegarde.sql | docker compose exec -T db psql -U reward rewardconnection
```

Conserve une copie des sauvegardes en dehors du mini-PC.

## 7. Mise à jour

```bash
cd /opt/rewardconnection
git pull
docker compose up -d --build
```

Le conteneur d'application applique le schéma Prisma au démarrage.

## 8. Démarrage automatique

Les services utilisent :

```yaml
restart: unless-stopped
```

Docker les relancera automatiquement après le redémarrage du mini-PC.

## 9. Accès depuis l'extérieur

La V1 est conçue pour fonctionner localement dans la maison.

Ne redirige pas le port 3000 du routeur vers Internet.

Si un accès distant est souhaité plus tard, utilise un VPN privé vers la maison plutôt qu'une exposition directe de l'application ou de RouterOS.
