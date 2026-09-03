# digitalfa — Piattaforma di Outplacement / Ricollocamento · v1.0.0

Applicazione **full-stack** di una piattaforma di ricollocamento
professionale: quattro ruoli, abbonamenti a pagamento (**Stripe**),
persistenza reale su **PostgreSQL (Prisma)** e ingestione delle offerte da
**connettori reali** (API pubbliche + architettura pronta per LinkedIn/Indeed).

| Ruolo | Cosa può fare |
|-------|----------------|
| **Candidato** | Percorso, offerte con matching, coaching, risorse, profilo/CV, **Abbonamento**. Per ogni offerta: **3 contatti suggeriti** su LinkedIn, **messaggio pronto <200 caratteri**, **cover letter generata** (scaricabile / allegabile). |
| **Career Coach** | Portfolio candidati, dettaglio, milestone, sessioni, candidature. |
| **Azienda · HR** | Dashboard programma, **Posizioni aperte** (upload), **Abbonamento** aziendale. |
| **Admin** | Panoramica (MRR), **Aziende** (+URL carriere), **Fonti & Scansioni** con **scheduler configurabile** (connettori, test, log), **Posizioni** (attive/non attive), utenti. |

**Autenticazione robusta:** password con hashing **bcrypt**, sessioni via **JWT**
firmati, e login **LinkedIn** (OAuth reale se configurato, altrimenti simulato).

> ⚠️ Prototipo con **dati fittizi** e branding originale ("digitalfa"). Non è un
> clone di alcuna piattaforma esistente.

---

## 🚀 Provalo subito (senza installare nulla)

Apri **`digitalfa-anteprima.html`** (doppio clic): l'app React in un singolo file,
con dati in memoria. Billing e scansioni sono **simulati nel browser** (l'anteprima
non ha backend). Usa "Accesso rapido (demo)" o "Attiva un abbonamento".

Il **vero prodotto** — con database Postgres e chiamate reali alle API di lavoro —
è la versione React + Node qui sotto.

---

## 🧩 Progetto completo (React + Node + PostgreSQL)

### Prerequisiti
Node.js 18+ e PostgreSQL 14+.

### 1) Database
```bash
# crea utente e database (una volta sola)
sudo -u postgres psql -c "CREATE ROLE digitalfa LOGIN PASSWORD 'digitalfa' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE digitalfa OWNER digitalfa;"
```

### 2) Backend
```bash
cd server
cp .env.example .env          # contiene DATABASE_URL (adattalo se serve)
npm install
npx prisma db push            # crea le tabelle dallo schema Prisma
npm run seed                  # popola i dati demo
npm start                     # → http://localhost:4000
```

### 3) Frontend
```bash
cd client
npm install
npm run dev                   # → http://localhost:5173  (proxy /api → :4000)
```

### Deploy in un unico processo
```bash
cd client && npm install && npm run build
cd ../server && npm start      # serve API + client su :4000
```

---

## 🗄 Persistenza — PostgreSQL + Prisma

Lo schema completo è in **`server/prisma/schema.prisma`** (Company, User,
Program, Progress, Plan, Subscription, Source, Job, Application, Session,
Resource, ScanLog). L'accesso ai dati passa tutto da Prisma Client — nessuno
store in memoria: **i dati sopravvivono ai riavvii**.

Comandi utili:
```bash
npx prisma studio        # GUI per esplorare il DB
npx prisma db push       # applica modifiche allo schema (dev)
npx prisma migrate dev   # crea una migrazione versionata (produzione)
npm run seed             # ripopola i dati demo
```

`DATABASE_URL` in `.env` punta a Postgres. Per un altro host/credenziali,
basta cambiarlo.

---

## 🔌 Connettori — ingestione offerte reali

Sezione admin **Fonti & Scansioni**: ogni fonte ha un **connettore** che
recupera le offerte. Codice in **`server/connectors/index.js`**.

| Connettore | Cosa fa |
|-----------|---------|
| **Arbeitnow API (reale)** | Chiama l'API pubblica `arbeitnow.com` (nessuna chiave), mappa i risultati e li salva. **Funziona davvero, già ora.** |
| **HTTP/JSON generico** | Config-driven (`apiConfig: { url, arrayPath, map }`): collega qualsiasi API REST che restituisce offerte, mappando i campi. |
| **Feed RSS** | Legge un feed RSS/Atom di annunci. |
| **LinkedIn / Indeed Partner API** | Punto di aggancio pronto: con `LINKEDIN_API_KEY` / `INDEED_API_KEY` (o `apiConfig.apiKey`) si collega l'endpoint partner; senza chiavi usa dati simulati. |
| **Simulato** | Generatore locale, per demo/test. |

**Lifecycle automatico** (motore `runScan`): le offerte ancora presenti restano
**attive** (aggiornata "ultima vista"); le nuove vengono **aggiunte**; quelle
non più presenti — per i connettori che restituiscono l'elenco completo —
vengono **archiviate** (→ non attive). Ogni run scrive un record in `ScanLog`.

Nella UI: pulsante **Testa** (dry-run senza scrivere sul DB) e **Scansiona**
(esegue e persiste). Il messaggio mostra la modalità reale/simulata.

> ⚖️ Nota legale: lo scraping diretto di LinkedIn/Indeed viola i loro Termini.
> Per il go-live usa le **API/partnership ufficiali** per quei portali; per gli
> altri, API pubbliche/feed come nell'esempio Arbeitnow.

---

## ⏱ Scheduler (configurabile da Admin, senza toccare il codice)

In **Fonti & Scansioni** un pannello permette di: attivare/mettere in pausa lo
scheduler, impostare **ogni quanto** controllare le fonti (30s → 1 ora),
accendere/spegnere l'**auto-scan per singola fonte**, lanciare una **scansione
immediata** di una fonte o di **tutte** ("Scansiona tutte ora"), e vedere
**prossima esecuzione** e **ultimo check**.

Lo scheduler è un ticker in-process (`server/index.js`): alla frequenza
impostata scansiona le fonti attive con auto-scan la cui `nextScanAt` è scaduta.
Configurazione salvata nella tabella `Setting`; per fermarlo del tutto
`SCHEDULER_DISABLED=1`. Per produzione con più istanze, si sostituisce con una
coda/cron esterni (BullMQ, cron di sistema) riusando la stessa funzione `runScan`.

---

## 🔐 Autenticazione

- **Password**: registrazione con nome/email/password; le password sono salvate
  con hash **bcrypt** (mai in chiaro). Login via `bcrypt.compare`.
- **Sessioni**: **JWT** firmati (`JWT_SECRET`), scadenza 7 giorni, inviati come
  `Authorization: Bearer`.
- **LinkedIn**: pulsante "Continua con LinkedIn". Con `LINKEDIN_CLIENT_ID/SECRET`
  parte l'**OAuth reale** (authorization code → userinfo OpenID Connect →
  find-or-create utente → redirect con JWT). Senza credenziali, un flusso
  **simulato** crea/collega un account demo, così la funzione è provabile subito.

```bash
export JWT_SECRET=una-chiave-lunga-e-segreta
export LINKEDIN_CLIENT_ID=xxx
export LINKEDIN_CLIENT_SECRET=xxx
export LINKEDIN_REDIRECT_URI=http://localhost:4000/api/auth/linkedin/callback
```

---

## ✍️ Kit di candidatura (per ogni offerta)

Nella scheda **Offerte per me**, ogni opportunità offre:
- **3 contatti suggeriti**: nome, ruolo e un **link di ricerca LinkedIn** mirato
  al ruolo in azienda. I nomi sono suggerimenti; con un provider dati sui
  contatti (es. Sales Navigator/People Data API) diventano profili puntuali.
- **Messaggio pronto < 200 caratteri** da inviare, con pulsante *copia*.
- **Cover letter generata** automaticamente: scaricabile (.txt) e, quando la
  posizione lo consente (es. caricata da un'azienda sulla piattaforma),
  **allegabile alla candidatura**.

I generatori (`server/generators.js`) sono template deterministici pronti per
essere sostituiti da una chiamata a un LLM (il punto d'aggancio è documentato
nel file).

---

## 💳 Pagamenti — Stripe

Senza chiavi il billing è **simulato**. Per attivare Stripe reale (test mode):
```bash
export STRIPE_SECRET_KEY=sk_test_xxx
export STRIPE_WEBHOOK_SECRET=whsec_xxx
export FRONTEND_URL=http://localhost:5173
```
Checkout Session in modalità `subscription`, webhook `checkout.session.completed`,
billing portal. Compila `priceId` nei piani (`prisma/schema.prisma` → tabella
`Plan`, o via seed) con i Price ID reali quando vai live.

Piani: Individuale *Free* / *Pro €29*; Azienda *Starter €149*, *Business €399*,
*Enterprise* su contatto.

---

## 🚀 Deploy in produzione (hosting gratuito)

Il repo è pronto al deploy. Il server, in produzione, esegue le migrazioni
(`prisma migrate deploy`) e serve anche il frontend buildato: **un solo servizio**.

### Opzione A — Render.com (Blueprint, gratis) · consigliata
1. Carica questa cartella su un repository **GitHub**.
2. Su [render.com](https://render.com): **New → Blueprint**, seleziona il repo.
   Render legge `render.yaml` e crea **web service + database PostgreSQL** (piano free).
3. Al primo avvio: migrazioni + (con `SEED_ON_EMPTY=1`) dati demo caricati.
4. Ottieni un dominio tipo `https://digitalfa-xxxx.onrender.com`. Imposta la env
   `FRONTEND_URL` con quell'URL (serve per i redirect di Stripe/LinkedIn).
5. Attiva le funzioni "reali" incollando le chiavi come env (Stripe, LinkedIn, LLM).

> Il piano free va in **sleep** dopo inattività: lo scheduler embedded non gira
> mentre dorme. Per scansioni pianificate anche da spento, crea un cron gratuito
> (es. **cron-job.org**) che chiama `POST /api/scheduler/tick` con header
> `x-cron-secret: <CRON_SECRET>` alla cadenza desiderata.

### Opzione B — Docker (Fly.io, Railway, qualsiasi host)
```bash
docker build -t digitalfa .
docker run -p 4000:4000 -e DATABASE_URL=... -e JWT_SECRET=... digitalfa
```
Il `Dockerfile` builda client + server e avvia con migrazioni. Serve un Postgres
gestito (es. **Neon**, free) da passare in `DATABASE_URL`.

### Solo anteprima statica (front-end)
`digitalfa-anteprima.html` è un singolo file: puoi trascinarlo su
**Netlify Drop** / **GitHub Pages** per un URL pubblico immediato (senza backend,
dati in memoria) utile per far provare la UX.

---

## 🔑 Account demo

| Ruolo | Email | Password |
|-------|-------|----------|
| Candidato | `candidate@digitalfa.demo` | `demo` |
| Career Coach | `coach@digitalfa.demo` | `demo` |
| Azienda · HR | `hr@digitalfa.demo` | `demo` |
| Admin | `admin@digitalfa.demo` | `demo` |

---

## 🗂 Struttura

```
digitalfa/
├─ digitalfa-anteprima.html      # anteprima single-file (in-memory)
├─ server/                     # backend Node/Express + Prisma
│  ├─ index.js                 # API REST (async, Prisma), scan engine, Stripe
│  ├─ data.js                  # dataset seed condiviso
│  ├─ seedDb.js                # logica di seeding (usata da seed + reset)
│  ├─ connectors/index.js      # connettori (Arbeitnow reale, http_json, rss, partner)
│  ├─ prisma/schema.prisma     # schema PostgreSQL
│  └─ prisma/seed.js           # `npm run seed`
└─ client/                     # frontend React (Vite)
   └─ src/{api,mockApi,App}.jsx, pages/, components/
```

## 🛠 Stack
React 18 · React Router · Vite · Node.js · Express · **Prisma · PostgreSQL** ·
Stripe · **bcrypt + JWT** · LinkedIn OAuth · scheduler in-process

## 🔭 Prossimi passi
Hashing password + JWT/refresh, migrazioni versionate in CI, scheduler reale
delle scansioni (cron/queue), connettori partner LinkedIn/Indeed con OAuth,
upload CV su storage, notifiche email, ruoli/permessi granulari.
