# Changelog — digitalfa

Versionamento semantico (MAJOR.MINOR.PATCH).

## [1.36.2] — 2026-09-01 · Verifica connettori in un clic
- Il pulsante **Verifica** ora **salva in automatico** la chiave digitata prima di testarla: basta incollare la chiave e premere Verifica (niente più passaggio "Salva" separato, niente più falso "Chiave non impostata").
- Vale per tutti i connettori: SerpApi, JSearch, Apify, Bright Data, Findwork, TheirStack, JobBoard e ATS.

## [1.36.1] — 2026-08-30 · fix verifica connettori a chiave
- Il pulsante **Verifica** ora usa la **chiave salvata** direttamente (non dipende più dalla variabile d'ambiente): risolve i casi "imposta SERPAPI_KEY" con chiave presente.
- Le chiavi vengono **ripulite** da spazi/newline accidentali (evita 401/403 fasulli).

## [1.36.0] — 2026-08-30 · sistema di allerta (fonti/SMTP/cron)
- Nuovo **Stato del sistema** nella dashboard Admin: banner rosso con l'elenco dei problemi (fonti in errore, invio email SMTP fallito, scansione ferma da >30h) o verde "tutto ok".
- **Email automatica** agli admin quando compare un problema NUOVO; l'avviso si risolve da solo quando rientra.
- La scansione registra l'errore preciso per ogni fonte (es. 403/404) usato dal sistema di allerta.

## [1.35.1] — 2026-08-30 · fix cron timeout
- L'endpoint `/api/scheduler/tick` ora risponde subito ed esegue la scansione in **background** (con lock anti-doppione): niente più "Failed (timeout)" su cron-job.org.

## [1.35.0] — 2026-08-29 · referral "porta un amico"
- Nuova sezione candidato **Porta un amico**: link/codice personale + invito via email. Quando l'amico si registra **e attiva un abbonamento**, il candidato riceve **2 settimane gratis** (accredito automatico sul suo piano).
- Registrazione con codice referral (`?ref=`), tracciamento inviti (invitato → registrato → premio) e template email configurabile ("referral_invite").

## [1.34.0] — 2026-08-29 · fix mobile + filtri/inoltro Posizioni
- **Mobile**: eliminato lo scorrimento orizzontale (frame principale ora fisso); tabella offerte adattata al viewport, topbar sticky.
- **Admin -> Posizioni**: filtri per città, modalità, seniority (oltre a origine/stato); per ogni posizione pulsante **Inoltra** (email + "da parte di" nel soggetto).

## [1.33.0] — 2026-08-29 · collegamento LinkedIn
- **Onboarding**: nuovo step per collegare il profilo LinkedIn (URL). Modificabile anche in Impostazioni Account.
- Base per referenze/CRM: nota che la mappatura automatica di contatti richiede l'API partner di LinkedIn (da attivare).

## [1.32.0] — 2026-08-29 · voucher, info abbonamento, sollecito 8h
- **Codici sconto (voucher)** in Admin: percentuale + durata (giorni) + usi massimi; 100% = gratis. Si inseriscono nel carrello prima del pagamento.
- **Admin -> Utenti**: nuova colonna Abbonamento (piano, stato, prezzo, carta/voucher, data inizio, in disdetta) e flag T&C.
- **Sollecito dopo 8 ore**: se il candidato non ha visitato le offerte dopo l'email "trovate XX offerte", riceve un secondo invito (configurabile in Comunicazioni).

## [1.31.0] — 2026-08-29 · offerta da link + condivisione (network)
- **Aggiungi un'offerta esterna**: il candidato incolla il link e clicca "Inserisci e Candidati"; l'offerta (fonte "Manuale") appare tra quelle del giorno, solo per lui, e sfrutta tutte le azioni (auto-candidatura, kit, ecc.).
- **Condividi offerta** via email a un'altra persona (effetto network): oggetto con nome di chi consiglia, testo configurabile in Admin → Comunicazioni ("share_offer").

## [1.30.0] — 2026-08-29 · termini, pollice giù, statistiche
- **Accettazione Termini e condizioni** obbligatoria alla registrazione e all'onboarding (con pagina Termini dedicata).
- **Pollice giù con motivo** su ogni offerta (chip preset + testo libero): registrato per statistica.
- **Admin → Matching**: nuovo riquadro "Pollice giù" con conteggio per motivo e ultime segnalazioni.

## [1.29.0] — 2026-08-28 · homepage commerciale
- Nuova **homepage pubblica** dedicata a candidati, aziende e referral: hero, come funziona (4 passi), prezzi e call-to-action. "Accedi" e "Registrati" restano raggiungibili.

## [1.28.0] — 2026-08-28 · piani abbonamento candidato (settimanale/mensile)
- Nuovi piani candidato: **Settimanale €14,99/sett** e **Mensile conveniente €12,99/sett** (fatturato ogni 4 settimane, €51,96). Aggiornati in automatico anche sul DB esistente (upsert al boot).
- Checkout via Stripe (o simulato in demo). Per Stripe reale: creare i Price su Stripe e impostare priceId + chiavi.

## [1.27.0] — 2026-08-28 · candidatura assistita + auto-apply best-effort
- Pulsante **Auto-candidatura** su ogni offerta: legge il form dell'offerta, mappa i dati del profilo sui campi standard, riusa le risposte della banca Q&A. Invia in automatico dove il form è standard e senza login/anti-bot; altrimenti restituisce il kit da incollare + "apri e completa"; oppure avvisa che è **manuale** con il motivo.
- Auto-invio via Playwright (best-effort, se disponibile in produzione), con fallback all'analisi della pagina tramite ScraperAPI/ScrapingBee.

## [1.26.0] — 2026-08-28 · banca risposte Q&A + kit candidatura
- Nuova sezione candidato **Risposte candidatura**: salva le risposte alle domande ricorrenti dei form, **generale con AI** dal profilo/CV, modificale e riusale.
- Endpoint **kit candidatura** (dati profilo mappati sui campi standard dei form) pronto per la candidatura assistita.

## [1.25.0] — 2026-08-28 · comunicazioni & automazioni
- Nuovo sistema **Comunicazioni** in Admin → Impostazioni: testi editabili + **invio test** + **trigger** (a ogni scansione, N giorni dopo la registrazione, abbonamento attivato/disattivato, 3 solleciti onboarding).
- Regola **"poche offerte"**: banner in-app al candidato quando ha meno di N offerte da ≥1 giorno.
- UX: "Offerte per me" prima voce; contatori Oggi/Complessive/Candidature; box pesi → link Onboarding; "Impostazioni Account" sotto il nome utente (fix Admin).
- Rilevanza: SerpApi/Apify/Jooble cercano il titolo pieno (niente collasso "Head of Operations"→"operations").

## [1.24.0] — 2026-08-27 · modalità+luogo, account, risorse video, coaching
- **Onboarding**: separati **Modalità** (remoto/ibrido/in sede) e **Dove** (città/provincia/regione/nazione, anche testo libero). Matching e fonti ora usano entrambi.
- **Impostazioni Account** per ogni ruolo: cambio password, nome/telefono, logout.
- **Risorse**: video educativi embeddati in-app (niente link esterni); lista modificabile in Admin.
- **Coaching**: pagina "servizio in arrivo" + form di candidatura come Coach → email a extremedigitalfa@gmail.com (con archivio in Admin).

## [1.23.0] — 2026-08-27 · nuove fonti: Google Jobs, ATS diretti, Apify, Bright Data
- **SerpApi (Google Jobs)**: fonte ad alta rilevanza + mercato locale italiano (ruolo esatto + località). Keyed.
- **ATS diretti** Greenhouse / Lever / SmartRecruiters: API pubbliche gratuite; lista aziende gestita in Impostazioni; import filtrato per ruolo.
- **Apify**: esegue Actor di scraping (LinkedIn/Indeed/Glassdoor/ZipRecruiter) via API, actor id configurabile. Keyed.
- **Bright Data**: import di dataset annunci. Keyed (chiave + dataset id).
- **ScraperAPI / ScrapingBee**: middleware anti-bot che rende «Verifica candidatura» un'analisi REALE della pagina (Cloudflare, form CV, registrazione, domande extra).
- Tutte integrate nel motore profilo-guidato, nel box Fonti (stato per fonte, "board mancanti") e con pulsanti Verifica in Impostazioni.

## [1.22.0] — 2026-08-27 · pulizia bacino, fonti nelle posizioni, attività per giorno
- **In linea con il ruolo** più preciso: usa le parole PIENE del ruolo, così un
  "Operations Manager" non finisce più tra i match esatti di "Head of Operations".
- **Pulisci bacino**: rimuove le offerte demo/simulate, tenendo solo quelle reali.
- **Posizioni**: la Fonte è sempre valorizzata (dedotta dal portale di origine);
  le simulate sono evidenziate; date in formato italiano; spiegazione prima/ultima vista.
- **Admin · date in formato dd/mm/yyyy** nei box scansione, rendimento e log.
- **Log delle scansioni** ora include la scansione del Motore candidati + pulizia log simulati.
- **Attività candidati**: nel dettaglio, tabella "nuove offerte compatibili per giorno" e colonna Fonte per utente.
- **Reset password utente** dall'Admin (Utenti → Password).
- **Offerte per me**: riga più chiara da aprire ("Dettagli"), e "Ti sei candidato" ora è una sola casella (niente "No").

## [1.21.1] — 2026-08-27 · rimozione segreto cron, diagnosi JSearch
- **Segreto Cron rimovibile**: pulsante "Rimuovi" in Impostazioni che svuota
  davvero il segreto (config + variabile d'ambiente in tempo reale). Risolve il
  401 quando un segreto salvato in passato restava "bloccato".
- **JSearch diagnostica**: la verifica ora spiega il vero motivo dell'errore
  (403 = chiave non abbonata all'API su RapidAPI, 429 = quota esaurita, 401 =
  chiave non valida) invece di un generico "HTTP xxx".

## [1.21.0] — 2026-08-26 · offerte in due box, day-nav mobile
- **Offerte per me · due box**: "In linea con il tuo ruolo" (il titolo contiene
  esattamente le parole chiave del ruolo) e "Attinenti al tuo ruolo" (manca una
  parola o ne hanno una in più). Le altre compatibili restano in un blocco
  richiudibile. Nuova classificazione `titleTier` nel matcher (lato server).
- **Fix mobile**: la barra di navigazione per giorno ora si impila in verticale
  con frecce a tutta larghezza (prima si accavallava su schermi piccoli).

## [1.20.0] — 2026-08-26 · vista tabellare, requisiti, Sì/No, verifica candidatura
- **Offerte in tabella**: titolo + % match; click sulla riga per espandere
  contenuto completo e azioni.
- **Requisiti principali** (max 5) estratti dalla JD, mostrati nella scheda.
- **Ti sei candidato**: due pulsanti **Sì/No** (aggiornano candidature ovunque).
- **Verifica candidatura**: stima se la candidatura può essere assistita o
  manuale (registrazione, domande extra, anti-bot) in base al link/ATS.
- **Admin · Fonti & scansione**: un unico box al posto dei due precedenti, con
  totale offerte nel bacino, dati dell'ultima scansione e tabella per-fonte.
- Ogni fonte del motore mostra ora lo **stato** (gratis / chiave ok / chiave
  mancante): Findwork, TheirStack e JSearch compaiono sempre, anche senza chiave.

## [1.19.0] — 2026-08-26 · test connettori, JD lunga, messaggi/PDF, contatti
- **Diagnostica scansione completa** (niente più troncamento a 6 fonti).
- **"Verifica"** per ogni connettore (Findwork, TheirStack, JSearch, ecc.).
- **JD salvata più lunga** (fino a 2500 caratteri) → "Mostra annuncio" non tronca.
- **Messaggio outreach** fino a 300 caratteri, frasi complete e puntuali.
- Rimosso "Perché è un fit per te" dalle card candidato.
- **Copia** per messaggio, cover letter e CV; **download PDF** per cover e CV.
- **Trova contatti**: niente nomi finti — ricerche LinkedIn mirate (recruiter/HR/
  hiring manager) + eventuale email di contatto estratta dalla JD.
- **URL keep-alive** in Admin (per tenere sveglio Render con un monitor esterno).

## [1.18.0] — 2026-08-26 · JSearch (RapidAPI)
- **JSearch via RapidAPI** integrato: aggrega Google for Jobs (Indeed, LinkedIn,
  Glassdoor, portali aziendali) e restituisce JSON pulito. Campo **RapidAPI Key**
  in Impostazioni → Connettori; collegato al motore profilo-driven (country=it).

## [1.17.0] — 2026-08-26 · Findwork + TheirStack (con chiave)
- **Findwork** (findwork.dev) e **TheirStack** integrati nel motore guidato dai
  profili; campo chiave in Impostazioni → Connettori (attivi appena imposti la
  chiave, saltati se assente). Aggiunti anche al pannello "Fonti del motore".

## [1.16.0] — 2026-08-26 · correzioni + Arbeitsagentur + fuso coerente
- **Candidati (offerta esterna)** ora apre solo la pagina di candidatura, NON
  segna più la candidatura: lo stato lo imposti col toggle Sì/No.
- Box dashboard rinominato **"Offerte ricevute"**.
- **Date coerenti (fuso Europe/Rome)** ovunque: l'offerta trovata oggi ha la data
  di oggi in calendario e in "Comparsa".
- **Nuovo connettore Arbeitsagentur** (agenzia federale tedesca, API gratuita),
  collegato al motore guidato dai profili.

## [1.15.0] — 2026-08-26 · candidatura, dashboard, responsive, scan più ampia
- **Candidati** apre la pagina di candidatura reale (URL annuncio) e segna la
  candidatura.
- **"Ti sei candidato"** con pulsante toggle **Sì/No** per singola offerta.
- **Mostra annuncio**: il candidato vede solo la JD salvata (immutabile); il link
  alla fonte è ora visibile **solo in Admin** (Attività candidati → dettaglio).
- **Dashboard candidato "Il mio percorso"**: tre box — Onboarding & Assessment,
  Offerte inviate per fascia di compatibilità, Candidature — rimossi gli altri.
- **Scansione più ampia**: Adzuna `what_or` (una qualsiasi delle parole del
  ruolo) + più pagine; Remotive/Jobicy fino a 100 risultati per ricerca.
- **Responsive mobile/tablet**: menu laterale a scomparsa con hamburger, contenuti
  a colonna singola, tabelle scrollabili.

## [1.14.1] — 2026-08-25 · pannello "Fonti del motore candidati"
- In Admin › Fonti & Scansioni un pannello mostra le fonti interrogate
  automaticamente dal motore guidato dai profili (Adzuna, Jooble, Arbeitnow,
  Remotive, RemoteOK, Jobicy, jobdataapi) con il loro stato — chiariscono che non
  vanno create a mano nella tabella sottostante.

## [1.14.0] — 2026-08-25 · rendimento fonti per giorno + rimozione EURES
- **EURES rimosso** (nessuna API pubblica affidabile).
- **Rendimento fonti giorno per giorno** in Admin › Attività candidati: tabella
  con le nuove offerte portate da ciascuna fonte nella scansione giornaliera
  (storico ultimi 14 giorni), per capire quali fonti rendono e quali no.

## [1.13.0] — 2026-08-25 · EURES (sperimentale) + jobdataapi (Italia)
- **jobdataapi.com** integrato (API gratuita, filtro Italia) come fonte per il
  mercato italiano; chiave opzionale `JOBDATA_API_KEY` per limiti più alti.
- **EURES** integrato in modalità best-effort/sperimentale: tenta la ricerca sul
  portale UE e, se non risponde, fa fallback pulito. (EURES non offre un'API
  pubblica ufficiale di pull; questa è una via non ufficiale, fragile.)
- Entrambi collegati al motore guidato dai profili e selezionabili in Admin.

## [1.12.0] — 2026-08-25 · nuove fonti gratuite + data locale
- **Data del calendario = data locale del browser**: "Oggi" è sempre il giorno
  reale dell'utente, indipendente dal fuso del server.
- **Nuove fonti remote gratuite** (senza chiave): **Remotive, RemoteOK, Jobicy**,
  integrate nel motore guidato dai profili (cercano per titolo del candidato).
  Ottime per profili Tech/Senior. Selezionabili anche come fonti in Admin.
- **Link all'annuncio** salvato sull'offerta (`url`): "Mostra annuncio" apre la
  posizione originale quando disponibile.

## [1.11.3] — 2026-08-25 · fix data, stato candidatura, RAL reale
- **Data calendario corretta** (calcolo in UTC): il giorno di oggi è etichettato
  "Oggi · <data>" e i giorni precedenti sono corretti.
- **"Ti sei candidato: Sì/No"** su ogni offerta.
- Pulsante "Referenza" rinominato **"Referenze"**.
- **RAL solo se reale**: le stime di Adzuna non vengono più mostrate come RAL →
  "Non specificata".

## [1.11.2] — 2026-08-25 · calendario su "Oggi" + azioni in due box
- **"Offerte per me" apre sempre su Oggi**: etichetta del giorno relativa al
  giorno di riferimento (niente più "Ieri" per disallineamento di fuso) e
  pulsante "vai a Oggi".
- **Azioni riorganizzate** a destra della card in due box: "Genera / Personalizza"
  (Messaggio · Cover Letter · Curriculum) e "Trova" (Contatti · Referenza, quest'
  ultima non ancora attiva). "Candidati" resta il pulsante principale in alto.

## [1.11.1] — 2026-08-25 · tipologia via LLM + deploy in un clic
- **Tipologia azienda collegata all'LLM**: la classificazione StartUp/Scale-up/
  PMI/Azienda usa l'euristica come base e, **appena imposti la chiave LLM in
  Impostazioni**, passa automaticamente alla classificazione AI dell'annuncio.
  Salvata su ogni offerta (campo `companyType`).
- **deploy.command**: script per caricare la nuova versione in un clic (init,
  commit, push --force), così non serve più digitare i comandi git a mano.

## [1.11.0] — 2026-08-25 · card offerta: motivi del fit + 5 azioni
- **Motivi del fit** al posto del testo parziale dell'annuncio: elenco puntato
  (✓/✗) generato dal punteggio (ruolo, sede, seniority, competenze, settore).
- **Tipologia azienda** dedotta dall'annuncio: StartUp / Scale-up / PMI / Azienda
  (o "Non specificata" se non deducibile).
- **Cinque azioni per offerta**: Candidati (evidenziato), Crea Cover Letter,
  Personalizza CV, Cerca contatti, Mostra annuncio (apre l'annuncio nella stessa
  schermata). "Personalizza CV" genera un CV su misura per l'offerta.
- "Offerte per me" apre sempre su **oggi** (vista a calendario della 1.10.0).

## [1.10.1] — 2026-08-25 · query per parola distintiva + matching preciso
- **Query ai portali sulla parola distintiva**: "Head of Operations" cerca
  "operations", "Country Lead" cerca "country" — Adzuna fa AND sulle parole, il
  titolo intero trovava pochissimo. Così il bacino si riempie di offerte della
  famiglia giusta.
- **Confronto titoli senza falsi positivi**: sinonimi IT↔EN + singolare/plurale,
  ma niente match per prefisso (non confonde più "operations" con "operator").

## [1.10.0] — 2026-08-25 · calendario offerte + matching più tollerante
- **Vista a calendario** in "Offerte per me": un giorno alla volta con frecce
  avanti/indietro. Se la scansione di oggi non è ancora avvenuta → messaggio con
  l'ora prevista e l'avviso via email; se è avvenuta ma senza risultati in target
  → messaggio dedicato.
- **Matching più tollerante**: riconosce varianti della stessa parola (marketing/
  marketer, svilupp*) e sinonimi/traduzioni IT↔EN comuni (sviluppatore↔developer,
  commerciale↔sales, ecc.), così i titoli combaciano anche tra lingue diverse.

## [1.9.6] — 2026-08-25 · "Offerte per me" mostra solo le compatibili
- **Bug corretto**: la sezione candidato "Offerte per me" restituiva TUTTE le
  offerte attive del magazzino (es. 1005), ordinate per match ma senza filtro.
  Ora mostra **solo quelle sopra soglia** (match ≥ 45), ordinate per compatibilità
  — niente più offerte fuori ruolo in elenco.

## [1.9.5] — 2026-08-25 · cancello sul ruolo + fallback profilo
- **Cancello sul ruolo**: se il titolo dell'offerta non c'entra col ruolo cercato
  (nessuna parola distintiva in comune), l'offerta è cappata sotto soglia e non
  compare più tra i match — niente più DevOps/Data/Project per chi cerca altro.
- **Fallback profilo**: candidati senza titoli desiderati usano le competenze; se
  non c'è alcun segnale sul ruolo il punteggio resta basso (non "passa tutto").
- I candidati demo ora hanno titoli desiderati coerenti col loro ruolo.

## [1.9.4] — 2026-08-24 · card offerta con tag standard in italiano
- Ogni offerta mostra ora una riga fissa di tag etichettati: **RAL, Modalità,
  Seniority, Tipologia, Settore** — con "Non specificato/a" quando il dato manca.
  Niente logo aziendale. Tutto in italiano.

## [1.9.3] — 2026-08-24 · matching del ruolo più preciso
- **Punteggio "Ruolo" riscritto**: ora conta le parole **distintive** del titolo,
  non quelle generiche. "Marketing Manager" non combacia più con "Project
  Manager" solo per la parola "manager". I titoli davvero pertinenti salgono in
  cima, quelli sbagliati crollano sotto la soglia di compatibilità.
- Stessa logica applicata alle competenze (le parole generiche non gonfiano più
  il punteggio) e all'anteprima demo.

## [1.9.2] — 2026-08-24 · diagnosi scansione + soglia match
- **Diagnostica nella scansione candidati**: il risultato ora mostra quante
  offerte sono state realmente **lette dai portali** e un riepilogo per
  connettore (ricerche, offerte lette, nuove) più eventuali errori — così si
  capisce subito se le chiavi non arrivano o se sono solo duplicati.
- **Soglia di compatibilità abbassata** (60 → 45): fa emergere match reali che
  prima restavano appena sotto soglia.

## [1.9.1] — 2026-08-24 · verifica connessione connettori
- **"Verifica connessione"** per Adzuna e Jooble in Admin › Impostazioni: fa una
  chiamata reale minima e risponde OK (o l'errore preciso) — così controlli le
  chiavi senza lanciare una scansione.

## [1.9.0] — 2026-08-24 · chiavi connettori in Admin, recupero password
- **Chiavi Adzuna/Jooble in Admin › Impostazioni** (pannello "Connettori
  offerte"), applicate a runtime come gli altri segreti.
- **Recupero password**: link "Password dimenticata?" in accesso → email con
  link di reset valido 1 ora → pagina di reimpostazione. Endpoint sicuri (nessuna
  rivelazione se l'email esiste); se l'SMTP non è configurato il link è loggato.
- **Indicatore candidati profilati** in Attività candidati (quanti hanno
  completato il profilo), per capire subito se la scansione ha "materiale".

## [1.8.0] — 2026-08-24 · Impostazioni da Admin (SMTP/LLM/Cron/Template)
- **Admin › Impostazioni**: SMTP, LLM, orario della scansione notturna e segreto
  cron, tutto configurabile dall'interfaccia — salvato nel DB e applicato subito,
  senza toccare le variabili su Render (che restano come default). I segreti non
  vengono mai rimostrati (solo "impostato"; per cambiarli si riscrivono).
- **Cron notturno programmabile**: la scansione giornaliera parte all'ora scelta
  (fuso UTC) quando il cron esterno chiama `/api/scheduler/tick`; l'URL e le
  istruzioni sono mostrati in Impostazioni. Segreto cron opzionale.
- **Template comunicazioni**: oggetto e corpo dell'email ai candidati sono
  editabili, con placeholder {name}, {count}, {link}.
- **Email di prova** con un clic per verificare l'SMTP.

## [1.7.0] — 2026-08-24 · Admin "Attività candidati" + Gemini
- **Admin › Attività candidati**: per ogni candidato, quante offerte compatibili
  gli sono state inviate (match ≥ soglia), quante ad alta/media compatibilità, il
  miglior match e quante candidature ha inviato. Dettaglio espandibile con le
  offerte ordinate per match e il segno "candidato ✓".
- **Supporto Google Gemini** come LLM tramite il suo endpoint compatibile OpenAI
  (nessuna modifica al codice: si imposta via variabili `LLM_*`). Vedi
  `.env.example`.

## [1.6.0] — 2026-08-23 · CV nell'onboarding + home semplificata
- **Onboarding parte dal CV**: primo step con doppia scelta — *carica il CV ed
  estrai i dati* (PDF/DOCX) oppure *inserisci i dati a mano*. Dal CV estraiamo
  nome, contatti, città, competenze, titoli e settori; segue una schermata **"I
  tuoi dati" completamente modificabile** prima dello step sul ruolo. Estrazione
  via LLM quando configurato, con fallback euristico. Il testo del CV viene
  salvato come base per Cover Letter e pacchetto di candidatura.
- **Invito a caricare il CV** nelle sezioni del candidato finché non è caricato.
- **Home semplificata**: niente più tab in alto — box di accesso e, sotto,
  "Non hai un account? Registrati".

## [1.5.0] — 2026-08-23 · motore unico profilo-driven + email giornaliera
- **Un solo motore di scansione, guidato dai profili** (`candidateScan.js`): dai
  profili dei candidati si costruiscono le ricerche (titolo × località scelta),
  le ricerche identiche di più candidati vengono **coalizzate** e scaricate una
  sola volta nel bacino condiviso, con dedup cross-source. Niente più doppio scan.
- **Scan immediato** all'iscrizione e a ogni modifica del profilo (l'onboarding
  usa ora questo motore).
- **Scan giornaliero + email**: una volta al giorno il sistema scansiona l'unione
  dei profili e invia a ogni candidato "oggi ci sono XX nuove offerte per te
  [link]". Email via SMTP quando configurato (`SMTP_*`), altrimenti loggata.
  Innescato dal tick dello scheduler (una volta al giorno) o manualmente da Admin.
- **Offerte del candidato raggruppate per giorno** (Oggi / Ieri / data), sempre
  ordinate per compatibilità dentro ogni giorno.
- **Admin**: nuovo pannello "Scansione candidati (giornaliera)" con esecuzione
  manuale e stato ultima esecuzione / configurazione email.

## [1.4.0] — 2026-08-23 · Adzuna a tappeto (multi-paese)
- **Connettore Adzuna dedicato** (`adzuna`): una sola fonte scandisce un'intera
  area — *Italia*, *Europa* (IT, GB, DE, FR, ES, NL, PL, AT) o *Mondo*
  (IT, GB, US, DE, FR, CA, AU, IN) — paginando ogni paese e unendo i risultati.
  `full: true` (le offerte scomparse vengono archiviate). Parole chiave opzionali;
  vuote = tutte le offerte. Con più paesi il numero di pagine per paese è ridotto
  di default (3) per rispettare la quota del piano gratuito; regolabile con
  `ADZUNA_MAX_PAGES` o `apiConfig.maxPages`.
- **UI Admin**: nuova fonte con connettore *Adzuna API (reale · multi-paese)*,
  selettore Copertura (Italia/Europa/Mondo) e parole chiave — senza scrivere URL.

## [1.3.0] — 2026-08-23 · registrazione libera, ruoli, scansione Europa/Mondo
- **Registrazione dalla Home**: email + username + password, con scelta
  dell'intento — *Cerco lavoro* (candidato), *Sono un'azienda (HR)*,
  *Referral aziendale*. Nessun piano obbligatorio: l'abbonamento si sceglie
  dopo, dalla dashboard. Rimossi il login LinkedIn e il rimando "Attiva un
  abbonamento"; "Accedi" e "Registrati" sono ora due tab nella stessa schermata.
- **Nuovo ruolo Referral** con dashboard dedicata (base).
- **Onboarding come prima schermata** per chi si registra come candidato; nelle
  altre sezioni compare un invito a completare la profilazione finché non è fatta.
- **Admin — ruoli e permessi**: l'admin può assegnare ad altri utenti un ruolo e,
  per lo *Staff* (admin limitato), scegliere quali sezioni può vedere. L'admin
  non è registrabile: esiste già ed è lui a concedere gli accessi.
- **Scansione Europa/Mondo**: la ricerca usa le località SCELTE — città italiana,
  Italia, Europa (più paesi Adzuna) o Mondo — e integra gli altri campi del
  profilo (RAL minima, tipo di contratto) nella query.

## [1.2.0] — 2026-08-23 · Adzuna a più pagine, gestione utenti, pulizia fonti
- **Adzuna paginato**: la scansione ora scorre più pagine (fino a
  `ADZUNA_MAX_PAGES`, default 10 → ~500 offerte per scansione) invece di
  fermarsi a 25. Il mode mostra il numero di pagine lette.
- **Admin Posizioni — filtri**: ricerca testo (titolo/azienda/città/fonte) e
  filtro per origine (Scansione / Caricata da HR), oltre al filtro stato.
- **Admin Utenti — gestione**: filtri (ruolo, stato, ricerca testo); blocco a
  tempo predefinito (7/30/90 giorni) con `blockedUntil` applicato a login e su
  ogni richiesta autenticata; cancellazione utente con conferma inline e pulizia
  dei dati collegati (candidature, sessioni, progressi, abbonamento, preferenze).
- **Pulizia fonti**: connettori non reali (LinkedIn, Indeed, portali demo)
  impostati come *disattivati*. Restano reali e pronti Arbeitnow (attivo),
  Adzuna e Jooble (si attivano impostando le chiavi).

## [1.1.0] — 2026-08-23 · onboarding, Jooble, scansione per località, deduplica
- **Onboarding candidato (wizard 7 step)**: tipo di lavoro (autocomplete su
  database titoli), livello di esperienza (fino a "5-10 anni" e "Più di 10 anni"),
  salario a scaglioni da 20.000 fino a +240.000, settori (menu a tendina), tipo di
  contratto, dove lavorare (città italiana / Europa / Mondo / da remoto), tipo di
  azienda (StartUp/ScaleUp/PMI/azienda). Al completamento parte una scansione
  automatica basata sul profilo.
- **Scansione per località SCELTE**: la ricerca e il punteggio località usano le
  città indicate nell'onboarding, non la residenza del candidato.
- **Connettore Jooble** (`server/connectors/index.js`): reale via API POST con
  `JOOBLE_API_KEY`, fallback simulato senza chiave.
- **Deduplica cross-source**: offerte con stessa azienda+titolo provenienti da
  fonti diverse (Adzuna, Jooble, portali…) collassano in una sola. Impronta
  normalizzata (`dedupKey`) su `Job`, con indice; conteggio "duplicati evitati"
  mostrato in Admin dopo ogni scansione.

## [1.0.0] — 2026-08-20 · prima release production-ready
- **LLM nei generatori**: messaggio outreach (<200 char) e cover letter generati
  via LLM quando configurato (OpenAI-compatibile o Anthropic), con fallback
  automatico ai template. Vedi `server/llm.js` e `server/generators.js`.
- **Scheduler production-grade**: motore estratto in `server/scheduler.js`,
  leader-election via advisory lock PostgreSQL (sicuro multi-istanza), worker
  standalone (`npm run worker`) ed endpoint cron esterno protetto
  `POST /api/scheduler/tick` (header `x-cron-secret`).
- **Deploy**: `render.yaml` (web + Postgres gratis), `Dockerfile`, `start:prod`
  con `prisma migrate deploy`. Migrazione versionata iniziale.
- **Versionamento**: `APP_VERSION` esposta in `/api/health` e `/api/version`,
  mostrata nel footer dell'app.

## [0.4.0] — scheduler, auth, kit di candidatura
- Scheduler in-process configurabile da Admin (frequenza, auto-scan, scan-all).
- Autenticazione robusta: hashing bcrypt, JWT, login LinkedIn (reale + simulato).
- Per ogni offerta: 3 contatti suggeriti, messaggio pronto, cover letter.

## [0.3.0] — persistenza e connettori
- Migrazione da store in-memory a **PostgreSQL + Prisma** (persistente).
- Sottosistema connettori: Arbeitnow (API reale), HTTP/JSON, RSS, stub partner.
- Lifecycle offerte attive/non attive con log delle scansioni.

## [0.2.0] — abbonamenti
- Registrazione self-service e abbonamenti Stripe (reale + simulato).
- Pagina Abbonamento per candidato e azienda; sezione Admin fonti/posizioni.

## [0.1.0] — prototipo iniziale
- Piattaforma di outplacement con 4 ruoli (candidato, coach, HR, admin),
  frontend React + backend Node, dati demo in memoria.
