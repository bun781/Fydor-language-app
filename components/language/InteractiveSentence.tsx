"use client";

interface InteractiveSentenceToken {
  id?: string;
  text: string;
  meaning?: string | null;
  explanation?: string | null;
  commonMistakes?: string[] | null;
  canonicalKey?: string | null;
  learningItemId?: string | null;
}

interface InteractiveSentenceProps {
  sentence: string;
  tokens: InteractiveSentenceToken[];
}

export function InteractiveSentence({ sentence, tokens }: InteractiveSentenceProps) {
  if (!tokens.length) {
    return <p className="sentence-text">{sentence}</p>;
  }

  return (
    <div className="interactive-sentence" aria-label={sentence}>
      {tokens.map((token, index) => (
        <button className="token-chip" type="button" key={token.id ?? `${token.text}-${index}`}>
          <span>{token.text}</span>
          <span className="token-popover">
            <strong>{token.text}</strong>
            {token.meaning ? <span>{token.meaning}</span> : null}
            {token.explanation ? <span>{token.explanation}</span> : null}
            {token.commonMistakes?.length ? <span>{token.commonMistakes.join("; ")}</span> : null}
            {token.learningItemId ? <span>{token.canonicalKey}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
