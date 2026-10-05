# RewardConnection

RewardConnection est une application familiale où les tâches deviennent des jetons de temps Internet.

## V1 incluse

- comptes Parent / Enfant ;
- création des comptes enfants ;
- portefeuille de jetons ;
- missions avec récompense ;
- validation parentale ;
- 1 jeton = durée Internet configurable ;
- enregistrement des appareils ;
- activation et coupure réseau via l'API REST MikroTik ;
- mode simulation sans routeur ;
- PostgreSQL + Prisma ;
- interface responsive ;
- Docker pour la base de données.

## Architecture

```text
Box Internet
    |
MikroTik
    |--- Wi-Fi parents
    |--- Wi-Fi enfants
    |
Mini-PC RewardConnection
    |--- Next.js
    |--- PostgreSQL
    |--- API RouterOS
```

Le MikroTik applique réellement la règle réseau. L'application ajoute temporairement les IP des appareils autorisés dans une address-list RouterOS. Quand le délai expire, RouterOS retire automatiquement l'autorisation.

## Démarrage

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma db push
npm run prisma:seed
npm run dev
```

Puis ouvre `http://localhost:3000`.

Comptes de démonstration :

- Parent : `parent@demo.local` / `demo1234`
- Enfant : `enfant@demo.local` / `demo1234`

Pour une installation réelle sans seed, initialise la base avec `npx prisma db push`, lance l'application puis ouvre `/setup`.

## MikroTik

Pour développer sans routeur :

```env
MIKROTIK_ENABLED="false"
```

Pour activer le routeur :

```env
MIKROTIK_ENABLED="true"
MIKROTIK_BASE_URL="http://192.168.88.1"
MIKROTIK_USERNAME="rewardconnection"
MIKROTIK_PASSWORD="..."
MIKROTIK_ADDRESS_LIST="rewardconnection-active"
```

Chaque appareil enfant doit idéalement avoir une réservation DHCP stable. Renseigne ensuite son IP dans l'espace parent.

Côté RouterOS, le principe est simple : le réseau enfants est bloqué vers Internet par défaut, sauf pour les IP présentes dans l'address-list `rewardconnection-active`.

En production, utilise HTTPS avec un certificat valide pour l'API RouterOS et n'expose jamais l'interface d'administration du routeur sur Internet.

## Déploiement mini-PC

La V1 peut tourner directement sur Debian/Ubuntu :

```bash
npm ci
npx prisma generate
npx prisma db push
npm run build
npm start
```

Le `Dockerfile` permet aussi de conteneuriser l'application.

## Suite prévue

- découverte automatique des baux DHCP à partir des MAC ;
- PWA installable ;
- notifications parent ;
- règles horaires ;
- plusieurs parents ;
- historique réseau détaillé ;
- pause/reprise du temps ;
- QR code d'association d'appareil.
