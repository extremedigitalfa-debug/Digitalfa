// Onboarding option lists. Curated, editable — not an exhaustive registry.
// Candidates can also type a custom title (free text) in the wizard.

export const EXPERIENCE_LEVELS = [
  { key: "entry", label: "Entry-level (0-2 anni)", desc: "Primo ruolo full-time nel settore" },
  { key: "junior", label: "Junior / associate (1-3 anni)", desc: "Lavora autonomamente su task ben definiti" },
  { key: "mid", label: "Livello intermedio (3-5 anni)", desc: "Gestisce progetti, può fare mentoring" },
  { key: "senior", label: "Senior / lead (5+ anni)", desc: "Guida lavori complessi e definisce la direzione" },
  { key: "5_10", label: "5-10 anni", desc: "Ampia esperienza, guida team o funzioni" },
  { key: "10_plus", label: "Più di 10 anni", desc: "Leadership senior / dirigenziale" },
];

export const COMPANY_TYPES = [
  { key: "startup", label: "Start-up", desc: "Fase iniziale, ritmo veloce, molta autonomia" },
  { key: "scaleup", label: "Scale-up", desc: "In forte crescita, struttura in espansione" },
  { key: "pmi", label: "PMI", desc: "Piccola-media impresa, ruoli concreti" },
  { key: "azienda", label: "Grande azienda", desc: "Struttura consolidata, percorsi definiti" },
];

export const JOB_TYPES = [
  { key: "full_time", label: "Tempo pieno" },
  { key: "part_time", label: "Part-time" },
  { key: "contract", label: "Contratto / Freelance" },
];

// Salary steps: 20k → 240k, then 240k+
export const SALARY_STEPS = [20000, 40000, 60000, 80000, 100000, 120000, 140000, 160000, 180000, 200000, 220000, 240000];

export const SECTORS = [
  "Tecnologia dell'informazione e telecomunicazioni",
  "Sanità e scienze della vita",
  "Servizi finanziari e assicurativi",
  "Vendite e sviluppo commerciale",
  "Marketing, pubblicità e relazioni pubbliche",
  "Commercio al dettaglio e all'ingrosso",
  "Istruzione e formazione",
  "Risorse umane e reclutamento",
  "Ospitalità, turismo e tempo libero",
  "Industria manifatturiera e produzione",
  "Ingegneria e costruzioni",
  "Trasporti e logistica",
  "Energia e utilities",
  "Settore pubblico e no-profit",
  "Media, editoria e intrattenimento",
  "Design e creatività",
  "Consulenza e servizi professionali",
  "Legale",
  "Immobiliare",
  "Automotive",
  "Moda e lusso",
  "Alimentare e beverage",
  "Agricoltura e ambiente",
  "Farmaceutico e biotech",
  "Telecomunicazioni",
];

// Location options for on-site preference (+ remote / macro-areas)
// Modalità di lavoro (separata dal luogo): remoto / ibrido / in sede.
export const WORK_MODES = [
  { key: "remoto", label: "Da remoto" },
  { key: "ibrido", label: "Ibrido" },
  { key: "onsite", label: "In sede" },
];

// DOVE cerchi: città, provincia, regione, nazione. Testo libero anche ammesso.
export const LOCATIONS = [
  "Italia (tutta)",
  "Milano", "Roma", "Torino", "Bologna", "Firenze", "Napoli", "Genova", "Venezia",
  "Verona", "Padova", "Bari", "Palermo", "Catania", "Bergamo", "Brescia", "Modena",
  "Parma", "Trieste", "Cagliari", "Pisa", "Perugia", "Bolzano", "Trento",
  "Europa", "Mondo",
];

// Curated job-title list for autocomplete (expandable). Free text also allowed.
export const JOB_TITLES = [
  // Tech / Engineering
  "Software Engineer", "Senior Software Engineer", "Frontend Developer", "Backend Developer",
  "Full-Stack Developer", "Mobile Developer", "iOS Developer", "Android Developer",
  "DevOps Engineer", "Site Reliability Engineer", "Cloud Engineer", "Data Engineer",
  "Data Scientist", "Data Analyst", "Machine Learning Engineer", "AI Engineer",
  "QA Engineer", "Test Automation Engineer", "Security Engineer", "Solutions Architect",
  "Engineering Manager", "CTO", "Tech Lead", "Database Administrator", "System Administrator",
  "Network Engineer", "Embedded Software Engineer", "Blockchain Developer",
  // Product / Design
  "Product Manager", "Senior Product Manager", "Product Owner", "UX Designer", "UI Designer",
  "UX/UI Designer", "Product Designer", "Graphic Designer", "Motion Designer",
  "UX Researcher", "Design Lead", "Head of Product",
  // Marketing / Growth
  "Marketing Manager", "Digital Marketing Specialist", "Growth Marketing Manager",
  "SEO Specialist", "SEM Specialist", "Content Manager", "Content Writer", "Copywriter",
  "Social Media Manager", "Brand Manager", "Marketing Director", "CMO",
  "Communication Manager", "PR Specialist", "Performance Marketing Manager",
  "Email Marketing Specialist", "Marketing Analyst",
  // Sales / BD
  "Sales Manager", "Account Executive", "Account Manager", "Key Account Manager",
  "Business Development Manager", "Sales Representative", "Inside Sales", "Sales Director",
  "Customer Success Manager", "Customer Support Specialist", "Pre-Sales Engineer",
  "Retail Store Manager", "Area Manager",
  // Finance / Ops
  "Financial Analyst", "Controller", "Accountant", "CFO", "Finance Manager",
  "Operations Manager", "Supply Chain Manager", "Logistics Manager", "Procurement Manager",
  "Project Manager", "Program Manager", "Business Analyst", "Management Consultant",
  "Strategy Manager", "Venture Builder",
  // HR / People
  "HR Manager", "HR Business Partner", "Talent Acquisition Specialist", "Recruiter",
  "People Operations Manager", "Training Manager", "HR Director",
  // Other common
  "Legal Counsel", "Lawyer", "Compliance Manager", "Executive Assistant", "Office Manager",
  "Nurse", "Medical Doctor", "Pharmacist", "Teacher", "Trainer",
  "Architect", "Civil Engineer", "Mechanical Engineer", "Electrical Engineer",
  "Chef", "Hotel Manager", "Event Manager", "Journalist", "Video Editor", "Photographer",
];
