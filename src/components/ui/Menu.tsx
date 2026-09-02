"use client";

import type { ReactElement } from "react";
import { Menu as Base } from "@base-ui-components/react/menu";
import { clsx } from "clsx";

export interface MenuOption<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface MenuProps<V extends string> {
  /** Rendered as the trigger itself (base-ui `render`), so callers pass their own <button>. */
  trigger: ReactElement<Record<string, unknown>>;
  options: ReadonlyArray<MenuOption<V>>;
  onSelect: (value: V) => void;
}

/** Dropdown menu (scenario picker). Items commit on press, no keyboard motion beyond focus. */
export function Menu<V extends string>({ trigger, options, onSelect }: MenuProps<V>) {
  return (
    <Base.Root>
      <Base.Trigger render={trigger} />
      <Base.Portal>
        <Base.Positioner side="bottom" align="start" sideOffset={6}>
          <Base.Popup
            className={clsx(
              "material-thick min-w-40 p-1 text-sm text-ink",
              "transition-[opacity,transform] duration-150",
              "data-[starting-style]:scale-96 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-96 data-[ending-style]:opacity-0",
            )}
          >
            {options.map((opt) => (
              <Base.Item
                key={opt.value}
                disabled={opt.disabled}
                className="cursor-pointer rounded-xs px-2.5 py-1.5 outline-none data-[highlighted]:bg-surface-thin data-[disabled]:opacity-40"
                onClick={() => onSelect(opt.value)}
              >
                {opt.label}
              </Base.Item>
            ))}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
