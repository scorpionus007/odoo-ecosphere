"use client";

import { useRef, useState } from "react";
import { Paperclip, Check } from "lucide-react";

/**
 * File input for server-action forms: uploads to /api/upload on selection and
 * stores the returned URL in a hidden input with the given name.
 */
export default function FileUploadField({
  name,
  label = "Attach file",
}: {
  name: string;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  async function handleChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.url) {
        setUrl(json.url);
        setFileName(file.name);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleChange} />
      {url ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
          <Check size={13} /> {fileName}
        </span>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium px-3 py-1.5 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Paperclip size={13} />
          {busy ? "Uploading..." : label}
        </button>
      )}
    </div>
  );
}
