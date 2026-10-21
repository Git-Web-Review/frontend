import type { MouseEvent } from "react";

/** Mousedown handler for a `.modal` wrapper: closes it when the press lands on
 * the backdrop around the dialog. Mousedown (not click) so a text selection
 * dragged out of the dialog does not close it. */
export function closeOnBackdrop(close: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) {
      close();
    }
  };
}
