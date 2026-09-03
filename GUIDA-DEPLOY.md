# digitalfa — Guida passo-passo per andare Live (hosting gratuito)

Obiettivo: pubblicare digitalfa su un URL pubblico usando **solo servizi gratuiti**.
Tempo stimato: ~15 minuti. Non serve saper programmare.

Useremo due account gratuiti:
- **GitHub** → dove "parcheggiare" il codice.
- **Render** → dove gira l'app (server + database).

> Nota sui limiti del piano free di Render (verificati ad agosto 2026):
> - il **web service** si addormenta dopo ~15 min di inattività (la prima
>   visita dopo la pausa impiega qualche secondo a ripartire) e ha 750 ore/mese;
> - il **database PostgreSQL gratuito scade dopo 30 giorni**.
> Per un test va benissimo. Se ti serve un database che non scade, in fondo trovi
> l'alternativa gratuita **Neon** (§7).

---

## 1) Crea l'account GitHub e installa Git

1. Vai su https://github.com e registra un account gratuito.
2. Installa **Git** sul tuo computer: https://git-scm.com/downloads
   (su Mac spesso c'è già; per verificarlo apri il Terminale e scrivi `git --version`).

## 2) Metti il codice su GitHub

1. Scompatta `digitalfa.zip`: otterrai una cartella `digitalfa`.
2. Su GitHub clicca **New repository**, nome es. `digitalfa`, lascialo **Private**
   o Public, **non** aggiungere README/gitignore (ci sono già), poi **Create**.
3. GitHub ti mostra un indirizzo tipo `https://github.com/TUONOME/digitalfa.git`.
   Copialo.
4. Apri il Terminale nella cartella `digitalfa` ed esegui (sostituisci l'URL):

```bash
cd digitalfa
git init
git add .
git commit -m "digitalfa v1.0.0"
git branch -M main
git remote add origin https://github.com/TUONOME/digitalfa.git
git push -u origin main
```

Se Git ti chiede le credenziali, usa nome utente GitHub e un **Personal Access
Token** (GitHub → Settings → Developer settings → Tokens) al posto della password.

## 3) Crea l'account Render

1. Vai su https://render.com e clicca **Get Started**.
2. Registrati con **"Sign in with GitHub"** (è la via più semplice: collega
   subito i tuoi repository).

## 4) Deploy con il Blueprint (un clic)

1. Nella dashboard Render: **New +** → **Blueprint**.
2. Seleziona il repository `digitalfa`. Render legge il file `render.yaml` incluso
   e propone di creare **due risorse**: il web service `digitalfa` e il database
   `digitalfa-db` (entrambi piano **Free**).
3. Clicca **Apply** / **Create**. Render inizia a costruire:
   builda il frontend, installa il server, applica le **migrazioni** del database
   e (grazie a `SEED_ON_EMPTY=1`) carica i **dati demo** al primo avvio.
4. Attendi che lo stato diventi **Live** (qualche minuto).

## 5) Apri l'app e imposta l'URL pubblico

1. In alto nel servizio trovi l'indirizzo pubblico, tipo
   `https://digitalfa-xxxx.onrender.com`. Aprilo: vedrai la schermata di login.
2. Torna in Render → servizio `digitalfa` → **Environment** → imposta la variabile
   **`FRONTEND_URL`** con quell'URL completo (serve per i redirect di
   LinkedIn/Stripe). Salva: Render fa un redeploy automatico.
3. Entra con un account demo (li trovi anche nella schermata):
   - Admin: `admin@digitalfa.demo` / `demo`
   - Candidato: `candidate@digitalfa.demo` / `demo`
   - Azienda/HR: `hr@digitalfa.demo` / `demo`
   - Coach: `coach@digitalfa.demo` / `demo`

🎉 Sei Live.

## 6) (Opzionale) Attiva le funzioni "reali"

Tutto funziona in modalità simulata senza chiavi. Per attivare il reale, aggiungi
le variabili in **Environment** (poi Render fa redeploy):

- **LLM** (messaggi e cover letter scritti da un modello):
  `LLM_API_KEY` (chiave OpenAI o compatibile) ed eventualmente `LLM_MODEL`
  (default `gpt-4o-mini`). In alternativa `ANTHROPIC_API_KEY` +
  `LLM_MODEL=claude-3-5-haiku-latest`.
- **Stripe** (pagamenti veri in test): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **LinkedIn** (login OAuth vero): `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
  `LINKEDIN_REDIRECT_URI = https://TUO-DOMINIO/api/auth/linkedin/callback`.

### Scheduler sempre attivo anche se l'app "dorme"
Il piano free si addormenta. Per far girare le scansioni a orari fissi, crea un
cron gratuito su **https://cron-job.org**:
- URL: `https://TUO-DOMINIO/api/scheduler/tick`
- Metodo: **POST**
- Header: `x-cron-secret: <valore di CRON_SECRET>` (lo trovi/generi in Environment)
- Frequenza: es. ogni 30 minuti.
Questo "sveglia" l'app ed esegue le scansioni dovute.

## 7) (Opzionale) Database che non scade — Neon

Se non vuoi il limite dei 30 giorni del DB Render:
1. Crea un account gratuito su https://neon.tech e un progetto Postgres.
2. Copia la **connection string** (`postgresql://…`).
3. In Render → `digitalfa` → Environment → imposta `DATABASE_URL` con quella di Neon
   e **rimuovi** il database `digitalfa-db` dal Blueprint (o ignoralo).
4. Redeploy: le migrazioni girano sul database Neon.

## 8) (Opzionale) Collega un tuo dominio

Render → servizio `digitalfa` → **Settings → Custom Domains** → **Add**.
Segui i record DNS indicati nel pannello del tuo provider:
- sottodominio (es. `app.tuodominio.it`) → record **CNAME** verso l'hostname
  `…onrender.com`;
- dominio radice (`tuodominio.it`) → record **A** verso l'IP indicato (o
  **ALIAS/ANAME** se supportato, es. Cloudflare).
Render emette il certificato **HTTPS** automaticamente. Ricorda di aggiornare
`FRONTEND_URL` (e `LINKEDIN_REDIRECT_URI`) con il nuovo dominio.

---

## Aggiornare l'app in futuro
Ogni volta che modifichi il codice:
```bash
git add . && git commit -m "modifiche" && git push
```
Render ridistribuisce da solo (autoDeploy è attivo).

## Problemi comuni
- **Build fallita**: apri i **Logs** in Render, di solito indica la riga.
- **"Application failed to respond"**: attendi qualche secondo (l'app si stava
  svegliando dallo sleep) e ricarica.
- **Login non funziona**: assicurati che il primo deploy abbia fatto il seed
  (nei log cerchi `[seed]`); altrimenti in Render apri la **Shell** del servizio
  e lancia `cd server && npm run seed`.
