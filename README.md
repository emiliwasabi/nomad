# Murmur

Prototype iPhone de lecteur musical avec navigation spatiale par la musique.

L'utilisateur écoute de la musique et s'oriente en suivant la position percue du son dans l'espace (gauche / droite / centre), guidé par le prochain évènement Google Calendar.

## Configuration

1. Copier `config.example.js` vers `config.local.js`
2. Renseigner `CLIENT_ID`, `API_KEY` et `MAP_ID` depuis Google Cloud Console

APIs a activer : Google Calendar API, Maps JavaScript API, Geocoding API, Directions API.

## Musique integree

1. Deposer tes fichiers MP3 dans le dossier `music/`
2. Les lister dans `js/app/bundledMusic.js` (url, name, artist)
3. Au chargement, un morceau aleatoire est selectionne automatiquement

L'upload de fichiers reste disponible en option.

## Bouton BLE (XIAO ESP32-S3)

Sketch : `firmware/murmur_button/murmur_button.ino`

1. Flasher le firmware (corrige `GATT_INSUF_AUTHENTICATION` : pas de pairing requis)
2. **Mac/Android** : Chrome + HTTPS. **iPhone** : app [Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055) (Chrome iOS ne supporte pas Web Bluetooth)
3. Cliquer **Connecter bouton Murmur**, puis appuyer sur le bouton physique

## Lancer en local (Mac)

```bash
# Terminal 1 — backend optionnel
GOOGLE_MAPS_API_KEY=votre_cle node server/server.js

# Terminal 2 — frontend
python3 -m http.server 5500
```

Ouvrir : http://127.0.0.1:5500/

## iPhone (HTTPS obligatoire)

### Deploiement GitHub Pages

1. Ajouter les secrets Actions : `GCAL_CLIENT_ID`, `GCAL_API_KEY`, `GCAL_MAP_ID`
2. Settings → Pages → Source : **GitHub Actions**
3. Pousser sur `main` — le workflow `.github/workflows/deploy-pages.yml` genere `config.local.js` et deploie
4. Ouvrir sur l'iPhone : `https://emiliwasabi.github.io/murmur/`

Dans Google Cloud Console (Credentials → ton client OAuth Web) :
- **Origines JavaScript autorisees** : `https://emiliwasabi.github.io`
- **URI de redirection autorisees** (obligatoire pour Bluefy/iPhone) :
  - `https://emiliwasabi.github.io/murmur/`
- **Referrer API key** : `https://emiliwasabi.github.io/murmur/*`

### Bluefy + Google Calendar

Bluefy **bloque les scripts Google** (`accounts.google.com`). Calendar ne peut pas marcher directement dans Bluefy.

**Solution : serveur intermediaire** (`server/server.js`)

1. Deployer le serveur (Render gratuit, Railway, etc.)
2. Variables d'environnement serveur :
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET` (depuis Google Cloud Console)
   - `GOOGLE_REDIRECT_URI` = `https://VOTRE-SERVEUR.onrender.com/auth/calendar/callback`
   - `GOOGLE_MAPS_API_KEY`
3. Dans Google Cloud Console, ajouter l'URI de redirection ci-dessus
4. Dans `config.local.js` / secrets GitHub : `CALENDAR_BACKEND_URL` = URL du serveur

**Sur iPhone (Bluefy) :**
1. Appuyer **Connecter Google Calendar** → le lien est copie
2. Ouvrir **Safari**, coller le lien, se connecter a Google
3. Revenir dans Bluefy, appuyer a nouveau **Connecter Google Calendar** pour verifier

Sur Mac/Safari/Chrome, Calendar fonctionne toujours sans serveur (OAuth direct).

Ajouter sur l'ecran d'accueil iPhone via Safari : Partager → Sur l'ecran d'accueil.

## Utilisation

1. Ajouter des fichiers audio locaux
2. Connecter Google Calendar
3. Appuyer sur Play
4. Suivre la musique dans l'espace avec des ecouteurs
