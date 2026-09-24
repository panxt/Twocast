// 共用的 Textarea 组件
interface CustomTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    rows?: number;
    disabled?: boolean;
}

export function CustomTextarea({ value, onChange, placeholder, rows = 3, disabled = false }: CustomTextareaProps) {
    return (
        <div className="relative">
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className="min-h-[100px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                disabled={disabled}
            />
            {/* 光泽效果覆盖层 */}
            <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
        </div>
    );
}
