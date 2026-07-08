import { Volume2 } from "lucide-react";
import { Tooltip } from "./Tooltip";
import { useSpeechPlayback } from "@/lib/speech";

interface AudioButtonProps {
  sentence: string;
  language: string;
  label?: string;
  compact?: boolean;
}

export function AudioButton({
  sentence,
  language,
  label = "Play sentence aloud",
  compact = false
}: AudioButtonProps) {
  const audio = useSpeechPlayback(sentence, language);
  const className = compact ? "button secondary icon-only" : "button secondary";

  return (
    <Tooltip content={audio.supported ? "Play. Double-click for slow speech." : "Speech is not supported on this device."}>
      <button
        type="button"
        className={className}
        onClick={audio.onClick}
        onDoubleClick={audio.onDoubleClick}
        aria-label={audio.supported ? label : "Speech is not supported on this device"}
        disabled={!audio.supported}
      >
        <Volume2 size={18} />
      </button>
    </Tooltip>
  );
}
