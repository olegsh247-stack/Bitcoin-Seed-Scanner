**Language / Язык / Idioma / Langue:** [English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Français](README.fr.md)

---

# Bitcoin Seed Scanner

Les portefeuilles modernes n’affichent souvent pas le **solde** après la restauration d’une phrase seed. Un programme simple qui **retrouve vos bitcoins** et permet de les **envoyer**.

Beaucoup de portefeuilles ne regardent que le type d’adresse le plus récent. Les anciennes pièces (surtout les adresses en `3...`) peuvent « disparaître » de l’interface alors qu’elles sont toujours sur la blockchain.  
Cet outil vérifie **tous les types d’adresses courants d’un coup**.

> ⚠️ **Ce n’est pas un portefeuille du quotidien.**  
> À utiliser uniquement pour la récupération. Pour de gros montants, préférez un ordinateur propre ou un live USB.

L’application elle-même propose **English · Русский · Español · Français** (sélecteur en haut à droite).

---

## Source officielle uniquement

Téléchargez **uniquement** depuis ce dépôt :

**https://github.com/olegsh247-stack/Bitcoin-Seed-Scanner**

Les copies provenant d’autres sites ou de messageries peuvent être modifiées pour voler votre seed.

---

## Comment télécharger et lancer

1. Ouvrez cette page GitHub et cliquez sur le bouton vert **Code** → **Download ZIP**.
2. Décompressez l’archive téléchargée : clic droit → **« Extraire tout… »** (sur Mac : double-clic).
3. Dans le dossier décompressé, double-cliquez sur le fichier **`index.html`**. Il s’ouvre dans le navigateur. Inutile de toucher aux autres fichiers du dossier.
4. Internet ne sert qu’à consulter les soldes et envoyer une transaction. Votre phrase secrète ne quitte jamais le navigateur.

Téléchargez uniquement depuis cette page GitHub. N’utilisez pas un fichier reçu par e-mail ou par messagerie.

---

## Mode d’emploi

1. Saisissez votre **phrase seed**, un mot par case (12 ou 24 : commutateur au-dessus des cases). Vous pouvez coller toute la phrase dans n’importe quelle case. Les cases deviennent **vertes** si la phrase est valide et **rouges** sinon.
2. Entrez la **passphrase** si vous en aviez une
3. Cliquez sur **Find coins**
4. Attendez le scan de tous les types d’adresses
5. Cliquez sur **Select** sur une adresse avec solde
6. Indiquez destinataire et montant → **Prepare**
7. Saisissez les **6 derniers caractères** de l’adresse de destination
8. **Sign and send**

Ensuite fermez l’onglet. Rien n’est enregistré sur le disque.

Le bouton **« Aide »** (en haut à droite dans l’application) affiche ce guide dans l’application elle-même.

---

## Ce qui est scanné

| Type d’adresse | Apparence | Chemin |
|----------------|-----------|--------|
| Legacy | commence par **1** | BIP44 |
| Nested SegWit | commence par **3** | BIP49 |
| Native SegWit | commence par **bc1q** | BIP84 |
| Taproot | commence par **bc1p** | BIP86 |

Les chaînes receive et change sont toutes deux scannées. Chaque liste d’adresses est parcourue jusqu’à **25 adresses inutilisées d’affilée** (« gap limit » : valeur standard, suffisante pour presque tous les portefeuilles ; **25 par défaut**, rien à régler).

**Numéro de compte** (**0** par défaut) : le premier compte du portefeuille. Saisissez 1, 2… seulement si votre portefeuille avait plusieurs comptes et que les pièces n’ont pas été trouvées dans le premier.

**Gagnez du temps :** si vous connaissez déjà vos adresses, vérifiez d’abord leur type dans le bloc **« Vérifier une adresse »**, puis ne scannez que les types utiles. Les boutons **« Type d’adresse »** (BIP44 / BIP49 / BIP84 / BIP86), au-dessus des cases du seed, activent ou désactivent chaque type ; les quatre sont activés par défaut.

---

## Sécurité

- Seed et clés uniquement **en mémoire du navigateur**
- Effacées à la fermeture de l’onglet ou via Clear
- Réseau : uniquement mempool.space (soldes, frais, envoi). **Rien n’est téléchargé depuis Internet** : tout le programme est dans le fichier unique.
- **Confidentialité :** pour vérifier les soldes, la page envoie toutes les adresses dérivées à mempool.space ; ce service (et quiconque observe votre connexion) peut donc les relier entre elles et voir votre IP. Utilisez Tor/VPN ou votre propre nœud si cela compte pour vous.
- Si la consultation d’un solde échoue (réseau, limite de requêtes), l’outil le signale au lieu d’afficher « aucun fonds ». Si vous voyez cet avertissement, relancez le scan.
- L’envoi exige de taper les 6 derniers caractères de la destination
- **N’entrez jamais une seed sur un ordinateur non fiable**

---

## Remerciements

Si ce programme vous a aidé à récupérer vos fonds — nous accepterons volontiers votre remerciement volontaire. Cela n'oblige à rien et sera certainement compté par le Tout-Puissant. 🙏

| Actif | Réseau | Adresse |
|-------|--------|--------|
| BTC | Legacy (P2PKH) | `1GgXo15BHD2CJorJaVhhhB8AvTszr1Nrpc` |
| BTC | Nested SegWit (P2SH) | `3B6wA2Yu5nH9FYXAakkHd79ijnQ16RoD5G` |
| BTC | Native SegWit (P2WPKH) | `bc1qy9ht50kfehlxynwew20eh47c8x9pyvq7pc2umq` |
| BTC | SegWit (P2WSH) | `bc1q56kmywwmlvt6xp04zr63g9nff2ye0p7j2txhz9ccs087dxmr8gnqevee4d` |
| BTC | Taproot (P2TR) | `bc1p6wk0ecu3355m0eymwd92a7f8d99w7lyx5s4xek8nm7razg4hjvqqfxdvx9` |
| USDT | TRC-20 | `TVXzchqZdvRqTCJutjGgF1xVP5kuDfk2nx` |
| USDT | ERC-20 | `0x761B53654e2333261649eEb8857B752A60f11435` |

---

## Limites

- Bitcoin mainnet uniquement
- Un envoi depuis une seule adresse à la fois
- Ne remplace pas un portefeuille matériel

---

**Utilisez-le avec prudence. Vous êtes responsable de vos fonds.**

---

## Licence

Publié sous [licence MIT](LICENSE) : utilisation, copie et modification libres, « en l’état », sans garantie d’aucune sorte.

> Les adresses de remerciement sont publiées **uniquement dans ce README**, et non dans l’application, afin qu’aucune ne figure à côté du champ de la seed. Vérifiez toute adresse ici, sur le dépôt officiel, avant d’envoyer.

---

<details>
<summary>Pour utilisateurs avancés : vérifier le fichier / compiler</summary>

### Vérifier le fichier (optionnel, recommandé)

Après avoir enregistré `index.html`, vérifiez le SHA-256 :

```
a4866a52479fe6849c0d7caf9ce8d302db79b5d8a07ae4ac908db524745e096f
```

- **Linux / macOS :** `sha256sum index.html` (ou `shasum -a 256 index.html`)
- **Windows (PowerShell) :** `Get-FileHash index.html -Algorithm SHA256`

Si le hash ne correspond pas — n’utilisez pas ce fichier.

*(Mettez à jour ce hash à chaque nouvelle version de `index.html`.)*

### Compiler depuis les sources (facultatif)

`index.html` est généré à partir de `src/` (modifiez `src/template.html` et `src/app.js`, **pas** `index.html`). Pour le reproduire à l’octet près et le comparer à la somme de contrôle ci-dessus :

```
npm ci
npm run build   # écrit index.html et met à jour le SHA-256 dans tous les README
npm test
```

</details>
