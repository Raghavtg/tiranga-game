# Tiranga Game — Firebase Ready

This copy is already connected to Firebase project `tiranga-game-92789`.

## Do not edit the code

For the simplest phone-only deployment, upload the contents of this folder to GitHub and connect that repository to Netlify.

### Netlify settings

Build command:
`npm run build`

Publish directory:
`dist`

No Netlify environment variables are required in this version.

### Firebase

Realtime Database URL:
`https://tiranga-game-92789-default-rtdb.firebaseio.com`

The web configuration is already in `src/firebase.js`.

### Current multiplayer behavior

- Shared room state
- Shared real-time player list
- Room creator becomes host
- Only host gets Start for Everyone
- Host start is written to Firebase and broadcast to connected clients
- Player presence is removed on disconnect

### Security warning

The database is currently in public test rules because this is the initial prototype. Before using it for a real event, replace public rules with authenticated/validated rules.

### Games

The project includes the five mobile game screens shown in the supplied design:
1. Freedom Quiz Battle
2. Patriotic Movie Challenge
3. Tiranga Balloon Shooter
4. Tiranga Catch
5. Chakra Tap

The lobby synchronization is the primary multiplayer fix. The game mechanics are playable prototypes and can be hardened into a fully server-authoritative event flow next.
