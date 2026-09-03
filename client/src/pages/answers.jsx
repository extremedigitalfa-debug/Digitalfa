import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Card, Spinner, Empty } from "../components/ui.jsx";

export function CandidateAnswers() {
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState({ question: "", answer: "" });
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState(false);
  const [flash, setFlash] = useState("");
  const [editId, setEditId] = useState(null);

  async function load() { try { const r = await api.answersList(); setRows(r.answers || []); } catch { setRows([]); } }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!draft.question.trim()) return setFlash("Scrivi prima la domanda.");
    setBusy(true); setFlash("");
    try { await api.answerSave({ id: editId || undefined, question: draft.question, answer: draft.answer }); setDraft({ question: "", answer: "" }); setEditId(null); await load(); setFlash("Risposta salvata."); }
    catch (e) { setFlash(e.message); } finally { setBusy(false); }
  }
  async function generate() {
    if (!draft.question.trim()) return setFlash("Scrivi prima la domanda da cui generare la risposta.");
    setGen(true); setFlash("");
    try { const r = await api.answerGenerate(draft.question); setDraft((d) => ({ ...d, answer: r.answer })); if (!r.ai) setFlash("Bozza generata (imposta una chiave LLM in Admin per risposte su misura)."); }
    catch (e) { setFlash(e.message); } finally { setGen(false); }
  }
  async function edit(a) { setEditId(a.id); setDraft({ question: a.question, answer: a.answer }); window.scrollTo?.({ top: 0, behavior: "smooth" }); }
  async function remove(a) { if (typeof window !== "undefined" && !window.confirm("Eliminare questa risposta?")) return; await api.answerDelete(a.id); load(); }

  return (
    <div className="stack" style={{ maxWidth: 780 }}>
      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>{editId ? "Modifica risposta" : "Aggiungi una risposta"}</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Salva qui le risposte alle domande ricorrenti dei form di candidatura (es. "Perché vuoi lavorare con noi?", "Hai i requisiti per lavorare in UE?"). Le riutilizzeremo nelle candidature assistite.</p>
        <div className="field" style={{ margin: 0 }}><label>Domanda</label><input value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} placeholder="Es. Qual è la tua esperienza con la gestione di team?" /></div>
        <div className="field" style={{ margin: "10px 0 0" }}><label>Risposta</label><textarea rows={4} className="ob-input" style={{ resize: "vertical", width: "100%" }} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} placeholder="Scrivi la risposta, oppure generala con l'AI e poi modificala." /></div>
        <div className="row wrap" style={{ gap: 10, marginTop: 12, alignItems: "center" }}>
          <button className="btn ghost" disabled={gen} onClick={generate}>{gen ? "Genero…" : "✨ Genera con AI"}</button>
          <button className="btn" disabled={busy} onClick={save}>{busy ? "Salvo…" : (editId ? "Salva modifiche" : "Salva risposta")}</button>
          {editId && <button className="btn ghost sm" onClick={() => { setEditId(null); setDraft({ question: "", answer: "" }); }}>Annulla</button>}
          {flash && <span className="muted" style={{ fontSize: 12.5 }}>{flash}</span>}
        </div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Le tue risposte salvate</h3>
        {!rows ? <Spinner /> : rows.length === 0 ? <Empty>Nessuna risposta salvata. Aggiungine una qui sopra.</Empty> : (
          <div className="stack">
            {rows.map((a) => (
              <div key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div className="row between" style={{ gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>{a.question}</div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn ghost sm" onClick={() => edit(a)}>Modifica</button>
                    <button className="btn ghost sm" style={{ color: "var(--danger,#c0392b)" }} onClick={() => remove(a)}>Elimina</button>
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-line" }}>{a.answer || <em>— nessuna risposta —</em>}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
