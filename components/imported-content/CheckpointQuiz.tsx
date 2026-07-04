"use client";

import { useMemo, useState } from "react";
import type { StudySentence } from "@/lib/imported-content/types";
import { generateQuizQuestion } from "@/lib/imported-content/study-utils";

interface Props {
  sentences: StudySentence[];
  allSentences: StudySentence[];
  onComplete: () => void;
}

export function CheckpointQuiz({ sentences, allSentences, onComplete }: Props) {
  const question = useMemo(
    () => generateQuizQuestion(sentences, allSentences),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  if (!question) {
    return (
      <div className="quiz-card card stack">
        <div className="row">
          <h2>Quick Check</h2>
          <span className="pill">Checkpoint</span>
        </div>
        <p className="muted">Not enough data for a quiz on this lesson yet.</p>
        <button className="button" type="button" onClick={onComplete}>Continue →</button>
      </div>
    );
  }

  function submit(selected?: string) {
    if (!question) return;
    const userAnswer = selected ?? answer;
    setAnswer(userAnswer);
    setCorrect(userAnswer.trim().toLowerCase() === question.answer.toLowerCase());
    setSubmitted(true);
  }

  return (
    <div className="quiz-card card stack">
      <div className="row">
        <h2>Quick Check</h2>
        <span className="pill">Checkpoint</span>
      </div>

      <p className="quiz-prompt">{question.prompt}</p>

      {question.type === "multiple-choice" && question.options ? (
        <div className="quiz-choices">
          {question.options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={[
                "button secondary quiz-choice",
                submitted && opt === question.answer ? "quiz-correct" : "",
                submitted && opt === answer && opt !== question.answer ? "quiz-wrong" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={submitted}
              onClick={() => submit(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <div className="stack">
          <input
            type="text"
            className="input"
            value={answer}
            placeholder="Type your answer…"
            disabled={submitted}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitted) submit();
            }}
          />
          {!submitted ? (
            <button type="button" className="button" onClick={() => submit()}>Check</button>
          ) : null}
        </div>
      )}

      {submitted ? (
        <p className={`quiz-result ${correct ? "quiz-result-ok" : "quiz-result-fail"}`}>
          {correct ? "✓ Correct!" : `✗ Answer: ${question.answer}`}
        </p>
      ) : null}

      {submitted ? (
        <button type="button" className="button" onClick={onComplete}>Continue →</button>
      ) : (
        <button type="button" className="button secondary quiz-skip-button" onClick={onComplete}>
          Skip quiz →
        </button>
      )}
    </div>
  );
}
