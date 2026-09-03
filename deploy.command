#!/bin/bash
# digitalfa — deploy in un clic.
# Su Mac: fai doppio clic su questo file (se blocca, tasto destro → Apri).
# Oppure da Terminale, dentro la cartella: bash deploy.command
cd "$(dirname "$0")" || exit 1
echo "Cartella: $(pwd)"
if [ ! -d server ] || [ ! -d client ]; then
  echo "ERRORE: non sembra la cartella del progetto (mancano server/ e client/). Sposta questo file nella cartella giusta."
  read -p "Premi Invio per chiudere."; exit 1
fi
REMOTE="https://github.com/extremedigitalfa-debug/Digitalfa.git"
git init -q
git add -A
git commit -q -m "deploy digitalfa $(cat server/index.js | grep -m1 APP_VERSION | sed 's/[^0-9.]//g')" 2>/dev/null || echo "(nessuna modifica nuova da committare)"
git branch -M main
git remote remove origin 2>/dev/null
git remote add origin "$REMOTE"
echo "Invio a GitHub in corso… (se chiede la password, incolla il TOKEN GitHub)"
git push -u origin main --force
echo ""
echo "Fatto. Se vedi 'main -> main' qui sopra, il caricamento è riuscito e Render riparte da solo."
read -p "Premi Invio per chiudere."
