import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { cn } from "../lib/utils";

interface EditableSelectCellProps {
  value: string;
  options: readonly { value: string; label: string }[];
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function EditableSelectCell({
  value,
  options,
  onCommit,
  placeholder,
  className,
}: EditableSelectCellProps) {
  const [editing, setEditing] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  if (editing) {
    return (
      <Select
        value={value}
        onValueChange={(next) => {
          onCommit(next);
          setEditing(false);
        }}
        onOpenChange={(open) => {
          if (!open) setEditing(false);
        }}
        defaultOpen
      >
        <SelectTrigger className={cn("h-8", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "block w-full min-h-[2rem] rounded px-2 py-1 text-left text-sm hover:bg-muted/50",
        !value && "text-muted-foreground",
        className
      )}
    >
      {selectedLabel || placeholder || "—"}
    </button>
  );
}
