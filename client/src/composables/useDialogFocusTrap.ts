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

/** Matches likely tab stops; filtered further by `isTabbableInPractice`. */
const TAB_CANDIDATE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(", ");

function isTabbableInPractice(el: HTMLElement): boolean
{
  if (el.tabIndex < 0) return false;
  if (el.hasAttribute("disabled")) return false;
  if (el.closest("[inert]")) return false;
  return true;
}

/** Tabbable descendants of `root`, in DOM order. */
function listTabbableInRoot(root: HTMLElement): HTMLElement[]
{
  return Array.from(root.querySelectorAll<HTMLElement>(TAB_CANDIDATE_SELECTOR)).filter(
    isTabbableInPractice
  );
}

function focusFirstTabbable(root: HTMLElement): void
{
  const tabbable = listTabbableInRoot(root);
  if (tabbable.length > 0) tabbable[0].focus();
}

/**
 * When focus is inside `root`, Tab from the last (or Shift+Tab from the first)
 * tabbable wraps to the other end.
 */
function wrapTabCycleIfNeeded(
  event: KeyboardEvent,
  root: HTMLElement,
  tabbable: HTMLElement[]
): void
{
  if (tabbable.length === 0) return;

  const first = tabbable[0];
  const last = tabbable[tabbable.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (!active || !root.contains(active)) return;

  if (event.shiftKey)
  {
    if (active === first)
    {
      event.preventDefault();
      last.focus();
    }
    return;
  }

  if (active === last)
  {
    event.preventDefault();
    first.focus();
  }
}

function focusElementIfPossible(el: HTMLElement | null): void
{
  if (!el || typeof el.focus !== "function") return;
  try
  {
    el.focus();
  }
  catch
  {
    /* detached or not focusable */
  }
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
export function useDialogFocusTrap(open: Ref<boolean>, dialogRef: Ref<HTMLElement | null>, onEscape: () => void): void
{
  let previousActive: HTMLElement | null = null;

  function onDocumentKeydown(event: KeyboardEvent): void
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
    wrapTabCycleIfNeeded(event, root, listTabbableInRoot(root));
  }

  function onDocumentFocusIn(event: FocusEvent): void
  {
    if (!open.value || !dialogRef.value) return;

    const target = event.target as Node | null;
    if (!target || dialogRef.value.contains(target)) return;

    focusFirstTabbable(dialogRef.value);
  }

  function removeDocumentListeners(): void
  {
    // Same capture flag as in `installTrap` — required for `removeEventListener` to match.
    document.removeEventListener("keydown", onDocumentKeydown, true);
    document.removeEventListener("focusin", onDocumentFocusIn, true);
  }

  function restorePreviousFocus(): void
  {
    focusElementIfPossible(previousActive);
    previousActive = null;
  }

  async function installTrap(): Promise<void>
  {
    previousActive = document.activeElement as HTMLElement | null;
    await nextTick();

    const root = dialogRef.value;
    if (!root) return;

    focusFirstTabbable(root);
    // Capture phase: Tab/Escape run before the focused element’s default handling.
    document.addEventListener("keydown", onDocumentKeydown, true);
    // Capture phase: if focus lands outside the dialog (e.g. extension), pull it back in.
    document.addEventListener("focusin", onDocumentFocusIn, true);
  }

  function uninstallTrap(): void
  {
    removeDocumentListeners();
    restorePreviousFocus();
  }

  watch(
    open,
    async (isOpen) =>
    {
      if (isOpen) await installTrap();
      else uninstallTrap();
    },
    { flush: "post", immediate: true }
  );

  onUnmounted(() =>
  {
    removeDocumentListeners();
    restorePreviousFocus();
  });
}
