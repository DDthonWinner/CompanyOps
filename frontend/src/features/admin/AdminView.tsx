// Dev Admin: browse & edit every DB table. Local/contest tool — no auth, full write access.
import { useEffect, useMemo, useState } from "react";
import { api, type AdminColumn, type AdminRowsResponse, type AdminTable } from "../../api/client";
import { ApiError } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { pushToast } from "../../components/ui/toast";
import { CATEGORIES, metaFor } from "./tableMeta";

const PAGE = 50;

// Turn a stored cell value into text for an <input>.
function toText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Coerce edited text back to a value the API expects, using the column + original value as hints.
function coerce(raw: string, col: AdminColumn, original: unknown): unknown {
  const t = raw.trim();
  if (t === "" && col.nullable) return null;
  // JSON columns are stored as TEXT, so detect them from the original shape or bracket syntax.
  const looksJson = typeof original === "object" && original !== null;
  if (looksJson || t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch {
      return raw; // leave as-is; backend will reject if truly invalid
    }
  }
  if (/INT/i.test(col.type) && t !== "") {
    const n = Number(t);
    if (!Number.isNaN(n)) return n;
  }
  return raw;
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? `${e.code}: ${e.message}` : String(e);
}

export function AdminView() {
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<AdminRowsResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  // Per-row edit drafts: pk value -> { column: rawText }
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  // New-row draft (column -> rawText), null when the add form is closed.
  const [newRow, setNewRow] = useState<Record<string, string> | null>(null);

  const loadTables = () =>
    api.adminListTables().then((r) => setTables(r.tables)).catch((e) => pushToast(errMsg(e), "error"));

  useEffect(() => {
    loadTables();
  }, []);

  const loadRows = (table: string, off: number) => {
    setLoading(true);
    api
      .adminGetRows(table, PAGE, off)
      .then((r) => {
        setData(r);
        setDrafts({});
        setNewRow(null);
      })
      .catch((e) => pushToast(errMsg(e), "error"))
      .finally(() => setLoading(false));
  };

  const openTable = (name: string) => {
    setSelected(name);
    setOffset(0);
    loadRows(name, 0);
  };

  const pk = data?.primaryKey?.[0];
  const pkOf = (row: Record<string, unknown>) => (pk ? String(row[pk]) : "");

  const setCell = (rowPk: string, col: string, value: string) =>
    setDrafts((d) => ({ ...d, [rowPk]: { ...(d[rowPk] ?? {}), [col]: value } }));

  const saveRow = async (row: Record<string, unknown>) => {
    if (!selected || !pk) return;
    const rowPk = pkOf(row);
    const edits = drafts[rowPk];
    if (!edits || !data) return;
    const patch: Record<string, unknown> = {};
    for (const [col, raw] of Object.entries(edits)) {
      const meta = data.columns.find((c) => c.name === col)!;
      patch[col] = coerce(raw, meta, row[col]);
    }
    try {
      await api.adminUpdateRow(selected, rowPk, patch);
      pushToast("행을 수정했습니다.", "success");
      loadRows(selected, offset);
    } catch (e) {
      pushToast(errMsg(e), "error");
    }
  };

  const deleteRow = async (row: Record<string, unknown>) => {
    if (!selected || !pk) return;
    const rowPk = pkOf(row);
    if (!confirm(`정말 삭제할까요?\n${selected} · ${pk}=${rowPk}`)) return;
    try {
      await api.adminDeleteRow(selected, rowPk);
      pushToast("행을 삭제했습니다.", "success");
      loadRows(selected, offset);
      loadTables();
    } catch (e) {
      pushToast(errMsg(e), "error");
    }
  };

  const saveNewRow = async () => {
    if (!selected || !newRow || !data) return;
    const body: Record<string, unknown> = {};
    for (const [col, raw] of Object.entries(newRow)) {
      if (raw.trim() === "") continue; // let DB defaults fill the rest
      const meta = data.columns.find((c) => c.name === col)!;
      body[col] = coerce(raw, meta, null);
    }
    try {
      await api.adminCreateRow(selected, body);
      pushToast("행을 추가했습니다.", "success");
      loadRows(selected, offset);
      loadTables();
    } catch (e) {
      pushToast(errMsg(e), "error");
    }
  };

  // Group tables by category (with a trailing "기타" for anything uncategorized),
  // filtering by raw name OR Korean label.
  const groups = useMemo(() => {
    const byName = new Map(tables.map((t) => [t.name, t]));
    const q = filter.toLowerCase();
    const match = (name: string) =>
      name.toLowerCase().includes(q) || metaFor(name).label.toLowerCase().includes(q);

    const categorized = new Set(CATEGORIES.flatMap((c) => c.tables));
    const result = CATEGORIES.map((c) => ({
      label: c.label,
      icon: c.icon,
      tables: c.tables.map((n) => byName.get(n)).filter((t): t is AdminTable => !!t && match(t.name)),
    })).filter((g) => g.tables.length > 0);

    const others = tables.filter((t) => !categorized.has(t.name) && match(t.name));
    if (others.length) result.push({ label: "기타", icon: "📦", tables: others });
    return result;
  }, [tables, filter]);

  return (
    <div className="mx-auto flex h-full w-[min(1400px,96vw)] gap-3 px-2 pb-4">
      {/* Left: table list */}
      <GlassPanel level={2} className="flex w-64 shrink-0 flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="display text-sm font-semibold">테이블 ({tables.length})</h2>
          <button className="text-xs text-on-background/50 hover:text-primary" onClick={loadTables}>
            ↻
          </button>
        </div>
        <input
          placeholder="테이블 검색…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mb-2 rounded-lg border border-outline-variant bg-surface-lowest px-2 py-1 text-xs"
        />
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-on-background/40">
                {g.icon} {g.label}
              </div>
              <div className="space-y-0.5">
                {g.tables.map((t) => {
                  const m = metaFor(t.name);
                  return (
                    <button
                      key={t.name}
                      onClick={() => openTable(t.name)}
                      title={`${t.name} — ${m.desc}`}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                        selected === t.name ? "bg-primary/15 text-primary" : "hover:bg-surface-high"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{m.label}</span>
                        <span className="block truncate text-[10px] text-on-background/40">{t.name}</span>
                      </span>
                      <span className="tabular shrink-0 rounded-full bg-surface px-1.5 text-[10px] text-on-background/50">
                        {t.rowCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Right: data grid */}
      <GlassPanel level={2} className="flex min-w-0 flex-1 flex-col p-3">
        {!selected && (
          <div className="flex h-full items-center justify-center text-sm text-on-background/50">
            왼쪽에서 테이블을 선택하세요.
          </div>
        )}

        {selected && data && (
          <>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <h2 className="display text-sm font-semibold">{metaFor(selected).label}</h2>
                  <span className="font-mono text-[11px] text-on-background/40">{selected}</span>
                  <span className="text-xs text-on-background/50">
                    · 총 {data.total}행 · PK: {data.primaryKey.join(", ") || "없음"}
                  </span>
                </div>
                {metaFor(selected).desc && (
                  <div className="truncate text-[11px] text-on-background/55">{metaFor(selected).desc}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setNewRow(newRow ? null : Object.fromEntries(data.columns.map((c) => [c.name, ""])))
                  }
                >
                  {newRow ? "취소" : "+ 새 행"}
                </Button>
                <button
                  className="rounded-full px-2 text-sm disabled:opacity-30"
                  disabled={offset === 0}
                  onClick={() => {
                    const o = Math.max(0, offset - PAGE);
                    setOffset(o);
                    loadRows(selected, o);
                  }}
                >
                  ←
                </button>
                <span className="tabular text-xs text-on-background/60">
                  {data.total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE, data.total)}
                </span>
                <button
                  className="rounded-full px-2 text-sm disabled:opacity-30"
                  disabled={offset + PAGE >= data.total}
                  onClick={() => {
                    const o = offset + PAGE;
                    setOffset(o);
                    loadRows(selected, o);
                  }}
                >
                  →
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-outline-variant">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-surface-high">
                  <tr>
                    <th className="border-b border-outline-variant px-2 py-1.5 text-left font-semibold">작업</th>
                    {data.columns.map((c) => (
                      <th
                        key={c.name}
                        className="whitespace-nowrap border-b border-outline-variant px-2 py-1.5 text-left font-semibold"
                        title={`${c.type}${c.foreignKey ? ` → ${c.foreignKey}` : ""}`}
                      >
                        {c.name}
                        {c.primaryKey && <span className="ml-1 text-amber-500">🔑</span>}
                        {c.foreignKey && <span className="ml-1 text-sky-500">↗</span>}
                        {!c.nullable && !c.primaryKey && <span className="ml-0.5 text-rose-400">*</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* New-row input line */}
                  {newRow && (
                    <tr className="bg-primary/5">
                      <td className="border-b border-outline-variant px-2 py-1">
                        <button className="text-xs font-medium text-primary hover:underline" onClick={saveNewRow}>
                          추가
                        </button>
                      </td>
                      {data.columns.map((c) => (
                        <td key={c.name} className="border-b border-outline-variant px-1 py-1">
                          <input
                            value={newRow[c.name]}
                            placeholder={c.hasDefault ? "(자동)" : c.nullable ? "null" : ""}
                            onChange={(e) => setNewRow({ ...newRow, [c.name]: e.target.value })}
                            className="w-full min-w-[80px] rounded border border-outline-variant bg-surface-lowest px-1.5 py-0.5"
                          />
                        </td>
                      ))}
                    </tr>
                  )}

                  {data.rows.map((row) => {
                    const rowPk = pkOf(row);
                    const dirty = !!drafts[rowPk] && Object.keys(drafts[rowPk]).length > 0;
                    return (
                      <tr key={rowPk} className="hover:bg-surface-high/50">
                        <td className="whitespace-nowrap border-b border-outline-variant px-2 py-1">
                          <button
                            className="mr-2 text-xs font-medium text-primary disabled:opacity-30"
                            disabled={!dirty}
                            onClick={() => saveRow(row)}
                          >
                            저장
                          </button>
                          <button
                            className="text-xs text-rose-500 hover:underline"
                            onClick={() => deleteRow(row)}
                          >
                            삭제
                          </button>
                        </td>
                        {data.columns.map((c) => {
                          const draft = drafts[rowPk]?.[c.name];
                          const value = draft !== undefined ? draft : toText(row[c.name]);
                          return (
                            <td key={c.name} className="border-b border-outline-variant px-1 py-1">
                              <input
                                value={value}
                                readOnly={c.primaryKey}
                                onChange={(e) => setCell(rowPk, c.name, e.target.value)}
                                className={`w-full min-w-[80px] rounded border px-1.5 py-0.5 ${
                                  c.primaryKey
                                    ? "border-transparent bg-transparent text-on-background/50"
                                    : draft !== undefined
                                      ? "border-primary bg-primary/5"
                                      : "border-outline-variant bg-surface-lowest"
                                }`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {loading && <div className="p-4 text-center text-xs text-on-background/50">불러오는 중…</div>}
              {!loading && data.rows.length === 0 && (
                <div className="p-4 text-center text-xs text-on-background/50">행이 없습니다.</div>
              )}
            </div>
          </>
        )}
      </GlassPanel>
    </div>
  );
}
