import { useEffect, useRef, useState } from "react";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

interface EditableCellProps {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function EditableCell({ value, onCommit, placeholder, className }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (draft !== value) {
      onCommit(draft);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        placeholder={placeholder}
        className={cn("h-8", className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={cn(
        "block w-full min-h-[2rem] rounded px-2 py-1 text-left text-sm hover:bg-muted/50",
        !value && "text-muted-foreground",
        className
      )}
    >
      {value || placeholder || "—"}
    </button>
  );
}
