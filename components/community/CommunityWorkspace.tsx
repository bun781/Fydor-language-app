import { ExternalLink, FolderOpen, RefreshCw, Send, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { exportLesson, openGenerationDestination } from "@/lib/desktopApi";
import {
  communityActionId,
  communityApi,
  getCommunityPrivileges,
  signInCommunity,
  signUpCommunity,
  type CommunityPrivileges,
  type CommunitySession
} from "@/lib/communityApi";
import { errorMessage } from "@/lib/errors";
import { parseFydorPack, type FydorPack, type FydorPackValidation } from "@/lib/fydor-pack";
import { importPromptTemplates } from "@/lib/language/importResources";

type CommunityTab = "contribute" | "moderate" | "admin";
type Draft = {
  id: string;
  revision: number;
  state: string;
  canonical_json: Lesson | FydorPack;
  sentence_review_progress?: Array<{ sentence_index: number; status: string }>;
};
type Lesson = {
  title: string;
  language: string;
  baseLanguage: string;
  level: string;
  sentences: Array<{ text: string; translation: string }>;
};
type ContributionMethod = "ai" | "existing";
type Submission = {
  id: string;
  title: string;
  state: string;
  current_version: number;
  row_version: number;
  target_language: string;
  base_language: string;
  moderation_assignments?: Array<{ state: string }>;
};
type ContributorPhase = 1 | 2 | 3 | 4;

const TAB_LABELS: Record<CommunityTab, string> = {
  contribute: "Contribute",
  moderate: "Moderate",
  admin: "Admin"
};

function normalizeCommunityTab(value: string | null): CommunityTab | null {
  if (value === "contribute" || value === "moderate" || value === "admin") return value;
  return null;
}

function getCommunityTabs(privileges: CommunityPrivileges): CommunityTab[] {
  const tabs: CommunityTab[] = ["contribute"];
  if (privileges.canModerate) tabs.push("moderate");
  if (privileges.canAdmin) tabs.push("admin");
  return tabs;
}

export function CommunityWorkspace({ initialTab = "contribute" }: { initialTab?: CommunityTab } = {}) {
  const [params] = useSearchParams();
  const requestedTab = normalizeCommunityTab(params.get("tab"));
  const [session, setSession] = useState<CommunitySession | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [privileges, setPrivileges] = useState<CommunityPrivileges>({
    roles: [],
    canModerate: false,
    canAdmin: false
  });
  const [activeTab, setActiveTab] = useState<CommunityTab>(requestedTab ?? initialTab);

  const availableTabs = useMemo(() => getCommunityTabs(privileges), [privileges]);

  useEffect(() => {
    if (!session) {
      setPrivileges({ roles: [], canModerate: false, canAdmin: false });
      return;
    }

    let cancelled = false;
    void getCommunityPrivileges(session)
      .then((next) => {
        if (!cancelled) setPrivileges(next);
      })
      .catch((error) => {
        if (!cancelled) setStatus(errorMessage(error, "Unable to load your account privileges."));
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const targetTab = requestedTab ?? initialTab;
    if (availableTabs.includes(targetTab)) {
      setActiveTab(targetTab);
      return;
    }

    if (!availableTabs.includes(activeTab)) {
      setActiveTab("contribute");
    }
  }, [activeTab, availableTabs, initialTab, requestedTab]);

  async function authenticate(create = false) {
    try {
      setStatus(create ? "Creating account…" : "Signing in…");
      const nextSession = create ? await signUpCommunity(email, password, username) : await signInCommunity(email, password);
      setSession(nextSession);
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Unable to sign in."));
    }
  }

  const pageTitle = activeTab === "moderate" ? "Moderation" : activeTab === "admin" ? "Administration" : "Contribute to Fydor";
  const pageDescription = activeTab === "moderate"
    ? "Review submitted lessons and approve their language quality."
    : activeTab === "admin"
      ? "Manage user access and moderation roles."
      : "Generate a new pack with AI or choose an existing pack to submit for review.";

  return (
    <AppShell>
      <main className="page-shell stack community-shell">
        <header className="page-header">
          <div>
            <span className="pill">Community workspace</span>
            <h1>{pageTitle}</h1>
            <p className="muted">{pageDescription}</p>
          </div>
          <Link className="button secondary" to="/fydor-exchange">Back to Exchange</Link>
        </header>

        {!session ? (
          <section className="card stack community-auth">
            <h2>Sign in</h2>
            <label>
              Email
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
            </label>
            <label>
              Username <span className="muted">(required for new accounts)</span>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} type="text" autoComplete="username" />
            </label>
            <label>
              Password
              <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" minLength={8} />
            </label>
            <div className="row">
              <button className="button" onClick={() => void authenticate()}>Sign in</button>
              <button className="button secondary" onClick={() => void authenticate(true)}>Create account</button>
            </div>
            {status ? <p className="error-text">{status}</p> : null}
          </section>
        ) : (
          <>
            <section className="card stack">
              <div className="mode-tabs" role="tablist" aria-label="Community workspace sections">
                <Link role="tab" aria-selected={activeTab === "contribute"} className={activeTab === "contribute" ? "active" : ""} to="/community/contribute">
                  <Send size={16} />
                  Contribute
                </Link>
                {availableTabs.includes("moderate") ? (
                  <Link role="tab" aria-selected={activeTab === "moderate"} className={activeTab === "moderate" ? "active" : ""} to="/community/moderate">
                    <ShieldCheck size={16} />
                    Moderate
                  </Link>
                ) : null}
                {availableTabs.includes("admin") ? (
                  <Link role="tab" aria-selected={activeTab === "admin"} className={activeTab === "admin" ? "active" : ""} to="/community/admin">
                    <Settings size={16} />
                    Admin
                  </Link>
                ) : null}
              </div>
              <div className="exchange-stat-row">
                <span>{session.email}</span>
                <span>{privileges.roles.length ? privileges.roles.join(", ") : "contributor"}</span>
              </div>
            </section>

            {requestedTab && !availableTabs.includes(requestedTab) ? (
              <section className="notice warn">
                Your account does not have access to the {TAB_LABELS[requestedTab].toLowerCase()} panel.
              </section>
            ) : null}

            {activeTab === "contribute" ? <Contributor session={session} /> : null}
            {activeTab === "moderate" ? <Moderation session={session} /> : null}
            {activeTab === "admin" ? <Administration session={session} /> : null}
          </>
        )}

        {status ? <p className="muted">{status}</p> : null}
      </main>
    </AppShell>
  );
}

function Contributor({ session }: { session: CommunitySession }) {
  const [params] = useSearchParams();
  const [method, setMethod] = useState<ContributionMethod>("ai");
  const [source, setSource] = useState("");
  const [existingPack, setExistingPack] = useState<FydorPack | null>(null);
  const [existingPackFile, setExistingPackFile] = useState("");
  const packInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState("");
  const [index, setIndex] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<ContributorPhase>(1);
  const promptTemplate = importPromptTemplates.find((template) => template.id === "beginner")?.prompt ?? "";
  const contributorPrompt = source.trim()
    ? `${promptTemplate}\n\nUse the following existing lesson as a starting point. Return a complete replacement lesson JSON object that follows the rules above:\n\n${source}`
    : promptTemplate;

  useEffect(() => {
    const id = params.get("sourceLessonId");
    if (!id) return;

    void exportLesson(id)
      .then((lesson) => setSource(JSON.stringify({
        schemaVersion: 1,
        ...lesson,
        description: lesson.description ?? "",
        level: lesson.level ?? "",
        tags: lesson.tags ?? [],
        sentences: lesson.sentences.map((sentence) => ({ ...sentence, translation: sentence.translation ?? "" }))
      }, null, 2)))
      .catch((error) => setStatus(errorMessage(error, "Unable to load the local lesson.")));
  }, [params]);

  const pack = toContributionPack(draft?.canonical_json ?? (method === "existing" ? existingPack : null));
  const sentences = pack?.lessons.flatMap((item) => item.sentences) ?? [];
  const reviewed = useMemo(
    () => new Set((draft?.sentence_review_progress ?? []).filter((item) => item.status === "reviewed").map((item) => item.sentence_index)),
    [draft]
  );

  async function save(): Promise<boolean> {
    try {
      const sourceLessonId = params.get("sourceLessonId");
      const action = draft ? "save_draft" : sourceLessonId ? "convert_personal" : "save_draft";
      const result = await communityApi<{ draft: Draft }>(session, "/api/contributor", {
        method: "POST",
        body: JSON.stringify({
          action,
          ...(method === "existing" ? { pack: JSON.stringify(existingPack), creationMethod: "upload" } : { lesson: source, creationMethod: "ai" }),
          state: "reviewing",
          resetReview: true,
          ...(draft ? { draftId: draft.id, expectedRevision: draft.revision } : sourceLessonId ? { personalLessonId: sourceLessonId } : {})
        })
      });
      setDraft(result.draft);
      setIndex(0);
      setStatus("Draft saved. Review every sentence before submitting.");
      return true;
    } catch (error) {
      setStatus(errorMessage(error, "Unable to save the contributor draft."));
      return false;
    }
  }

  async function review() {
    if (!draft) return;
    try {
      await communityApi(session, "/api/contributor", {
        method: "POST",
        body: JSON.stringify({ action: "review_sentence", draftId: draft.id, sentenceIndex: index, status: "reviewed" })
      });
      setDraft((current) => current ? {
        ...current,
        sentence_review_progress: [
          ...(current.sentence_review_progress ?? []).filter((item) => item.sentence_index !== index),
          { sentence_index: index, status: "reviewed" }
        ]
      } : current);
      if (sentences.length && index < sentences.length - 1) setIndex(index + 1);
    } catch (error) {
      setStatus(errorMessage(error, "Unable to record the review."));
    }
  }

  async function submit() {
    if (!draft || !confirmed) {
      setStatus("Confirm that you reviewed every sentence first.");
      return;
    }
    try {
      await communityApi(session, "/api/contributor", {
        method: "POST",
        headers: { "Idempotency-Key": communityActionId("submit") },
        body: JSON.stringify({ action: "submit", draftId: draft.id, expectedRevision: draft.revision, confirmed: true })
      });
      setStatus("Submitted for language moderation.");
    } catch (error) {
      setStatus(errorMessage(error, "Unable to submit the lesson."));
    }
  }

  async function copyAndOpen(provider: "chatgpt" | "claude") {
    try {
      await navigator.clipboard.writeText(contributorPrompt);
      await openGenerationDestination(provider);
      setStatus(`Contributor prompt copied; ${provider === "chatgpt" ? "ChatGPT" : "Claude"} opened.`);
    } catch (error) {
      setStatus(errorMessage(error, "Unable to copy the contributor prompt."));
    }
  }

  async function nextPhase() {
    if (phase === 1) {
      setPhase(2);
      return;
    }

    if (phase === 2) {
      if (draft || await save()) setPhase(3);
      return;
    }

    if (phase === 3) {
      if (!pack || reviewed.size !== sentences.length) {
        setStatus("Review every sentence before continuing to submission.");
        return;
      }
      setPhase(4);
    }
  }

  function previousPhase() {
    setPhase((current) => Math.max(1, current - 1) as ContributorPhase);
  }

  return (
    <div className="stack">
      <section className="card stack community-method-panel" aria-labelledby="contribution-method-title">
        <div>
          <span className="pill">Contribution method</span>
          <h2 id="contribution-method-title">Choose how to contribute</h2>
          <p className="muted">Both options use the same validation, review, moderation, and publishing flow.</p>
        </div>
        <div className="community-method-grid" role="tablist" aria-label="Contribution method">
          <button className={`community-method-card${method === "ai" ? " active" : ""}`} type="button" role="tab" aria-selected={method === "ai"} onClick={() => { setMethod("ai"); setPhase(1); }}>
            <Sparkles size={20} />
            <strong>Generate with AI</strong>
            <span>Build a new lesson pack with the guided LLM workflow.</span>
            <span className="button secondary">Start generating</span>
          </button>
          <button className={`community-method-card${method === "existing" ? " active" : ""}`} type="button" role="tab" aria-selected={method === "existing"} onClick={() => { setMethod("existing"); setPhase(1); }}>
            <FolderOpen size={20} />
            <strong>Choose from Existing Pack</strong>
            <span>Select a completed Fydor pack from your computer.</span>
            <span className="button secondary">Choose pack</span>
          </button>
        </div>
      </section>
      <ol className="community-stepper" aria-label="Contributor steps">
        {["Generate", "Prepare", "Review", "Submit"].map((label, step) => (
          <li key={label} className={phase === step + 1 ? "active" : phase > step + 1 ? "complete" : ""} aria-current={phase === step + 1 ? "step" : undefined}>
            <span>{step + 1}</span>{label}
          </li>
        ))}
      </ol>
      {phase === 1 && method === "ai" ? (
        <section className="card stack">
          <h2>1. Generate with an LLM website</h2>
          <p className="muted">Fydor does not use a provider API. It copies a lesson-generation prompt and opens the normal chat website. Paste the returned JSON in the next phase.</p>
          <div className="row">
            <button className="button secondary" onClick={() => void copyAndOpen("chatgpt")}><ExternalLink size={16} />Copy + ChatGPT</button>
            <button className="button secondary" onClick={() => void copyAndOpen("claude")}><ExternalLink size={16} />Copy + Claude</button>
          </div>
          <div className="community-step-actions">
            <span />
            <button className="button" onClick={() => void nextPhase()}>Next: Prepare lesson</button>
          </div>
        </section>
      ) : null}
      {phase === 1 && method === "existing" ? (
        <section className="card stack">
          <h2>1. Choose an existing Fydor pack</h2>
          <p className="muted">Select a completed `.json` or `.fydorpack` file. Fydor will validate it before saving it as a contributor draft.</p>
          <input ref={packInputRef} className="community-hidden-file" type="file" accept=".json,.fydorpack,application/json" aria-label="Choose an existing Fydor pack" onChange={(event) => void readExistingPack(event.target.files?.[0], setExistingPack, setExistingPackFile, setStatus)} />
          <button className="button secondary community-pack-picker" type="button" onClick={() => packInputRef.current?.click()}><FolderOpen size={16} />{existingPackFile || "Choose pack file"}</button>
          {existingPack ? <PackSummary validation={{ pack: existingPack, errors: [], warnings: [], lessonErrors: [], lessonCount: existingPack.lessons.length, sentenceCount: countPackSentences(existingPack) }} /> : <p className="muted">No pack selected yet.</p>}
          <div className="community-step-actions"><span /><button className="button" disabled={!existingPack} onClick={() => setPhase(2)}>Continue with this pack</button></div>
        </section>
      ) : null}
      {phase === 2 ? (
        <section className="card stack">
          <h2>{method === "existing" ? "2. Confirm existing pack" : "2. Paste or edit lesson JSON"}</h2>
          {method === "existing" ? (existingPack ? <PackSummary validation={{ pack: existingPack, errors: [], warnings: [], lessonErrors: [], lessonCount: existingPack.lessons.length, sentenceCount: countPackSentences(existingPack) }} /> : <p className="muted">Choose a pack before continuing.</p>) : <textarea className="input community-code" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Paste the LLM's strict Fydor lesson JSON here." />}
          <div className="community-step-actions">
            <button className="button secondary" onClick={previousPhase}>Back</button>
            <button className="button" disabled={method === "existing" && !existingPack} onClick={() => void nextPhase()}>{method === "existing" ? "Save pack & continue" : "Save draft & continue"}</button>
          </div>
        </section>
      ) : null}
      {phase === 3 && pack ? (
        <section className="card stack">
          <h2>3. Review every sentence ({reviewed.size}/{sentences.length})</h2>
          <article className="community-sentence">
            <strong>Sentence {index + 1}</strong>
            <p>{sentences[index]?.text}</p>
            <p className="muted">{sentences[index]?.translation}</p>
          </article>
          <div className="row">
            <button className="button secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous sentence</button>
            <button className="button" onClick={() => void review()}>{reviewed.has(index) ? "Reviewed" : "Mark reviewed"}</button>
            <button className="button secondary" disabled={index >= sentences.length - 1} onClick={() => setIndex(index + 1)}>Next sentence</button>
          </div>
          <div className="community-step-actions">
            <button className="button secondary" onClick={previousPhase}>Back</button>
            <button className="button" onClick={() => void nextPhase()}>Next: Submission</button>
          </div>
        </section>
      ) : null}
      {phase === 4 && pack ? (
        <section className="card stack">
          <h2>4. Submit your pack</h2>
          <p className="muted">Your reviewed pack will be sent to language moderators as an immutable version.</p>
          <label>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I reviewed every sentence and annotation.
          </label>
          <div className="community-step-actions">
            <button className="button secondary" onClick={previousPhase}>Back</button>
            <button className="button" disabled={reviewed.size !== sentences.length} onClick={() => void submit()}>Submit for review</button>
          </div>
        </section>
      ) : null}
      {status ? <p className="muted">{status}</p> : null}
    </div>
  );
}

function toContributionPack(value: Lesson | FydorPack | null): FydorPack | null {
  if (!value) return null;
  if (isFydorPack(value)) return value;
  const now = new Date().toISOString();
  return {
    type: "fydor_pack",
    schemaVersion: 1,
    id: `contributor-${value.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "pack"}`,
    title: value.title,
    version: "1.0.0",
    language: value.language,
    baseLanguage: value.baseLanguage,
    level: value.level,
    tags: [],
    createdAt: now,
    updatedAt: now,
    lessons: [{ language: value.language, baseLanguage: value.baseLanguage, title: value.title, level: value.level, sentences: value.sentences }]
  };
}

function isFydorPack(value: Lesson | FydorPack): value is FydorPack {
  return "type" in value && value.type === "fydor_pack" && Array.isArray(value.lessons);
}

function countPackSentences(pack: FydorPack): number {
  return pack.lessons.reduce((total, lesson) => total + lesson.sentences.length, 0);
}

function PackSummary({ validation }: { validation: FydorPackValidation }) {
  const pack = validation.pack;
  if (!pack) return null;
  return (
    <div className="community-pack-summary">
      <strong>{pack.title}</strong>
      <span>{pack.language} → {pack.baseLanguage}</span>
      <span>{pack.lessons.length} lesson{pack.lessons.length === 1 ? "" : "s"} · {validation.sentenceCount} sentences</span>
      {pack.description ? <p className="muted">{pack.description}</p> : null}
    </div>
  );
}

async function readExistingPack(
  file: File | undefined,
  setPack: (pack: FydorPack | null) => void,
  setFileName: (name: string) => void,
  setStatus: (message: string) => void
) {
  if (!file) return;
  if (file.size > 5_000_000) {
    setPack(null);
    setFileName("");
    setStatus("This pack is larger than the 5 MB limit.");
    return;
  }
  try {
    const validation = parseFydorPack(await file.text());
    if (!validation.pack || validation.errors.length || validation.lessonErrors.length) {
      setPack(null);
      setFileName("");
      setStatus([...validation.errors, ...validation.lessonErrors.flatMap((item) => item.errors)].join(" ") || "This is not a valid Fydor pack.");
      return;
    }
    setPack(validation.pack);
    setFileName(file.name);
    setStatus(`Selected ${file.name}. ${validation.sentenceCount} sentences are ready for review.`);
  } catch (error) {
    setPack(null);
    setFileName("");
    setStatus(errorMessage(error, "Unable to read this Fydor pack."));
  }
}

function Moderation({ session }: { session: CommunitySession }) {
  const [items, setItems] = useState<Submission[]>([]);
  const [active, setActive] = useState<Submission | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await communityApi<{ submissions: Submission[] }>(session, "/api/moderation?action=queue&status=submitted,language_approved,approved");
      setItems(result.submissions);
    } catch (error) {
      setStatus(errorMessage(error, "Unable to load moderation queue."));
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(nextState: string) {
    if (!active) return;
    try {
      await communityApi(session, "/api/moderation", {
        method: "POST",
        headers: { "Idempotency-Key": communityActionId("transition") },
        body: JSON.stringify({ action: "transition", submissionId: active.id, version: active.current_version, rowVersion: active.row_version, nextState })
      });
      setStatus(`Submission moved to ${nextState.replace("_", " ")}.`);
      setActive(null);
      await load();
    } catch (error) {
      setStatus(errorMessage(error, "Transition failed."));
    }
  }

  async function claim() {
    if (!active) return;
    try {
      await communityApi(session, "/api/moderation", {
        method: "POST",
        body: JSON.stringify({ action: "claim", submissionId: active.id, version: active.current_version })
      });
      setStatus("Review claimed. You can now complete language moderation.");
      await load();
    } catch (error) {
      setStatus(errorMessage(error, "Unable to claim this review."));
    }
  }

  async function open(item: Submission) {
    try {
      const result = await communityApi<{ submission: Submission; versions: Array<{ version: number; canonical_json: Lesson }> }>(session, `/api/moderation?action=workspace&id=${encodeURIComponent(item.id)}`);
      setActive(result.submission);
      setActiveLesson(result.versions.find((version) => version.version === result.submission.current_version)?.canonical_json ?? null);
    } catch (error) {
      setStatus(errorMessage(error, "Unable to open this review."));
    }
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row">
          <h2>Review queue</h2>
          <button className="button secondary" onClick={() => void load()}><RefreshCw size={16} />Refresh</button>
        </div>
        {items.map((item) => <button className="community-queue-item" key={item.id} onClick={() => void open(item)}><strong>{item.title}</strong><span>{item.target_language} → {item.base_language} · {item.state}</span></button>)}
        {!items.length ? <p className="muted">No submissions are ready for your role.</p> : null}
      </section>
      {active ? (
        <section className="card stack">
          <h2>{active.title}</h2>
          <p>State: <strong>{active.state}</strong></p>
          {activeLesson?.sentences.map((sentence, sentenceIndex) => <article className="community-sentence" key={`${sentenceIndex}:${sentence.text}`}><strong>Sentence {sentenceIndex + 1}</strong><p>{sentence.text}</p><p className="muted">{sentence.translation}</p></article>)}
          {active.state === "submitted" ? <div className="row"><button className="button secondary" onClick={() => void claim()}>Claim review</button><button className="button" onClick={() => void act("language_approved")}>Approve language review</button></div> : null}
          {active.state === "language_approved" ? <button className="button" onClick={() => void act("approved")}>Approve for publication</button> : null}
          {active.state === "approved" ? <button className="button" onClick={() => void act("published")}>Publish lesson</button> : null}
        </section>
      ) : null}
      {status ? <p className="muted">{status}</p> : null}
    </div>
  );
}

function Administration({ session }: { session: CommunitySession }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; email: string; verified_at: string | null }>>([]);
  const [status, setStatus] = useState("");

  async function search() {
    try {
      const result = await communityApi<{ users: Array<{ id: string; email: string; verified_at: string | null }> }>(session, `/api/admin?action=users&q=${encodeURIComponent(query)}`);
      setUsers(result.users);
    } catch (error) {
      setStatus(errorMessage(error, "Unable to search users."));
    }
  }

  return (
    <section className="card stack">
      <h2>Users and roles</h2>
      <div className="row">
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search verified users" />
        <button className="button secondary" onClick={() => void search()}>Search</button>
      </div>
      {users.map((user) => <div className="community-queue-item" key={user.id}><strong>{user.email}</strong><span>{user.verified_at ? "Verified" : "Not verified"}</span></div>)}
      {status ? <p className="muted">{status}</p> : null}
    </section>
  );
}
