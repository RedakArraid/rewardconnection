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

Utilise l'un pour `AUTH_SECRET`, un autre pour `POSTGRES_PASSWORD`, puis génère également un troisième secret pour `INTERNAL_CRON_SECRET`.

```bash
openssl rand -hex 32
```

Le worker interne utilise ce secret pour resynchroniser les sessions actives toutes les 30 secondes. Cela permet notamment de restaurer automatiquement les autorisations après un redémarrage du MikroTik.

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
docker compose logs -f worker
```

Tu dois voir quatre services : `db`, `app`, `worker` et `backup`.

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

## 6. Sauvegardes automatiques

Les données PostgreSQL vivent dans le volume Docker `rewardconnection_pg`.

Le service `backup` crée automatiquement une sauvegarde PostgreSQL au format compressé dans :

```text
./backups/
```

Par défaut :

- une sauvegarde au démarrage du service ;
- puis une sauvegarde toutes les 24 heures ;
- conservation pendant 14 jours.

Ces valeurs se changent dans `.env` :

```env
BACKUP_RETENTION_DAYS="14"
BACKUP_INTERVAL_SECONDS="86400"
```

Créer immédiatement une sauvegarde manuelle :

```bash
./scripts/backup-now.sh
```

Restaurer une sauvegarde :

```bash
./scripts/restore-backup.sh backups/rewardconnection-YYYYMMDD-HHMMSS.dump
```

Le script de restauration demande de taper `RESTAURER`, arrête temporairement l'application, le worker et le service de backup, remplace la base, puis redémarre les services.

Les fichiers `backups/`, `*.dump` et `*.sql` sont ignorés par Git.

**Important :** une sauvegarde stockée sur le même SSD protège contre une erreur de base mais pas contre la panne physique du disque. Copie régulièrement le dossier `backups/` sur un autre support ou une autre machine.

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


## 10. Résilience routeur

Le service `worker` appelle l'endpoint interne de réconciliation toutes les 30 secondes.

Il sert à :

- marquer en base les sessions arrivées à expiration ;
- vérifier les sessions Internet encore actives ;
- réappliquer les autorisations manquantes sur le MikroTik après un redémarrage ou une perte temporaire de connexion ;
- intégrer automatiquement un appareil ajouté pendant une session déjà active.

Le worker ne consomme jamais un nouveau jeton. Il restaure uniquement l'état correspondant aux sessions déjà payées.
