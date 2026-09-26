// 共用的 Textarea 组件
interface CustomTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    rows?: number;
    disabled?: boolean;
    label?: string;
}

export function CustomTextarea({ value, onChange, placeholder, rows = 3, disabled = false, label = '这期想聊什么' }: CustomTextareaProps) {
    return (
        <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink">{label}</span>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className="ys-field min-h-[128px] resize-y py-3 leading-relaxed"
                disabled={disabled}
            />
        </label>
    );
}
