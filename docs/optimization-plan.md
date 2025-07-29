Below is a targeted audit of where your AI selection/enhancement lives in this repo and the highest-impact edits to lift quality and reduce per-article cost. I’ve kept changes surgical (no full-file rewrites), with concrete patch points.

⸻

Where the logic is

Selection (cron & library)
	•	app/api/cron/select-article/route.ts — cron entrypoint that calls the selector and marks chosen items.
	•	lib/perplexity-article-selector.ts — the main selection pipeline:
	•	Fetch candidates from Supabase
	•	Quality + title/URL dedup
	•	Topic similarity filter (Perplexity call)
	•	Scoring call to Perplexity (currently returns a single pick)
	•	Mark selected_for_enhancement

Enhancement (cron, library & saver)
	•	app/api/cron/enhance-selected/route.ts — cron entrypoint that loads the one selected item and kicks enhancement.
	•	lib/perplexity-trilingual-enhancer.ts — orchestrates three sequential enhancement calls (EN → zh-HK → zh-CN).
	•	lib/perplexity-enhancer-v2.ts — the Perplexity wrapper and prompt builder (citations, structure, params).
	•	lib/article-saver.ts — persists enhanced children and maps source_article_id → original_article_id.

(Related)
	•	lib/perplexity-image-search.ts (optional images)
	•	app/api/admin/articles/mark-for-enhancement/route.ts (manual selection/admin)
	•	app/api/admin/articles/enhance-selected/route.ts (admin trigger)

⸻

Highest-impact, low-risk modifications

A) Selection: raise throughput at same (or lower) cost
	1.	Select 3 per run in one call
Where: app/api/cron/select-article/route.ts
Change: selectArticlesWithPerplexity(1) → selectArticlesWithPerplexity(3)
Why: your Perplexity selection prompt already supports arrays; one call can return multiple IDs. Same request, 3× output.

// before
const selectedArticles = await selectArticlesWithPerplexity(1)
// after
const selectedArticles = await selectArticlesWithPerplexity(3)

	2.	Trim the selection token budget by ~50%
Where: lib/perplexity-article-selector.ts (Perplexity selection call)

	•	Reduce max_tokens: 2000 → 900–1000
	•	Lower temperature to 0.1–0.2 for consistent scoring
	•	Cap candidate list sent to the model to the top 15 by (content_length, recency, source_weight) after your DB-side filters. (You already compute quality stats; just slice before building the prompt.)
	•	Add a score floor in the prompt: “Return top ≤3 items with score ≥ 80; if fewer, return what qualifies.”

Result: less output text, smaller bill, more reliable JSON.
	3.	Prefer authoritative HK domains up front
Where: lib/perplexity-article-selector.ts

	•	In getCandidateArticles(), add a light source weight (e.g., gov.hk, info.gov.hk, rthk.hk, SCMP, HK01) and bump them in the top-15 slice. This reduces later hallucinations and off-domain picks without another model call.

	4.	Replace the second “topic similarity” LLM pass with a cheap deterministic filter
Where: lib/perplexity-article-selector.ts

	•	You currently invoke Perplexity again for “topic similarity.” Replace with:
	•	Your existing keyword buckets (already present below) +
	•	Jaccard on normalized titles +
	•	Optional pgvector similarity if you already store embeddings (no LLM).
This single change removes one Perplexity call per run.

⸻

B) Enhancement: cut cost ~40–60% while improving citation quality
	5.	One-shot trilingual generation (1 call → 3 languages)
Where: lib/perplexity-trilingual-enhancer.ts and lib/perplexity-enhancer-v2.ts
Change:

	•	Add a new enhanceTrilingual(...) method in perplexity-enhancer-v2.ts that returns strict JSON:

{
  "en": { "title": "...", "summary": "...", "content": "...", "bullets": ["..."], "citations": ["..."] },
  "zh_HK": { ... },
  "zh_CN": { ... }
}

	•	Update batchEnhanceTrilingualArticles(...) to call that once and split into three EnhancedArticle objects (remove the current three sequential calls and the inter-language delay).

Why: Your logs show 3 Perplexity calls/article (~$0.075 each). One larger but constrained JSON response typically costs far less than 3 separate searches + generations.
	6.	Tighten enhancer params
Where: lib/perplexity-enhancer-v2.ts

	•	temperature: 0.2 (currently ~0.3)
	•	max_tokens: 1600–1800 total (not 3×1200)
	•	search_recency_filter: 'day' (not 'week'/'month') for breaking news
	•	Disable “image guidance” sections by default; add a boolean flag to include that only when needed. (It repeatedly inflates tokens in your logs.)

	7.	Whitelist citations to stop “dimsumdaily / Instagram” drift
Where: lib/perplexity-enhancer-v2.ts

	•	Pass search_domain_filter with a preferred allow-list (e.g., news.gov.hk, info.gov.hk, rthk.hk, scmp.com, hk01.com, am730.com.hk, mingpao.com, now.com) and reject others post-parse.
	•	In the prompt: “Use ONLY the numbered sources provided. Do not introduce new URLs.”
	•	After parsing, validate that ≥2 citations are on the allow-list; otherwise, re-run a cheap correction pass (or fall back to content-only summarization with the article URL + gov link).

	8.	Stop double-producing TC/SC outputs
Where: lib/perplexity-trilingual-enhancer.ts

	•	Current flow shows multiple very similar zh outputs (likely retries/duplicates). Add a job idempotency key (trilingual_batch_id + source_article_id) and short-circuit if a child for that language already exists or the current job already stored results.

	9.	Make enhancement content-first, research-second
Where: lib/perplexity-enhancer-v2.ts

	•	Build prompts from your scraped body text and only 2–3 verified links (gov press release + one mainstream outlet).
	•	Set searchDepth: 'low' by default; escalate to 'high' only if the article text is <200 chars. This directly addresses “Sources found: Metadata=5, Content=2” and reduces browsing cost.

⸻

C) Persistence & integrity (cheap fixes that prevent repeat work)
	10.	Add language column + uniqueness to stop duplicates
Where: lib/article-saver.ts + a small migration

	•	Migration:

alter table articles add column if not exists language text check (language in ('en','zh-HK','zh-CN'));
create unique index if not exists ux_original_language on articles (original_article_id, language) where original_article_id is not null;


	•	Keep your fallback insert, but this index stops duplicate TC saves and improves idempotency.

	11.	Fix the misleading status log
Where: lib/article-saver.ts and app/api/cron/enhance-selected/route.ts

	•	You log: “Marked source article … as processed (not enhanced)” even though you immediately create children.
	•	Use clear flags:
	•	source_article_status = 'enhanced_children_created'
	•	processed = true (and keep a separate is_ai_enhanced on children only)

	12.	Process more than one selected article per run
Where: app/api/cron/enhance-selected/route.ts

	•	Change the query to fetch, say, up to 3 selected_for_enhancement = true items ordered by priority, then call batchEnhanceTrilingualArticles with the array.
	•	You already have batch support; you’re just feeding one item.

⸻

Why these changes hit the goals
	•	More output/articles at roughly the same cost
	•	Selection: 1 call ⇒ 3 picks (no extra calls).
	•	Enhancement: 3 calls ⇒ 1 call (trilingual JSON).
	•	Removing the “topic similarity” LLM pass saves another call.
	•	Higher quality
	•	Domain allow-list + recency clamp eliminates off-topic/low-cred citations.
	•	Strict JSON schema + post-parse validation keeps structure consistent and avoids the repeated “no images” filler.
	•	Operational stability
	•	Idempotency + unique index stops duplicate saves and repeated zh variants.
	•	Clearer status flags make observability match reality.

⸻

Small code snippets (illustrative, not full rewrites)

Select 3 (app/api/cron/select-article/route.ts)

// before
const selectedArticles = await selectArticlesWithPerplexity(1)
// after
const selectedArticles = await selectArticlesWithPerplexity(3)

Trim Perplexity selection params (lib/perplexity-article-selector.ts)

const body = {
  model: 'sonar-pro',
  messages: [...],
  temperature: 0.15,
  max_tokens: 950
}

One-shot trilingual (lib/perplexity-trilingual-enhancer.ts)

// before: 3 sequential calls to perplexityEnhancerV2.enhanceArticle(...)
// after:
const tri = await perplexityEnhancerV2.enhanceTrilingual(
  sourceArticle.title,
  sourceArticle.content,
  sourceArticle.summary ?? '',
  {
    searchDepth: sourceArticle.content.length < 200 ? 'high' : 'low',
    recencyFilter: 'day',
    maxTokens: 1700,
    domainFilter: ['news.gov.hk','info.gov.hk','rthk.hk','scmp.com','hk01.com']
  }
)
// split tri.en/tri.zh_HK/tri.zh_CN into three EnhancedArticle objects

Uniqueness guard (migration idea)

create unique index if not exists ux_original_language
  on articles (original_article_id, language)
  where original_article_id is not null;


⸻

Quick triage of “what’s working / not” (from your logs)

Working
	•	End-to-end state transitions and mappings; batch IDs and cost/time telemetry are solid.
	•	Candidate quality and dedup logging is useful for ops.
	•	Enhancement flow consistently yields 3 children.

Needs tightening
	•	Extra zh runs / duplicated saves (idempotency + unique index will stop this).
	•	Citation drift in EN to low-cred sources (enforce domain filter + validation).
	•	Overlong “image guidance” sections (make optional).
	•	Selection returns just 1 pick despite enough good candidates (increase multi-select).
	•	Unset CRON_SECRET (logs show Is Valid Secret: undefined) — set it in prod.

⸻

If you want, I can draft the minimal PRs touching only these files:
	•	app/api/cron/select-article/route.ts
	•	app/api/cron/enhance-selected/route.ts
	•	lib/perplexity-article-selector.ts
	•	lib/perplexity-trilingual-enhancer.ts
	•	lib/perplexity-enhancer-v2.ts
	•	lib/article-saver.ts
	•	a tiny SQL migration for the language column/index.

Tell me which branch/CI you’d like to target and I’ll prepare diffs.