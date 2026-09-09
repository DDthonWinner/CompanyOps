import { useStore } from "../../store/useStore";

// "새 프로젝트": jump straight into the creation flow (nameplate step), not the village overview.
export function openProjectCreationGate(): void {
  useStore.getState().requestGate("create");
}

// Home button: return to the project village overview.
export function openProjectVillage(): void {
  useStore.getState().requestGate("village");
}
