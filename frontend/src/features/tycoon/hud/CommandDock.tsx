import { GlassPanel } from "../../../components/ui/GlassPanel";
import { DESK_ROLES, ROLE_LABEL, roleColor } from "../../../lib/roles";
import { useStore } from "../../../store/useStore";

// Department navigation (05 §3.2.3). MVP: focus a department by opening its desk sheet.
// (Live camera tween is a future enhancement.)
export function CommandDock() {
  const openDeskSheet = useStore((s) => s.openDeskSheet);
  const setCamera = useStore((s) => s.setCamera);
  return (
    <GlassPanel
      level={3}
      className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 px-3 py-2"
      data-testid="command-dock"
    >
      <button
        className="rounded-full px-3 py-1 text-sm hover:bg-surface-high"
        onClick={() => setCamera(undefined)}
      >
        Center
      </button>
      {DESK_ROLES.map((code) => (
        <button
          key={code}
          data-testid={`dock-${code}`}
          onClick={() => {
            setCamera(code);
            openDeskSheet(code);
          }}
          className="rounded-full px-3 py-1 text-sm hover:bg-surface-high"
          style={{ color: roleColor(code) }}
        >
          {ROLE_LABEL[code]}
        </button>
      ))}
    </GlassPanel>
  );
}
