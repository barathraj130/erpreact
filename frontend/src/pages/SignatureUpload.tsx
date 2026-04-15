import React, { useState } from "react";
import { apiFetch } from "../utils/api";

export default function SignatureUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const upload = async () => {
    if (!file) {
      setStatus("Please select a file");
      return;
    }

    const form = new FormData();
    form.append("signature", file);

    const res = await apiFetch(
      "/users/upload-signature",
      {
        method: "POST",
        body: form,
      },
      false,
    );

    const data = await res.json();

    if (data.url) {
      setStatus("Uploaded Successfully!");
    } else {
      setStatus("Upload Failed");
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: "bold" }}>Upload Signature</h2>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          setFile(file);
          if (file) setPreview(URL.createObjectURL(file));
        }}
        style={{ marginTop: 20 }}
      />

      {preview && (
        <img
          src={preview}
          alt="Preview"
          style={{
            width: "200px",
            marginTop: "20px",
            border: "1px solid #ccc",
            padding: "5px",
          }}
        />
      )}

      <button
        onClick={upload}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          background: "#2563eb",
          color: "#fff",
          borderRadius: 6,
        }}
      >
        Upload Signature
      </button>

      <div style={{ marginTop: 15, color: "green" }}>{status}</div>
    </div>
  );
}
