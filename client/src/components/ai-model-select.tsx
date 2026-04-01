import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AIModelSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function AIModelSelect({ value, onChange }: AIModelSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]" data-testid="select-ai-model">
        <SelectValue placeholder="Chọn AI Model" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="deepseek">DeepSeek Reasoner</SelectItem>
        <SelectItem value="anthropic">Anthropic Haiku 4.5</SelectItem>
      </SelectContent>
    </Select>
  );
}
