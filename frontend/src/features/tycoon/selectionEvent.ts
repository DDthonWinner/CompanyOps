// Scene → DOM selection (06 §6). CustomEvent only; never writes server state.
import type { TycoonSelection } from "../../api/types";

export const SELECTION_EVENT = "tycoon-item-selected";

export function dispatchSelection(detail: TycoonSelection): void {
  window.dispatchEvent(new CustomEvent(detail && SELECTION_EVENT, { detail }));
}
