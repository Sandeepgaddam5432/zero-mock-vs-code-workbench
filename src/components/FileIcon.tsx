import { fileIcon } from "@/lib/fileIcons";
import { Codicon } from "./Codicon";

export function FileIcon({ name, size = 16 }: { name: string; size?: number }) {
  const spec = fileIcon(name);
  if (spec.label) {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center rounded-[3px] font-bold leading-none"
        style={{ width: size, height: size, fontSize: spec.label.length > 2 ? size * 0.42 : size * 0.5, background: `${spec.color}26`, color: spec.color }}
      >
        {spec.label}
      </span>
    );
  }
  return <Codicon name={spec.codicon ?? "file"} size={size} style={{ color: spec.color, width: size }} className="shrink-0" />;
}

export function FolderIcon({ open, size = 16 }: { open: boolean; size?: number }) {
  return <Codicon name={open ? "folder-opened" : "folder"} size={size} style={{ color: "#dcb67a" }} className="shrink-0" />;
}
