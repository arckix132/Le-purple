# Le Purple

Rouge, noir ou Purple ? Un jeu de cartes à défis de 2 à 12 joueurs, sur un seul téléphone qu'on se passe ou chacun sur le sien avec un code de salon.

## Lancer en local

```bash
npm start          # http://localhost:8080
npm test           # moteur de jeu + serveur
```

Il faut Node 20 ou plus. Il n'y a aucune dépendance à installer.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `public/` | Le jeu (HTML, CSS, modules JS), servi tel quel. Pas d'étape de build. |
| `public/game.mjs` | Les règles. Le même fichier tourne dans le navigateur et sur le serveur. |
| `public/ui.mjs` | Les écrans : table, défi, passage du téléphone, salon, podium. |
| `public/app.mjs` | Le chef d'orchestre : états, animations, réseau. |
| `public/sound.mjs` | Les sons, synthétisés à la volée (aucun fichier audio). |
| `public/fx.mjs` | Confettis et étincelles. |
| `public/records.mjs` | Titres de fin de partie et records de l'appareil. |
| `server/` | Petit serveur Node : fichiers statiques, `/api/rooms`, `/api/account`, `/api/social`. |

Le serveur garde ses données en mémoire et les écrit dans `.data/store.json` (variable `DATA_FILE` pour changer l'emplacement, vide pour ne rien écrire). `GOOGLE_CLIENT_ID` active le bouton Google côté client, mais la vérification du jeton Google n'est pas branchée dans ce serveur.

## Compatibilité avec le site en ligne

Le front garde exactement le même contrat d'API que la version d'origine. Deux ajouts sont optionnels et se dégradent proprement avec l'ancien serveur :

- `colorsLeft` dans l'état public d'une partie (compteur rouges/noires). Sans lui, le compteur et les pourcentages sont masqués en ligne.
- `stats` sur chaque joueur (titres de fin de partie). Sans lui, les titres ne s'affichent pas.

Si le serveur en ligne importe `game.mjs`, il suffit de déployer la nouvelle version du fichier pour obtenir les deux.

## Polices

Bagel Fat One et Rubik, sous licence SIL Open Font License, hébergées dans `public/fonts/` pour que le jeu marche hors ligne.
