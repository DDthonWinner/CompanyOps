import { useStore } from "../../store/useStore";

export function openProjectCreationGate(): void {
  const { setActiveProject, setActiveTab } = useStore.getState();
  setActiveProject(null);
  setActiveTab("tycoon");
}
