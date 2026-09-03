# digitalfa — Guida passo-passo per andare Live su Koyeb (gratis, app + database)

Obiettivo: pubblicare digitalfa su **un'unica piattaforma gratuita** (Koyeb),
con **app e database PostgreSQL insieme** e **dati che restano** (nessuna
scadenza). Tempo stimato: ~20 minuti. Non serve saper programmare.

Useremo due account gratuiti:
- **GitHub** → dove "parcheggiare" il codice.
- **Koyeb** → dove girano insieme l'app e il database.

> Limiti del piano free di Koyeb (validi ad agosto 2026): app e database vanno in
> **pausa dopo ~5 min di inattività** (la prima visita dopo la pausa impiega
> qualche secondo a ripartire, ma **non si perde nulla**); il database free ha
> ~1 GB RAM e ~50 ore "attive" al mese ed è **persistente** (senza scadenza).
> Perfetto per test e demo con dati che restano.

---

## 1) Metti il codice su GitHub

Se lo hai già fatto (dalla guida Render), salta al punto 2.

1. Crea un account su https://github.com e installa **Git**
   (https://git-scm.com/downloads).
2. Su GitHub: **New repository**, nome `digitalfa`, **Create** (non aggiungere
   README/gitignore: ci sono già).
3. Scompatta `digitalfa.zip`, apri il Terminale nella cartella `digitalfa` e
   lancia (sostituisci l'URL con quello del tuo repo):

```bash
cd digitalfa
git init
git add .
git commit -m "digitalfa v1.0.0"
git branch -M main
git remote add origin https://github.com/TUONOME/digitalfa.git
git push -u origin main
```

## 2) Crea l'account Koyeb

1. Vai su https://www.koyeb.com e clicca **Sign up**.
2. Registrati con **GitHub** (così Koyeb può leggere il tuo repository).
   Potrebbe chiederti di verificare l'email.

## 3) Crea il database PostgreSQL (persistente)

1. Nella dashboard Koyeb, sezione **Database** → **Create Database Service**.
2. Scegli **PostgreSQL**, regione vicina (es. Frankfurt), piano **Free**.
3. Dagli un nome, es. `digitalfa-db`, e crea.
4. Ad attivazione, apri il database e copia la **Connection string** — è un
   testo che inizia con `postgresql://…` (a volte chiamata "psql/URI"). **Tienila
   da parte**: ci serve tra un attimo come `DATABASE_URL`.

> In alternativa puoi usare un database **Neon** (https://neon.tech, free e
> persistente): crei il progetto, copi la sua connection string e la usi come
> `DATABASE_URL`. Il resto della guida è identico.

## 4) Crea il servizio web (l'app) dal repo

1. Dashboard Koyeb → **Create Web Service** → **GitHub** → seleziona il repo
   `digitalfa`, branch `main`.
2. **Builder**: scegli **Dockerfile** (il repo ne contiene già uno alla radice;
   Koyeb lo rileva). Lascia il resto ai valori predefiniti.
3. **Instance**: seleziona il tipo **Free**.
4. **Exposed ports / Porta**: imposta la porta **8000** (vedi nota env sotto).
5. **Health check**: imposta il path **`/api/health`** (metodo GET).

## 5) Imposta le variabili d'ambiente

Nella sezione **Environment variables** del servizio, aggiungi:

| Nome | Valore |
|------|--------|
| `DATABASE_URL` | la connection string copiata al punto 3 (`postgresql://…`) |
| `PORT` | `8000` |
| `JWT_SECRET` | una frase lunga e segreta a tua scelta |
| `CRON_SECRET` | una frase segreta (serve per lo scheduler, punto 8) |
| `SEED_ON_EMPTY` | `1` (carica i dati demo al primo avvio) |
| `NODE_ENV` | `production` |

> Perché `PORT=8000`: l'app legge la porta dalla variabile `PORT` e deve
> coincidere con la "Exposed port" del punto 4. Se preferisci un'altra porta,
> basta che i due valori siano uguali.

Poi clicca **Deploy**. Koyeb builda l'immagine Docker (frontend + backend),
avvia l'app, applica le **migrazioni** del database (`prisma migrate deploy`) e
carica i **dati demo**. Attendi che lo stato diventi **Healthy/Running**.

## 6) Apri l'app e completa la configurazione

1. Koyeb ti dà un URL pubblico tipo `https://digitalfa-tuonome.koyeb.app`.
   Aprilo: vedi la schermata di login.
2. Torna nelle **Environment variables**, aggiungi `FRONTEND_URL` con quell'URL
   completo (serve per i redirect di LinkedIn/Stripe) e **Redeploy**.
3. Accedi con un account demo:
   - Admin: `admin@digitalfa.demo` / `demo`
   - Candidato: `candidate@digitalfa.demo` / `demo`
   - Azienda/HR: `hr@digitalfa.demo` / `demo`
   - Coach: `coach@digitalfa.demo` / `demo`

🎉 App **e** database sono Live sulla stessa piattaforma, con dati che restano.

## 7) (Opzionale) Attiva le funzioni "reali"

Aggiungi altre variabili d'ambiente (poi Redeploy):
- **LLM** (messaggi e cover letter scritti da un modello): `LLM_API_KEY`
  (OpenAI o compatibile) ed eventualmente `LLM_MODEL` (default `gpt-4o-mini`);
  in alternativa `ANTHROPIC_API_KEY` + `LLM_MODEL=claude-3-5-haiku-latest`.
- **Stripe** (pagamenti veri in test): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **LinkedIn** (login OAuth vero): `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
  `LINKEDIN_REDIRECT_URI = https://TUO-URL/api/auth/linkedin/callback`.

## 8) (Opzionale) Scheduler sempre attivo anche quando l'app "dorme"

Il free va in pausa. Per far girare le scansioni a orari fissi, crea un cron
gratuito su https://cron-job.org:
- URL: `https://TUO-URL/api/scheduler/tick`
- Metodo: **POST**
- Header: `x-cron-secret: <il valore di CRON_SECRET>`
- Frequenza: es. ogni 30 minuti.
Questo "sveglia" l'app ed esegue le scansioni dovute.

## 9) (Opzionale) Collega un tuo dominio

Koyeb → servizio → **Settings → Domains** → **Add domain**. Segui i record DNS
indicati nel pannello del tuo provider (di norma un **CNAME** dal tuo
sottodominio verso l'hostname `…koyeb.app`). Koyeb emette l'**HTTPS**
automaticamente. Ricorda di aggiornare `FRONTEND_URL` (e `LINKEDIN_REDIRECT_URI`)
con il nuovo dominio.

---

## Aggiornare l'app in futuro
Ogni volta che modifichi il codice:
```bash
git add . && git commit -m "modifiche" && git push
```
Koyeb ricostruisce e ridistribuisce da solo (auto-deploy dal branch `main`).

## Problemi comuni
- **Build fallita**: apri i **Logs** del servizio su Koyeb; di solito indicano
  la riga o il comando che ha fallito.
- **L'app non risponde / 502 subito dopo il deploy**: attendi che lo stato sia
  *Healthy* e che il health check `/api/health` passi; la prima volta ci mette
  un minuto in più.
- **"Can't reach database"**: verifica che `DATABASE_URL` sia esatta e che il
  database Koyeb (o Neon) sia attivo; se era in pausa, la prima connessione lo
  risveglia in pochi secondi.
- **Login non funziona**: controlla nei log che al primo avvio sia comparso
  `[seed]`; altrimenti apri la Console/Shell del servizio e lancia
  `cd server && npm run seed`.
- **La porta non combacia**: `Exposed port` e la variabile `PORT` devono avere
  lo stesso valore (8000 nella guida).
