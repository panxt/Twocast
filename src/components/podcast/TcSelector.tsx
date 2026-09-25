'use client'
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
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

    // 监听点击外部区域时关闭下拉菜单
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        // 只在下拉菜单打开时添加监听器
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        // 清理函数
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
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
    const optionClass = 'block w-full px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 relative z-10';

    return (
        <div className="relative flex-shrink-0" ref={containerRef}>
          <button type="button"
              onClick={() => setIsOpen(!isOpen)}
            aria-label={title}
            aria-expanded={isOpen}
            className="relative flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-800 sm:min-w-[120px]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none rounded-lg sm:rounded-xl"></div>
            <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 relative z-10">{options.find(option => option.id === value)?.label}</span>
            <ChevronDownIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 ml-auto relative z-10" />
          </button>
          
          {isOpen && (
            <div 
              className="absolute left-0 right-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 sm:right-auto sm:min-w-48"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-lg sm:rounded-xl"></div>
              
              {/* Title section */}
              {title && (
                <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-gray-100/90 to-gray-200/90 dark:from-gray-800/90 dark:to-gray-700/90 border-b border-gray-200/50 dark:border-gray-600/50 text-center">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100 tracking-wide">{title}</h3>
                </div>
              )}

              {/* Search input */}
              <div className="relative px-3 sm:px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索选项…"
                    className="w-full px-8 py-1.5 text-xs sm:text-sm bg-white/50 dark:bg-gray-800/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 border border-gray-100/50 dark:border-gray-700/50"
                  />
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Options list with max height and scroll */}
              <div className="max-h-[300px] overflow-y-auto">
                {filteredOptions.length > 0 ? (
                  visibleOptions.map((option) => {
                    const choose = () => {
                        onChange(option.id);
                        setIsOpen(false);
                        setSearchQuery("");
                    };
                    return option.render ? <div key={option.id} role="button" tabIndex={0}
                      aria-label={`选择${option.label}`} className={optionClass} onClick={choose}
                      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(); } }}>
                      {option.render(option)}
                    </div> : <button key={option.id} type="button" onClick={choose} className={optionClass}>
                      <span className="font-medium text-gray-800 dark:text-gray-100">{option.label}</span>
                      {option.description && <span className="mt-0.5 block whitespace-normal text-xs text-gray-500 dark:text-gray-400">{option.description}</span>}
                    </button>;
                  })
                ) : (
                  <div className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center">
                    没有匹配选项
                  </div>
                )}
              </div>
              {filteredOptions.length > maxVisible && <p className="border-t px-3 py-2 text-center text-xs text-gray-500 dark:border-gray-700">
                显示 {maxVisible} / {filteredOptions.length} 项，搜索可找到更多
              </p>}
            </div>
          )}
        </div>
    )
}
