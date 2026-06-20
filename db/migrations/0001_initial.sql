create extension if not exists "pgcrypto";

create type review_rating as enum ('easy', 'correct', 'hard', 'failed');
create type learning_item_type as enum ('word', 'grammar', 'chunk');
create type sentence_drill_type as enum ('recall', 'reconstruction', 'cloze', 'transformation', 'original_sentence');

create table lessons (
  id uuid primary key default gen_random_uuid(),
  target_language text not null,
  base_language text not null,
  level text,
  title text not null,
  source_hash text not null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table learning_items (
  id uuid primary key default gen_random_uuid(),
  language text not null,
  type learning_item_type not null,
  canonical_key text not null,
  display_text text not null,
  meaning text,
  explanation text,
  common_mistakes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sentences (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  language text not null,
  text text not null,
  normalized_text text not null,
  translation text not null,
  focus_canonical_key text,
  focus_display_text text,
  focus_meaning text,
  focus_explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sentence_tokens (
  id uuid primary key default gen_random_uuid(),
  sentence_id uuid not null references sentences(id) on delete cascade,
  position integer not null,
  text text not null,
  item_type learning_item_type,
  canonical_key text,
  meaning text,
  explanation text,
  common_mistakes jsonb not null default '[]',
  learning_item_id uuid references learning_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sentence_item_links (
  id uuid primary key default gen_random_uuid(),
  sentence_id uuid not null references sentences(id) on delete cascade,
  learning_item_id uuid not null references learning_items(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table drills (
  id uuid primary key default gen_random_uuid(),
  sentence_id uuid not null references sentences(id) on delete cascade,
  learning_item_id uuid references learning_items(id) on delete set null,
  type sentence_drill_type not null,
  prompt text not null,
  answer text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table review_states (
  id uuid primary key default gen_random_uuid(),
  drill_id uuid not null references drills(id) on delete cascade,
  review_state text not null default 'new',
  next_review_at timestamptz not null default now(),
  interval_days integer not null default 0,
  last_grade review_rating,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sentence_review_attempts (
  id uuid primary key default gen_random_uuid(),
  review_state_id uuid not null references review_states(id) on delete cascade,
  drill_id uuid not null references drills(id) on delete cascade,
  drill_type sentence_drill_type not null,
  response text,
  grade review_rating not null,
  attempted_at timestamptz not null default now()
);

create unique index lessons_source_idx on lessons(source_hash);
create index lessons_title_idx on lessons(title);
create unique index learning_items_canonical_idx on learning_items(canonical_key);
create index learning_items_language_type_idx on learning_items(language, type);
create unique index sentences_language_normalized_idx on sentences(language, normalized_text);
create index sentences_lesson_idx on sentences(lesson_id);
create unique index sentence_tokens_sentence_position_idx on sentence_tokens(sentence_id, position);
create unique index sentence_item_links_unique_idx on sentence_item_links(sentence_id, learning_item_id, role);
create index sentence_item_links_item_idx on sentence_item_links(learning_item_id);
create unique index drills_sentence_type_idx on drills(sentence_id, type);
create index drills_sentence_idx on drills(sentence_id);
create unique index review_states_drill_idx on review_states(drill_id);
create index review_states_due_idx on review_states(next_review_at);
create index sentence_review_attempts_state_idx on sentence_review_attempts(review_state_id);
create index sentence_review_attempts_drill_idx on sentence_review_attempts(drill_id);
