'use client'
import { ChevronDown, Search } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export interface OptionItem {
  id: string;
  label: string;
  description?: string;
  icon: string;
  render?: (option: OptionItem) => React.ReactNode;
}

export function TcSelector({value, onChange, options, title}: {title?: string, value: string, onChange: (value: string) => void, options: OptionItem[]}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // 打开后把光标放进搜索框（等价于 autoFocus，但只在用户主动打开时发生）
    useEffect(() => {
        if (isOpen) searchRef.current?.focus();
    }, [isOpen]);

    // 监听点击外部区域时关闭下拉菜单
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') setIsOpen(false);
        }

        // 只在下拉菜单打开时添加监听器
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        // 清理函数
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    // Filter options based on search query
    const filteredOptions = options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (option.description && option.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const maxVisible = 50;
    const selectedOption = filteredOptions.find(option => option.id === value);
    const visibleOptions = filteredOptions.slice(0, maxVisible);
    if (selectedOption && !visibleOptions.some(option => option.id === value)) {
      visibleOptions.pop();
      visibleOptions.unshift(selectedOption);
    }
    const optionClass = (active: boolean) =>
      `block w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-paper ${active ? 'bg-brand-tint text-brand' : 'text-ink'}`;

    const selectedLabel = options.find(option => option.id === value)?.label || '请选择';

    return (
        <div className="relative min-w-0" ref={containerRef}>
          {title && <span className="ys-label mb-1.5">{title}</span>}
          <button type="button"
              onClick={() => setIsOpen(!isOpen)}
            aria-label={title ? `${title}：${selectedLabel}` : selectedLabel}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            className={`ys-field flex items-center gap-2 text-left ${isOpen ? 'border-brand ring-2 ring-focus' : ''}`}
          >
            <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>

          {isOpen && (
            <div role="listbox" aria-label={title}
              className="ys-sheet absolute left-0 right-0 top-full z-50 mt-1.5 min-w-full overflow-hidden shadow-bar sm:right-auto sm:min-w-56"
            >
              {/* Search input */}
              <div className="border-b border-rule p-2">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                  <input
                    type="text"
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={title ? `搜索${title}` : '搜索'}
                    aria-label={title ? `搜索${title}` : '搜索选项'}
                    className="ys-field-sm pl-8"
                  />
                </label>
              </div>

              {/* Options list with max height and scroll */}
              <div className="max-h-[300px] overflow-y-auto py-1">
                {filteredOptions.length > 0 ? (
                  visibleOptions.map((option) => {
                    const choose = () => {
                        onChange(option.id);
                        setIsOpen(false);
                        setSearchQuery("");
                    };
                    const active = option.id === value;
                    return option.render ? <div key={option.id} role="option" aria-selected={active} tabIndex={0}
                      aria-label={`选择${option.label}`} className={optionClass(active)} onClick={choose}
                      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(); } }}>
                      {option.render(option)}
                    </div> : <button key={option.id} type="button" role="option" aria-selected={active} onClick={choose} className={optionClass(active)}>
                      <span className="font-medium">{option.label}</span>
                      {option.description && <span className="mt-0.5 block whitespace-normal text-xs text-ink-soft">{option.description}</span>}
                    </button>;
                  })
                ) : (
                  <div className="px-3 py-4 text-center text-sm text-ink-soft">
                    没有匹配的选项
                  </div>
                )}
              </div>
              {filteredOptions.length > maxVisible && <p className="border-t border-rule px-3 py-2 text-center text-xs text-ink-soft">
                显示 {maxVisible} / {filteredOptions.length} 项，搜索可找到更多
              </p>}
            </div>
          )}
        </div>
    )
}
