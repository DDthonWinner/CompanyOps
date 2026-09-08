import { useEffect, useState } from "react";
import { api } from "../../api/client";
export type HiringProfile = Awaited<ReturnType<typeof api.listAgentProfiles>>[number];
export function useHiringProfiles() {
  const [profiles, setProfiles] = useState<HiringProfile[]>([]);
  useEffect(() => {
    let cancelled = false;
    api.listAgentProfiles().then((items) => {
      if (!cancelled && Array.isArray(items)) setProfiles(items.filter((item) => item.isActive));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return profiles;
}
