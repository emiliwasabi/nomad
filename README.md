# Murmur

Prototype iPhone de lecteur musical avec navigation spatiale par la musique.

L'utilisateur écoute de la musique et s'oriente en suivant la position percue du son dans l'espace (gauche / droite / centre), guidé par le prochain évènement Google Calendar.

## Configuration

1. Copier `config.example.js` vers `config.local.js`
2. Renseigner `CLIENT_ID`, `API_KEY` et `MAP_ID` depuis Google Cloud Console

APIs a activer : Google Calendar API, Maps JavaScript API, Geocoding API, Directions API.

## Lancer en local (Mac)

```bash
# Terminal 1 — backend optionnel
GOOGLE_MAPS_API_KEY=votre_cle node server/server.js

# Terminal 2 — frontend
python3 -m http.server 5500
```

Ouvrir : http://127.0.0.1:5500/

## iPhone (HTTPS obligatoire)

Deployer sur GitHub Pages puis ouvrir l'URL HTTPS sur l'iPhone.

Dans Google Cloud Console, ajouter l'origine OAuth :
`https://votre-pseudo.github.io`

Ajouter sur l'ecran d'accueil iPhone via Safari : Partager → Sur l'ecran d'accueil.

## Utilisation

1. Ajouter des fichiers audio locaux
2. Connecter Google Calendar
3. Appuyer sur Play
4. Suivre la musique dans l'espace avec des ecouteurs
