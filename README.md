# Tiranga Game — Firebase Multiplayer v2

This update keeps the existing Firebase/Netlify architecture and fixes the five game flows.

## Fixed
- 20-question Freedom Quiz; it ends exactly at 20/20.
- Every quiz answer is persisted under the player in Firebase.
- Quiz scoring is persisted.
- Movie answers/scoring are persisted.
- Balloon Shooter, Tiranga Catch and Chakra Tap save their final game score to Firebase.
- Each game reports completion.
- Host advances the shared room to the next game.
- After the final game, host can show the final leaderboard.

## Firebase data shape
rooms/{roomId}/players/{playerId}
- name
- score
- answers/quiz/{question}
- answers/movie/{round}
- gameScores/balloon
- gameScores/catch
- gameScores/chakra

## Deploy
The repository can stay connected to the same Netlify site. Push/commit these updated files to GitHub and Netlify should build automatically.

Build command: npm run build
Publish directory: dist

## Security
The current Firebase database rules are intentionally public for prototype testing. Secure them before a real event.
