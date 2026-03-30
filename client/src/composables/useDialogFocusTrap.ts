/**
 * Keyboard focus management for modal overlays (WCAG 2.x keyboard / focus order).
 *
 * Used by `EntityDialog.vue` (`client/src/components/common/EntityDialog.vue`).
 * Attach a template ref to the element that wraps the dialog content (typically the
 * node with `role="dialog"`). When `open` becomes true, the composable stores the
 * previously focused element, moves focus to the first tabbable control inside the
 * root, registers capture-phase listeners on `document`, and restores focus when the
 * dialog closes or the component unmounts.
 *
 * **Behavior**
 * - **Tab / Shift+Tab:** wraps between first and last focusable descendants.
 * - **Escape:** calls `onEscape` (wire to close the dialog).
 * - **Focus escape:** if focus lands outside the root (e.g. extension), it is moved
 *   back to the first focusable element inside the root.
 *
 * **Focusable selector:** links with `href`, enabled `button` / `input` / `select` /
 * `textarea`, and elements with `tabindex` other than `-1`. Elements inside
 * `[inert]` are skipped.
 */
import {
  nextTick,
  onUnmounted,
  watch,
  type Ref,
} from "vue";

/** Returns focusable, tabbable elements in DOM order within `root`. */
function getFocusableElements(root: HTMLElement): HTMLElement[]
{
  const selector =
    [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex=\"-1\"])",
    ].join(", ");

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) =>
    {
      if (el.tabIndex < 0) return false;
      if (el.hasAttribute("disabled")) return false;
      if (el.closest("[inert]")) return false;
      return true;
    }
  );
}

/**
 * Activates focus trapping while `open` is true.
 *
 * Uses `watch` with `{ immediate: true }` so the closed state is applied on mount
 * and opening/closing is handled consistently. Requires `dialogRef` to point at the
 * dialog root after `nextTick` when `open` is true (e.g. `v-if="open"` on that node).
 *
 * @param open - Whether the dialog is visible; when false, listeners are removed
 *   and focus is restored.
 * @param dialogRef - Template ref to the dialog container (must include all tabbable
 *   controls; typically the `role="dialog"` element).
 * @param onEscape - Invoked on Escape; should close the dialog (e.g. emit `close`).
 */
export function useDialogFocusTrap(
  open: Ref<boolean>,
  dialogRef: Ref<HTMLElement | null>,
  onEscape: () => void
): void
{
  let previousActive: HTMLElement | null = null;

  function onKeydown(event: KeyboardEvent): void
  {
    const root = dialogRef.value;
    if (!root) return;

    if (event.key === "Escape")
    {
      event.preventDefault();
      onEscape();
      return;
    }

    if (event.key !== "Tab") return;

    const focusables = getFocusableElements(root);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (!active || !root.contains(active)) return;

    if (event.shiftKey)
    {
      if (active === first)
      {
        event.preventDefault();
        last.focus();
      }
    }
    else if (active === last)
    {
      event.preventDefault();
      first.focus();
    }
  }

  function onFocusIn(event: FocusEvent): void
  {
    if (!open.value || !dialogRef.value) return;
    const target = event.target as Node | null;
    if (!target || dialogRef.value.contains(target)) return;

    const focusables = getFocusableElements(dialogRef.value);
    if (focusables.length > 0) focusables[0].focus();
  }

  function removeListeners(): void
  {
    document.removeEventListener("keydown", onKeydown, true);
    document.removeEventListener("focusin", onFocusIn, true);
  }

  function restoreFocus(): void
  {
    if (previousActive && typeof previousActive.focus === "function")
    {
      try
      {
        previousActive.focus();
      }
      catch
      {
        /* ignore */
      }
    }
    previousActive = null;
  }

  watch(
    open,
    async (isOpen) =>
    {
      if (isOpen)
      {
        previousActive = document.activeElement as HTMLElement | null;
        await nextTick();
        const root = dialogRef.value;
        if (!root) return;

        const focusables = getFocusableElements(root);
        if (focusables.length > 0) focusables[0].focus();

        document.addEventListener("keydown", onKeydown, true);
        document.addEventListener("focusin", onFocusIn, true);
      }
      else
      {
        removeListeners();
        restoreFocus();
      }
    },
    { flush: "post", immediate: true }
  );

  onUnmounted(() =>
  {
    removeListeners();
    restoreFocus();
  });
}
