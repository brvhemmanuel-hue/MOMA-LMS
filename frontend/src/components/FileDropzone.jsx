import { useRef, useState } from 'react';

export default function FileDropzone({ accept, onFileSelect, fileName, hint }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files) {
    if (files && files[0]) onFileSelect(files[0]);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors ${
        dragOver ? 'border-[var(--color-navy-soft)] bg-[var(--color-navy)]/5' : 'border-[var(--color-line)] hover:border-[var(--color-navy-soft)]'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {fileName ? (
        <p className="text-sm font-medium text-[var(--color-navy)]">📎 {fileName}</p>
      ) : (
        <>
          <p className="text-sm font-medium text-[var(--color-ink-soft)]">Drop a file here, or click to browse</p>
          {hint && <p className="text-xs text-[var(--color-muted)] mt-1">{hint}</p>}
        </>
      )}
    </div>
  );
}
