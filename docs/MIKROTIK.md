# MikroTik — configuration RewardConnection

RewardConnection pilote l'accès Internet IPv4 des enfants à partir d'une address-list RouterOS temporaire.

## Réseau cible

Exemple :

- réseau parents / serveurs : `192.168.10.0/24`
- mini-PC RewardConnection : `192.168.10.10`
- réseau enfants : `192.168.20.0/24`
- passerelle enfants : `192.168.20.1`
- liste d'accès : `rewardconnection-active`

Le nom exact de tes interfaces dépendra de ton routeur. Adapte les commandes ci-dessous.

## 1. SSID / VLAN enfants

Crée un réseau Wi-Fi dédié aux enfants qui arrive sur le réseau `192.168.20.0/24`.

Le mot de passe Wi-Fi ne donne pas automatiquement Internet : il donne uniquement accès au réseau local. RewardConnection décide ensuite si l'appareil peut sortir vers le WAN.

## 2. Réservations DHCP et protection contre l'usurpation d'IP

RewardConnection associe un appareil à sa MAC et à une adresse IPv4 stable.

L'application sait scanner les baux DHCP MikroTik puis rendre le bail choisi statique au moment de l'association.

Pour empêcher un appareil de prendre manuellement l'IP d'un autre appareil autorisé, utilise les entrées ARP générées par le DHCP et mets l'interface enfants en `reply-only`.

Exemple à adapter :

```routeros
/ip dhcp-server
set [find name="dhcp-children"] add-arp=yes

/interface vlan
set [find name="vlan-children"] arp=reply-only
```

Si le réseau enfants est directement porté par un bridge, applique `arp=reply-only` au bridge correspondant.

## 3. Firewall Internet

RewardConnection ajoute temporairement les IP autorisées dans :

```text
rewardconnection-active
```

Pour garantir une **vraie coupure à 00:00**, le trafic enfants ne doit jamais être FastTracké. Sinon une connexion déjà accélérée pourrait continuer à contourner les règles normales du firewall.

Si tu as une règle FastTrack standard, exclue le sous-réseau enfants dans les deux directions :

```routeros
/ip firewall filter
set [find action=fasttrack-connection] \
    src-address=!192.168.20.0/24 \
    dst-address=!192.168.20.0/24
```

Ensuite place les règles RewardConnection **avant les règles générales `established,related`**.

Exemple à adapter :

```routeros
/ip firewall filter

# L'enfant doit toujours pouvoir ouvrir RewardConnection,
# même lorsque son temps Internet est à zéro.
add chain=forward \
    src-address=192.168.20.0/24 \
    dst-address=192.168.10.10 \
    protocol=tcp dst-port=3000 \
    action=accept \
    comment="RewardConnection application locale"

# Isole le réseau enfants du réseau parents / serveurs.
# Les exceptions nécessaires doivent être placées avant cette règle.
add chain=forward \
    src-address=192.168.20.0/24 \
    dst-address=192.168.10.0/24 \
    action=drop \
    comment="RewardConnection isolation LAN enfants"

# Coupe immédiatement les paquets sortants dès que le timeout
# de l'address-list a expiré, y compris sur une connexion déjà établie.
add chain=forward \
    src-address=192.168.20.0/24 \
    src-address-list=!rewardconnection-active \
    out-interface-list=WAN \
    action=drop \
    comment="RewardConnection bloque enfants sans temps"

# Coupe aussi les paquets de retour WAN d'une ancienne connexion.
add chain=forward \
    dst-address=192.168.20.0/24 \
    dst-address-list=!rewardconnection-active \
    in-interface-list=WAN \
    action=drop \
    comment="RewardConnection bloque retours apres expiration"

# Autorise les appareils dont le temps est actif.
add chain=forward \
    src-address=192.168.20.0/24 \
    src-address-list=rewardconnection-active \
    out-interface-list=WAN \
    action=accept \
    comment="RewardConnection Internet actif"
```

Ces règles doivent être au-dessus des règles génériques qui acceptent `established,related`.

Avec cette organisation, lorsque RouterOS retire automatiquement l'adresse de `rewardconnection-active` à l'expiration du timeout, le paquet suivant est bloqué. Il n'est donc pas nécessaire d'attendre la fermeture naturelle d'une session YouTube, Netflix, jeu en ligne ou téléchargement.

Le bouton **Couper Internet** retire également l'adresse de la liste immédiatement. Le worker de RewardConnection resynchronise seulement les sessions encore valides ; il ne prolonge jamais une session expirée.

## 4. IPv6

La V1 contrôle volontairement IPv4.

Pour éviter tout contournement, ne fournis pas d'accès IPv6 au VLAN enfants tant qu'une politique IPv6 équivalente n'a pas été ajoutée.

Le plus simple au départ est donc de désactiver RA/DHCPv6 et le routage IPv6 sur le réseau enfants.

## 5. DNS local

Ajoute un nom simple pour l'application :

```routeros
/ip dns static
add name=reward.home.arpa address=192.168.10.10
```

Puis les enfants ouvrent :

```text
http://reward.home.arpa:3000
```

Le firewall local doit permettre au VLAN enfants d'atteindre le mini-PC même lorsque le temps Internet est à zéro.

## 6. Compte RouterOS dédié

N'utilise pas le compte administrateur du routeur dans `.env`.

Crée un groupe et un utilisateur dédiés à RewardConnection. RouterOS sépare bien l'accès REST via la policy `rest-api`.

Exemple pour un mini-PC en `192.168.10.10` :

```routeros
/user group
add name=rewardconnection-rest policy=read,write,rest-api

/user
add name=rewardconnection     group=rewardconnection-rest     address=192.168.10.10/32     password="REMPLACE_PAR_UN_MOT_DE_PASSE_LONG"
```

Le droit `read` permet de lire les ressources et les baux DHCP ; `write` est nécessaire pour rendre un bail statique et modifier l'address-list ; `rest-api` autorise l'accès via REST.

L'adresse autorisée du compte limite en plus son utilisation au mini-PC.

Configure ensuite :

```env
MIKROTIK_ENABLED="true"
MIKROTIK_BASE_URL="https://192.168.10.1"
MIKROTIK_USERNAME="rewardconnection"
MIKROTIK_PASSWORD="mot-de-passe-long"
MIKROTIK_ADDRESS_LIST="rewardconnection-active"
MIKROTIK_CHILD_SUBNET="192.168.20.0/24"
```

## 7. HTTPS RouterOS

Pour la configuration définitive, utilise le service HTTPS RouterOS et limite son accès à l'IP du mini-PC.

Pendant les premiers tests LAN seulement, tu peux utiliser un certificat auto-signé avec :

```env
MIKROTIK_ALLOW_INSECURE_TLS="true"
```

Remets ensuite cette variable à `false` dès qu'un certificat fiable est installé.

N'expose jamais l'API RouterOS directement sur Internet.

## 8. Adresses MAC privées

iPhone, iPad et Android peuvent utiliser des adresses Wi-Fi privées.

Pour le SSID familial, choisis un mode qui conserve une adresse privée stable pour ce réseau. Une adresse qui change régulièrement créerait un nouvel appareil côté DHCP et empêcherait l'association stable.

Les consoles utilisent généralement une MAC stable.

## 9. Contrôle du bon fonctionnement

Dans l'espace parent :

1. clique sur **Tester** dans le panneau MikroTik ;
2. clique sur **Scanner DHCP** ;
3. associe chaque appareil au bon enfant ;
4. donne un jeton ;
5. connecte-toi avec l'enfant et clique sur **Utiliser 1 jeton** ;
6. vérifie dans RouterOS que l'IP apparaît dans `rewardconnection-active` ;
7. vérifie que l'entrée possède un timeout ;
8. clique sur **Couper Internet** côté parent et vérifie que l'entrée disparaît.

## 10. Règle importante

Le contrôle doit être effectué au niveau du routeur et non dans le navigateur.

Même si l'enfant ferme RewardConnection, éteint son téléphone ou utilise une console, le timeout RouterOS continue de s'appliquer.
