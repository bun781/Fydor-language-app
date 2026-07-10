export type TourPlacement = "top" | "bottom" | "left" | "right";

export interface TourStep {
  route: string;
  section: string;
  title: string;
  description: string;
  details?: string[];
  targetSelectors?: string[];
  placement?: TourPlacement;
  primaryLabel?: string;
}

const tourCatalog: Record<string, TourStep[]> = {
  "/lessons/manage::builder": [
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Start from a sample lesson",
      description: "The builder tab is the easiest place to learn the lesson shape before you paste your own content.",
      details: [
        "Sample lesson fills the editor with a complete example you can safely edit.",
        "Builder mode shows the lesson as visible fields instead of raw JSON.",
        "Use this tab when you want to create or tweak a lesson by hand."
      ],
      targetSelectors: ['[data-tour="lesson-sample"]'],
      placement: "bottom"
    },
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Builder mode is the friendly editor",
      description: "Use Builder when you want a visible form and fast feedback while drafting lessons.",
      details: [
        "You can switch back and forth with JSON mode at any time.",
        "The Builder tab stays best when you are shaping one lesson sentence by sentence."
      ],
      targetSelectors: ['[data-tour="lesson-editor-mode"]'],
      placement: "bottom"
    },
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Check before you save",
      description: "Check catches format issues early, and Save commits the lesson once it looks right.",
      details: [
        "Use Check to spot missing fields or invalid lesson structure.",
        "Use Preview when you want to inspect the lesson before saving.",
        "Save writes the lesson into the local library."
      ],
      targetSelectors: ['[data-tour="lesson-check"]', '[data-tour="lesson-save"]'],
      placement: "top",
      primaryLabel: "Finish"
    }
  ],
  "/lessons/manage::json": [
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Paste complete lesson JSON here",
      description: "The JSON tab is for AI output or hand-written lesson files that are already structured.",
      details: [
        "Paste only valid JSON, without extra commentary around it.",
        "The JSON tab is useful when another tool already generated the lesson for you."
      ],
      targetSelectors: ['[data-tour="lesson-json-mode"]'],
      placement: "bottom"
    },
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Use the guide if the format is unclear",
      description: "Open the import help panel for schema guidance and prompt templates.",
      details: [
        "The guide explains required fields, optional fields, and examples.",
        "Prompt templates are ready to paste into ChatGPT or another assistant."
      ],
      targetSelectors: ['[data-tour="import-guide"]', '[data-tour="import-prompts"]'],
      placement: "bottom"
    },
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Validate before saving",
      description: "Check and Save still matter most on the JSON tab, because they catch bad lesson data before it reaches study mode.",
      details: [
        "Check gives you a fast validation pass.",
        "Save only when the lesson is structurally sound."
      ],
      targetSelectors: ['[data-tour="lesson-check"]', '[data-tour="lesson-save"]'],
      placement: "top",
      primaryLabel: "Finish"
    }
  ],
  "/lessons/manage::lessons": [
    {
      route: "/lessons/manage",
      section: "Lesson Library",
      title: "Browse your saved lessons",
      description: "The Lessons tab is the library view for opening, exporting, or deleting saved lessons.",
      details: [
        "New lesson creates a blank lesson in the editor.",
        "Saved lessons can be reopened for editing or exported as JSON.",
        "This tab is where you manage lessons after they are already saved."
      ],
      targetSelectors: ['[data-tour="lesson-library-new"]', '[data-tour="lesson-library-list"]'],
      placement: "bottom"
    },
    {
      route: "/lessons/manage",
      section: "Lesson Library",
      title: "Open, export, or delete a lesson",
      description: "Choose a lesson and use the action buttons on the right to work with it.",
      details: [
        "Open in editor returns the lesson to the builder.",
        "Export JSON lets you share or back up a lesson.",
        "Delete removes the lesson from the library."
      ],
      targetSelectors: ['[data-tour="lesson-library-actions"]'],
      placement: "left",
      primaryLabel: "Finish"
    }
  ],
  "/lessons/manage::help-guide": [
    {
      route: "/lessons/manage",
      section: "Import Help",
      title: "Read the lesson guide first",
      description: "The guide explains the lesson schema, required fields, and good examples before you paste AI output into the editor.",
      details: [
        "Use it when you are unsure what a lesson field should look like.",
        "The examples show the structure Fydor expects."
      ],
      targetSelectors: ['[data-tour="import-guide-panel"]'],
      placement: "right"
    },
    {
      route: "/lessons/manage",
      section: "Import Help",
      title: "Use prompt templates when you want AI help",
      description: "Prompt templates are the faster path if you want another model to draft the lesson for you.",
      details: [
        "The templates are designed to be copied into an AI tool and customized.",
        "Switch to the prompt tab when you want the assistant to do the drafting."
      ],
      targetSelectors: ['[data-tour="import-prompts"]'],
      placement: "right",
      primaryLabel: "Finish"
    }
  ],
  "/lessons/manage::help-prompts": [
    {
      route: "/lessons/manage",
      section: "Import Help",
      title: "Copy a template and customize it",
      description: "Prompt templates are ready-made instructions for lesson generation and cleanup.",
      details: [
        "Use Copy to move a template into your clipboard.",
        "Replace the language, topic, and difficulty to match your lesson."
      ],
      targetSelectors: ['[data-tour="import-prompts-panel"]'],
      placement: "right"
    },
    {
      route: "/lessons/manage",
      section: "Import Help",
      title: "Return to the guide if you need schema help",
      description: "The guide tab is better when you need to check fields, examples, or validation rules.",
      details: [
        "Go back to Guide when you need a schema refresher.",
        "Use Check in the editor once the JSON is ready."
      ],
      targetSelectors: ['[data-tour="import-guide"]'],
      placement: "right",
      primaryLabel: "Finish"
    }
  ],
  "/review::start": [
    {
      route: "/review",
      section: "Review",
      title: "Pick a review mix",
      description: "The Start tab is where you choose which lessons and which queue style to practice.",
      details: [
        "Select the lessons you want to include in the session.",
        "Start Mixed Review blends due, new, and later cards together.",
        "Due only and New only let you narrow the queue."
      ],
      targetSelectors: ['[data-tour="review-start-tabs"]', '[data-tour="review-start-mixed"]'],
      placement: "bottom"
    },
    {
      route: "/review",
      section: "Review",
      title: "Use the queue dashboard",
      description: "The dashboard shows how much due, new, and mastered material is waiting.",
      details: [
        "It helps you decide whether to do a quick pass or a longer mixed session.",
        "Reset Progress is there when you want to restart a lesson's review state."
      ],
      targetSelectors: ['[data-tour="review-queue-dashboard"]', '[data-tour="review-reset-progress"]'],
      placement: "right",
      primaryLabel: "Finish"
    }
  ],
  "/review::statistics": [
    {
      route: "/review",
      section: "Review",
      title: "See what still needs work",
      description: "The Statistics tab groups remembered and needs-review items so the next target is obvious.",
      details: [
        "Use the stat cards to jump between sentences, words, grammar, and chunks.",
        "Search and sort help you narrow the list when the deck gets larger."
      ],
      targetSelectors: ['[data-tour="review-statistics-tab"]', '[data-tour="review-stats-dashboard"]'],
      placement: "bottom"
    },
    {
      route: "/review",
      section: "Review",
      title: "Reset from the list when needed",
      description: "Each row can be reset independently if you want to clear progress on one item.",
      details: [
        "The reset action is useful when a card was marked too easily or needs a fresh start."
      ],
      targetSelectors: ['[data-tour="review-stats-list"]'],
      placement: "left",
      primaryLabel: "Finish"
    }
  ],
  "/fydor-exchange": [
    {
      route: "/fydor-exchange",
      section: "Fydor Exchange",
      title: "Choose an Exchange path",
      description: "Fydor Exchange keeps the main ways to move lessons between your library and other people in one place.",
      details: [
        "Install brings a shared lesson pack into your local library.",
        "Share turns your own lessons into a portable pack."
      ],
      targetSelectors: ['[data-tour="exchange-hub-install"]'],
      placement: "bottom"
    },
    {
      route: "/fydor-exchange",
      section: "Fydor Exchange",
      title: "Browse the public library",
      description: "The public library is where you can find published lessons before installing them.",
      details: [
        "Open a published lesson to inspect its metadata and sentences.",
        "The library can send a lesson directly to the install screen."
      ],
      targetSelectors: ['[data-tour="exchange-public-library"]'],
      placement: "bottom"
    },
    {
      route: "/fydor-exchange",
      section: "Fydor Exchange",
      title: "Share your own lessons",
      description: "The Share Pack screen turns selected lessons into a portable pack you can export or publish.",
      details: [
        "Pick one or more lessons and fill in the pack metadata.",
        "Build a preview before exporting or publishing."
      ],
      targetSelectors: ['[data-tour="exchange-hub-share"]'],
      placement: "bottom",
      primaryLabel: "Finish"
    }
  ],
  "/fydor-exchange::install": [
    {
      route: "/fydor-exchange/import",
      section: "Fydor Exchange",
      title: "Install a shared lesson pack",
      description: "Preview and import a Fydor Pack from a file or pasted JSON.",
      details: [
        "Preview checks the pack structure before anything is installed.",
        "Duplicate handling decides whether old lessons are skipped, replaced, or kept."
      ],
      targetSelectors: ['[data-tour="exchange-install"]'],
      placement: "bottom",
      primaryLabel: "Finish"
    }
  ],
  "/fydor-exchange::export": [
    {
      route: "/fydor-exchange/export",
      section: "Fydor Exchange",
      title: "Build a pack from your lessons",
      description: "Select lessons and add metadata before you export or publish a Fydor Pack.",
      details: [
        "Pick one or more lessons, then fill in the pack title and other metadata.",
        "Build a preview to check the pack before sharing it."
      ],
      targetSelectors: ['[data-tour="exchange-share"]'],
      placement: "bottom",
      primaryLabel: "Finish"
    }
  ],
  "/study/imported-content": [
    {
      route: "/study/imported-content",
      section: "Flashcards",
      title: "Choose a lesson to study",
      description: "Flashcards show one saved lesson at a time and let you switch between language groups and lesson sets.",
      details: [
        "Use the selectors to move between languages and lessons.",
        "The page opens to the currently selected lesson and remembers your last choice."
      ],
      targetSelectors: ['[data-tour="study-selector-bar"]'],
      placement: "bottom"
    },
    {
      route: "/study/imported-content",
      section: "Flashcards",
      title: "Reveal the sentence layer by layer",
      description: "Translation, words, grammar, and hints are meant to be opened gradually.",
      details: [
        "Try to answer before revealing anything.",
        "Translation should usually be the last thing you show yourself."
      ],
      targetSelectors: ['[data-tour="study-translation"]'],
      placement: "top",
      primaryLabel: "Finish"
    }
  ],
  "/study/fill-blank": [
    {
      route: "/study/fill-blank",
      section: "Fill Blank",
      title: "Use fill blank for active recall",
      description: "This mode turns saved lessons into a missing-word practice session.",
      details: [
        "It is useful when you recognize a sentence but still want to produce part of it yourself.",
        "The same lesson library powers this mode and the other study pages."
      ],
      targetSelectors: ['[data-tour="study-mode-title"]'],
      placement: "bottom",
      primaryLabel: "Finish"
    }
  ],
  "/study/multiple-choice": [
    {
      route: "/study/multiple-choice",
      section: "Multiple Choice",
      title: "Use multiple choice for faster recognition",
      description: "This mode quizzes the same saved lesson pool with answer choices instead of free recall.",
      details: [
        "It is helpful when you want a quicker pass or a lighter practice session.",
        "Use it alongside flashcards and fill blank, not as a replacement."
      ],
      targetSelectors: ['[data-tour="study-mode-title"]'],
      placement: "bottom",
      primaryLabel: "Finish"
    }
  ]
};

const scopeAliases: Record<string, string> = {
  "/": "/lessons/manage::lessons",
  "/admin/imports": "/lessons/manage::builder"
};

const defaultScopes: Record<string, string> = {
  "/lessons/manage": "/lessons/manage::lessons",
  "/review": "/review::start",
  "/fydor-exchange": "/fydor-exchange",
  "/fydor-exchange/import": "/fydor-exchange::install",
  "/fydor-exchange/export": "/fydor-exchange::export",
  "/study/imported-content": "/study/imported-content",
  "/study/fill-blank": "/study/fill-blank",
  "/study/multiple-choice": "/study/multiple-choice"
};

export function getTourSteps(scope: string) {
  return tourCatalog[scope] ?? tourCatalog[scope.split("::")[0]] ?? null;
}

export function resolveTourScope(scope: string) {
  if (tourCatalog[scope]) return scope;
  return scopeAliases[scope] ?? defaultScopes[scope] ?? scope;
}
