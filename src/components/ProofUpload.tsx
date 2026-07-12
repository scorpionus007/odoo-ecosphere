"use client";

import { useRef, useState } from "react";
import { Paperclip, Check } from "lucide-react";

/**
 * Uploads a proof file to /api/upload, then submits the given server action
 * form with the returned URL in a hidden input.
 */
export default function ProofUpload({
  participationId,
  action,
}: {
  participationId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
        const actionData = new FormData();
        actionData.append("id", participationId);
        actionData.append("proofUrl", json.url);
        await action(actionData);
        setDone(true);
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <Check size={13} /> Proof attached
      </span>
    );
  }
  return (
    <>
      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleChange} />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:underline disabled:opacity-50 cursor-pointer"
      >
        <Paperclip size={13} />
        {busy ? "Uploading..." : "Attach proof"}
      </button>
    </>
  );
}
