import type { RefObject } from "react";
import { useEffect } from "react";

/** Closes open menus on a click outside them or on Escape. */
export function useCloseMenusOnOutsideClick(
  anyOpen: boolean,
  menus: { ref: RefObject<HTMLElement | null>; close: () => void }[],
) {
  useEffect(() => {
    if (!anyOpen) {
      return;
    }

    const closeMenusOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;

      for (const menu of menus) {
        if (!target || !menu.ref.current?.contains(target)) {
          menu.close();
        }
      }
    };

    const closeMenusOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      for (const menu of menus) {
        menu.close();
      }
    };

    document.addEventListener("pointerdown", closeMenusOnOutsidePointerDown);
    document.addEventListener("keydown", closeMenusOnEscape);
    return () => {
      document.removeEventListener(
        "pointerdown",
        closeMenusOnOutsidePointerDown,
      );
      document.removeEventListener("keydown", closeMenusOnEscape);
    };
  }, [anyOpen]);
}
