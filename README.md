# RewardConnection

RewardConnection transforme les activités de la maison en temps Internet.

Un parent crée des missions et attribue des jetons. Un enfant utilise un jeton pour ouvrir une fenêtre Internet sur tous ses appareils associés. Le routeur MikroTik applique réellement l'autorisation et la coupe automatiquement à expiration.

## Fonctionnalités

### Parent

- création des comptes enfants ;
- création d'un second compte parent ;
- attribution et ajustement de jetons ;
- création des missions ;
- validation/refus des missions terminées ;
- association manuelle d'un appareil ;
- scan des baux DHCP MikroTik ;
- association d'un bail DHCP à un enfant ;
- conversion automatique du bail sélectionné en bail statique ;
- test de connexion RouterOS ;
- coupure immédiate de l'accès Internet ;
- consultation de l'état des enfants et des appareils.

### Enfant

- consultation du portefeuille ;
- compte à rebours en temps réel ;
- utilisation d'un jeton ;
- consultation des missions ;
- déclaration d'une mission terminée ;
- historique des mouvements de jetons ;
- consultation des appareils associés.

### Réseau

- 1 jeton = durée configurable, 60 minutes par défaut ;
- une seule session Internet simultanée par enfant ;
- tous les appareils de l'enfant partagent la même fenêtre de temps ;
- autorisation RouterOS par address-list avec timeout natif ;
- nettoyage en cas d'échec partiel du routeur ;
- remboursement automatique si l'activation réseau échoue ;
- protection contre la double consommation de jetons ;
- protection contre la double validation d'une mission ;
- synchronisation des sessions expirées ;
- resynchronisation automatique après redémarrage du routeur ;
- worker local toutes les 30 secondes, sans consommation de jeton ;
- ajout d'un appareil pendant une session active pris en compte automatiquement ;
- validation du sous-réseau enfants ;
- mode simulation sans MikroTik.

## Architecture

```text
                         INTERNET
                            |
                       Box opérateur
                            |
                         MikroTik
                      /             \
               Parents              Enfants
               libre                contrôlé
                                      |
                         téléphone / tablette
                           console / ordinateur

                         Mini-PC
                            |
                 +----------+----------+
                 |                     |
            RewardConnection       PostgreSQL
                 |
             RouterOS REST
```

## Stack

- Next.js / React / TypeScript
- PostgreSQL
- Prisma
- Docker
- RouterOS REST API
- authentification locale par cookie JWT HTTP-only

## Démarrage rapide de développement

```bash
cp .env.example .env
docker compose up -d db
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run dev
```

Comptes du seed :

```text
Parent
parent@demo.local
demo1234

Enfant
enfant@demo.local
demo1234
```

Pour une installation réelle, ne lance pas le seed. Ouvre simplement `/setup` après la création de la base.

## Vérification complète

Une CI GitHub exécute :

```bash
npm run typecheck
npm test
npm run build
```

Les tests d'intégration utilisent PostgreSQL et vérifient notamment :

- une seule consommation de jeton lors de deux activations concurrentes ;
- une seule récompense lors de deux validations concurrentes ;
- l'expiration des sessions ;
- la coupure parentale ;
- les validations réseau.

## Mode sans matériel

Dans `.env` :

```env
MIKROTIK_ENABLED="false"
```

Toute la logique applicative fonctionne alors sans routeur.

## Mode MikroTik

Après installation physique :

```env
MIKROTIK_ENABLED="true"
MIKROTIK_BASE_URL="https://192.168.10.1"
MIKROTIK_USERNAME="rewardconnection"
MIKROTIK_PASSWORD="..."
MIKROTIK_ALLOW_INSECURE_TLS="false"
MIKROTIK_ADDRESS_LIST="rewardconnection-active"
MIKROTIK_CHILD_SUBNET="192.168.20.0/24"
```

Voir [docs/MIKROTIK.md](docs/MIKROTIK.md) pour la configuration réseau.

## Déploiement

Voir [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Le chemin recommandé est un mini-PC Debian/Ubuntu avec Docker Engine. Le déploiement lance quatre services locaux : PostgreSQL, l'application, un worker de réconciliation réseau et un service de sauvegarde automatique.

## Logiciels payants

Aucun logiciel payant n'est nécessaire pour faire fonctionner RewardConnection.

Les composants utilisés sont disponibles gratuitement :

- Debian / Ubuntu Server ;
- Docker Engine sur Linux ;
- PostgreSQL ;
- Node.js ;
- Next.js / React ;
- Prisma ORM ;
- Git.

RouterOS est fourni/licencié avec le routeur MikroTik acheté. Aucun abonnement RewardConnection, RADIUS ou cloud n'est nécessaire.

Les seuls coûts obligatoires sont donc le matériel et ta connexion Internet existante.

## Sécurité importante

- l'application est destinée au réseau local ;
- ne publie pas le port 3000 sur Internet ;
- n'expose jamais RouterOS sur Internet ;
- utilise un compte RouterOS dédié ;
- utilise des réservations DHCP pour les appareils enfants ;
- bloque IPv6 sur le réseau enfants tant qu'une politique IPv6 équivalente n'est pas configurée ;
- empêche l'usurpation d'IP avec la politique ARP/DHCP décrite dans la documentation ;
- sauvegarde régulièrement PostgreSQL ;
- garde `.env` hors de Git.

## Structure

```text
prisma/
src/
  app/
    api/
    child/
    parent/
    login/
    setup/
  components/
  lib/
tests/
docs/
.github/workflows/
```


## Récupération d'un compte

Un parent connecté peut modifier l'identifiant, le prénom et le mot de passe d'un enfant depuis l'espace parent.

Si le dernier compte parent devient inaccessible, le propriétaire du mini-PC peut réinitialiser le mot de passe directement sur le serveur :

```bash
docker compose exec app npm run admin:reset-password -- parent@maison.local NouveauMotDePasse
```

La commande ne crée pas de nouvel utilisateur : elle remplace uniquement le hash du mot de passe du compte existant.


## Sauvegarde automatique

Docker Compose crée des sauvegardes PostgreSQL compressées dans `./backups/`.

Par défaut, une sauvegarde est créée toutes les 24 heures et les fichiers de plus de 14 jours sont supprimés automatiquement.

```bash
./scripts/backup-now.sh
./scripts/restore-backup.sh backups/rewardconnection-YYYYMMDD-HHMMSS.dump
```

Conserve périodiquement une copie du dossier `backups/` en dehors du mini-PC.
