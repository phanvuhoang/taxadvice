import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";

interface StyleReferencesProps {
  value: string[];
  onChange: (urls: string[]) => void;
}

export function StyleReferences({ value, onChange }: StyleReferencesProps) {
  const [inputVal, setInputVal] = useState("");

  const handleAdd = () => {
    const trimmed = inputVal.trim();
    if (!trimmed || value.length >= 5) return;
    if (!value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputVal("");
  };

  const handleRemove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Bài viết mẫu tham khảo (tùy chọn, tối đa 5)</Label>
      <div className="flex gap-2">
        <Input
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập URL bài viết mẫu..."
          className="text-sm flex-1"
          disabled={value.length >= 5}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!inputVal.trim() || value.length >= 5}
        >
          <Plus size={14} className="mr-1" /> Thêm
        </Button>
      </div>
      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((url, idx) => (
            <div key={idx} className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded-md text-xs">
              <span className="flex-1 truncate text-muted-foreground">{url}</span>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
