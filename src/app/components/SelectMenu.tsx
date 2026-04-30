"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
};

type Placement = "top" | "bottom";
type Align = "left" | "right";

export default function SelectMenu({
  value,
  options,
  onChange,
  placeholder = "Выбрать",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  align = "left",
  placement = "bottom",
}: {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: Align;
  placement?: Placement;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [menuPos, setMenuPos] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const updateMenuPosition = useCallback(() => {
    const btn = buttonRef.current;
    const menu = menuRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 0;
    const gap = 8;
    const width = rect.width;

    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

    let top =
      placement === "top"
        ? rect.top - menuHeight - gap
        : rect.bottom + gap;

    if (placement === "top" && top < 8) {
      top = rect.bottom + gap;
    }

    if (placement === "bottom" && top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - gap);
    }

    setMenuPos({
      top,
      left,
      width,
    });
  }, [align, placement]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();

    const onResize = () => updateMenuPosition();
    const onScroll = () => updateMenuPosition();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    if (open) {
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-left text-white outline-none transition hover:bg-white/12 ${buttonClassName}`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-300 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {typeof document !== "undefined" &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
            className={`z-[9999] overflow-hidden rounded-2xl border border-white/12 bg-[#0f0f19]/95 shadow-2xl backdrop-blur-xl ${menuClassName}`}
          >
            <div className="custom-dropdown-scroll max-h-72 overflow-auto p-2">
              {options.map((option) => {
                const active = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-white/12 text-white"
                        : "text-gray-200 hover:bg-white/8"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {active && <Check className="h-4 w-4 shrink-0 text-purple-300" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}