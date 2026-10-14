**Language / Язык / Idioma / Langue:** [English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Français](README.fr.md)

---

# Bitcoin Seed Scanner

Outil simple pour **retrouver des bitcoins que beaucoup de portefeuilles ne montrent pas** après restauration d’une seed — et les envoyer.

Beaucoup de portefeuilles ne regardent que le type d’adresse le plus récent. Les anciennes pièces (surtout les adresses en `3...`) peuvent « disparaître » de l’interface alors qu’elles sont toujours sur la blockchain.  
Cet outil vérifie **tous les types d’adresses courants d’un coup**.

> ⚠️ **Ce n’est pas un portefeuille du quotidien.**  
> À utiliser uniquement pour la récupération. Pour de gros montants, préférez un ordinateur propre ou un live USB.

L’application elle-même propose **English · Русский · Español · Français** (sélecteur en haut à droite).

---

## Télécharger et ouvrir (1 minute)

### Option 1 — la plus simple

1. Ouvrez **https://github.com/olegsh247-stack/Bitcoin-Seed-Scanner**
2. Bouton vert **Code** → **Download ZIP**
3. Décompressez l’archive
4. Double-cliquez sur **`index.html`** — ouverture dans le navigateur

### Option 2 — un seul fichier

1. Ouvrez : **https://raw.githubusercontent.com/olegsh247-stack/Bitcoin-Seed-Scanner/main/index.html**
2. Clic droit → **Enregistrer sous…**
3. Ouvrez le fichier enregistré

Internet n’est nécessaire que pour les soldes et la diffusion de la transaction. La seed ne quitte pas le navigateur.

---

## Mode d’emploi

1. Collez votre **phrase seed** (12 ou 24 mots)
2. Entrez la **passphrase** si vous en aviez une
3. Cliquez sur **Find coins**
4. Attendez le scan de tous les types d’adresses
5. Cliquez sur **Select** sur une adresse avec solde
6. Indiquez destinataire et montant → **Prepare**
7. Saisissez les **6 derniers caractères** de l’adresse de destination
8. **Sign and send**

Ensuite fermez l’onglet. Rien n’est enregistré sur le disque.

---

## Ce qui est scanné

| Type d’adresse | Apparence | Chemin |
|----------------|-----------|--------|
| Legacy | commence par **1** | BIP44 |
| Nested SegWit | commence par **3** | BIP49 |
| Native SegWit | commence par **bc1q** | BIP84 |
| Taproot | commence par **bc1p** | BIP86 |

Les chaînes receive et change sont toutes deux scannées.

---

## Sécurité

- Seed et clés uniquement **en mémoire du navigateur**
- Effacées à la fermeture de l’onglet ou via Clear
- Réseau : uniquement mempool.space (soldes, frais, broadcast)
- L’envoi exige de taper les 6 derniers caractères de la destination
- **N’entrez jamais une seed sur un ordinateur non fiable**

---

## Remerciements

Si cet outil vous a aidé à récupérer des fonds, tout remerciement **volontaire** est bienvenu. Ce n’est jamais obligatoire.

---

## Limites

- Bitcoin mainnet uniquement
- Un envoi depuis une seule adresse à la fois
- Ne remplace pas un portefeuille matériel

---

**Utilisez-le avec prudence. Vous êtes responsable de vos fonds.**
