# Nomad ⋆˚꩜｡

Prototype iPhone de lecteur musical avec navigation spatiale par de la musique.

L'utilisateur écoute de la musique dans un casque / écouteurs et s'oriente en suivant la position percue du son dans l'espace (audio 3D), guidé par le prochain évènement Google Calendar.

## Configuration

1. Copier `config.example.js` vers `config.local.js`
2. Renseigner `CLIENT_ID`, `API_KEY` et `MAP_ID` depuis Google Cloud Console

APIs à activer : Google Calendar API, Maps JavaScript API, Geocoding API, Directions API.

## Musique integree

1. Déposer des fichiers .mp3 dans le dossier `music/`
2. Les lister dans `js/app/bundledMusic.js` (url, name, artist)
3. Au chargement, un morceau aléatoire est sélectionné automatiquement

## Bouton BLE (ici c'est une XIAO ESP32-S3, mais n'importe quelle board qui a du bluetooth peut fonctionner (jepense))

Sketch : `firmware/nomad_button/nomad_button.ino`

1. Flasher le firmware
2. **Mac/Android** : Chrome + HTTPS. **iPhone** : app [Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055)
3. Cliquer **Connecter le bouton**, puis appuyer sur le bouton physique

### Bluefy + Google Calendar

Bluefy **bloque les scripts Google** (`accounts.google.com`). Calendar ne peut pas marcher directement dans Bluefy.

**Solution : backend intermediaire** (`server/server.js`)

1. Déployer le serveur (Render gratuit, Railway, etc.)
2. Variables d'environnement serveur :
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET` (depuis Google Cloud Console)
   - `GOOGLE_REDIRECT_URI` = `https://VOTRE-SERVEUR.onrender.com/auth/calendar/callback`
   - `GOOGLE_MAPS_API_KEY`
3. Dans Google Cloud Console, ajouter l'URI de redirection ci-dessus
4. Dans `config.local.js` / secrets GitHub : `CALENDAR_BACKEND_URL` = URL du serveur

**Sur iPhone (Bluefy) :**
1. Appuyer **Connecter Google Calendar** → le lien est copié
2. Ouvrir **Safari**, coller le lien, se connecter a Google
3. Revenir dans Bluefy, appuyer a nouveau **Connecter Google Calendar** pour verifier

Sur Mac/Safari/Chrome, Calendar fonctionne toujours sans serveur (OAuth direct).

## Utilisation

1. Ajouter des fichiers audio locaux
2. Connecter Google Calendar
3. Appuyer sur Play
4. Suivre la musique dans l'espace avec des ecouteurs

# ‧₊˚♪ 𝄞₊˚⊹
