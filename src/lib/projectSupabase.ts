import { migratePersistableProjectSlice, type PersistableProjectSlice } from "@/lib/projectPersistence";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { SAMPLE_PROJECT_ID } from "@/lib/sampleProject";

export type RemoteProjectRecord = {
  id: string;
  updatedAt: string;
  isSample?: boolean;
  slice: PersistableProjectSlice;
};

type ProjectRow = {
  id: string;
  name: string;
  file_label: string | null;
  is_sample: boolean | null;
  slice: unknown;
  updated_at: string;
  deleted_at?: string | null;
};

function remoteEnabled(): boolean {
  return supabaseConfigured && supabase !== null;
}

function rowToRecord(row: ProjectRow): RemoteProjectRecord | null {
  if (row.deleted_at) return null;
  try {
    const slice = migratePersistableProjectSlice(row.slice as PersistableProjectSlice);
    return {
      id: row.id,
      updatedAt: row.updated_at,
      ...(row.is_sample ? { isSample: true } : {}),
      slice,
    };
  } catch (e: unknown) {
    console.warn("Could not parse remote project row", e);
    return null;
  }
}

export async function getRemoteProjectRecords(): Promise<RemoteProjectRecord[]> {
  if (!remoteEnabled()) return [];
  const { data, error } = await supabase!
    .from("projects")
    .select("id,name,file_label,is_sample,slice,updated_at,deleted_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ProjectRow[])
    .map(rowToRecord)
    .filter((x): x is RemoteProjectRecord => x !== null);
}

export async function getRemoteProjectRecord(id: string): Promise<RemoteProjectRecord | null> {
  if (!remoteEnabled()) return null;
  const { data, error } = await supabase!
    .from("projects")
    .select("id,name,file_label,is_sample,slice,updated_at,deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToRecord(data as ProjectRow) : null;
}

export async function upsertRemoteProjectRecord(record: RemoteProjectRecord): Promise<void> {
  if (!remoteEnabled() || record.id === SAMPLE_PROJECT_ID) return;
  const project = record.slice.project;
  const { error } = await supabase!.from("projects").upsert({
    id: record.id,
    name: project.name?.trim() || "Untitled",
    file_label: project.fileLabel ?? null,
    is_sample: !!record.isSample,
    slice: record.slice,
    updated_at: record.updatedAt,
    deleted_at: null,
  });
  if (error) throw error;
}

export async function deleteRemoteProjectRecord(id: string): Promise<void> {
  if (!remoteEnabled() || id === SAMPLE_PROJECT_ID) return;
  const { error } = await supabase!.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeToRemoteProject(
  id: string,
  onRecord: (record: RemoteProjectRecord | null) => void,
): () => void {
  if (!remoteEnabled()) return () => {};
  const channel = supabase!
    .channel(`project:${id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "projects",
        filter: `id=eq.${id}`,
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          onRecord(null);
          return;
        }
        onRecord(rowToRecord(payload.new as ProjectRow));
      },
    )
    .subscribe();
  return () => {
    void supabase!.removeChannel(channel);
  };
}
