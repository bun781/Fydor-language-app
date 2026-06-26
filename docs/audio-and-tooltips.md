# Audio and Tooltips

## Speech abstraction

Sentence playback now goes through `lib/speech/speechService.ts`.

- `SpeechService` owns the provider boundary and language selection.
- `createSpeechProvider()` returns the browser `speechSynthesis` provider when available.
- `useSpeechPlayback()` adds the click vs double-click timing so slow speech does not duplicate TTS logic.
- Speech call sites use `lib/speech/useSpeechService.ts` or `lib/speech/useSpeechPlayback.ts` directly.

## Tooltip usage

Use `components/ui/Tooltip.tsx` for short helper text on hover or focus.

- Wrap the trigger element in `<Tooltip content="...">`.
- Keep the message short and action-oriented.
- Prefer concise copy for icon buttons, review actions, and sentence chips.

## Accessibility

- Tooltips are exposed with `role="tooltip"` and `aria-describedby`.
- Hover and keyboard focus both reveal the helper text.
- The audio button delays single-click playback so double-click can safely switch to slow speech.
- The speech button remains a real button, so keyboard activation still works naturally.
