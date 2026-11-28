import React from 'react';
import { FolderOpen, Plus, Save, Trash2, X } from 'lucide-react';
import type { SavedProjectSummary } from '../types/studio';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: SavedProjectSummary[];
  currentProjectId: string;
  onLoadProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onSaveAsNew: () => void;
  onNewBlankProject: () => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  currentProjectId,
  onLoadProject,
  onDeleteProject,
  onSaveAsNew,
  onNewBlankProject,
}) => {
  if (!isOpen) return null;

  const formatDate = (ts: number) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(ts));
    } catch {
      return 'Saved';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#141720] border border-white/12 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#101218]">
          <div>
            <h2 className="text-base font-bold text-white font-display">Saved Studio Projects</h2>
            <p className="text-xs text-slate-400">
              Full multi-track audio stems, video takes, and FX settings saved in browser storage
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onSaveAsNew}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#F14624] hover:bg-[#ff5633] text-white transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Copy As New Project</span>
            </button>
            <button
              type="button"
              onClick={onNewBlankProject}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1B202C] hover:bg-[#252B3B] text-slate-200 border border-white/10 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Session</span>
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-white/6 border border-white/8 rounded-xl bg-[#0D0F15]">
            {projects.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No saved projects yet. Click Save in the top toolbar to store your current session.
              </div>
            ) : (
              projects.map((p) => {
                const isCurrent = p.id === currentProjectId;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#141822] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{p.title}</span>
                        {isCurrent && (
                          <span className="text-[11px] font-medium text-emerald-400">Active</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                        {p.trackCount} tracks · {p.bpm} BPM · Key {p.musicalKey} ·{' '}
                        {formatDate(p.updatedAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onLoadProject(p.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#1B202C] hover:bg-[#262E40] text-slate-100 border border-white/10 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                        <span>Open</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(p.id)}
                        title="Delete saved project"
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-white/8 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
