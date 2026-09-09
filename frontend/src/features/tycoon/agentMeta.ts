// Cached fetch of agent profiles + LLM models (master data) for the hire dialog
// and the agent profile panel. Fetched once per session.
import { useEffect, useState } from "react";
import { api } from "../../api/client";

export interface ProfileMeta {
  id: string;
  name: string;
  role: { code: string; name: string } | null;
  skillLevel: string;
  defaultLlmModel?: { id: string; displayName: string };
  defaultColor?: string;
  defaultIconKey?: string;
  isActive: boolean;
}
export interface ModelMeta {
  id: string;
  displayName: string;
  grade: string;
  isActive: boolean;
}
export interface AgentMeta {
  profiles: ProfileMeta[];
  models: ModelMeta[];
}

let cache: AgentMeta | null = null;
let inflight: Promise<AgentMeta> | null = null;

function load(): Promise<AgentMeta> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = Promise.all([api.listAgentProfiles(), api.listLlmModels()]).then(([profiles, models]) => {
      cache = { profiles: profiles as ProfileMeta[], models: models as ModelMeta[] };
      return cache;
    });
  }
  return inflight;
}

export function useAgentMeta(): AgentMeta | null {
  const [meta, setMeta] = useState<AgentMeta | null>(cache);
  useEffect(() => {
    let alive = true;
    load().then((m) => alive && setMeta(m)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return meta;
}
