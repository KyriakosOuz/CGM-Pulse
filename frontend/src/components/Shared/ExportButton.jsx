/**
 * ExportButton — Converts an array of objects to CSV and triggers browser download.
 *
 * Props:
 *   data: object[] — Array of objects to export
 *   filename: string — Desired filename (without extension)
 *   columns: { key: string, label: string }[] — Which keys to include and their header labels
 */
export default function ExportButton({ data, filename, columns }) {
  function handleExport() {
    if (!data?.length) return;

    const headers = columns.map((c) => c.label).join(",");
    const rows = data.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key] ?? "";
          const str = String(val);
          return str.includes(",") || str.includes("\n") ? `"${str}"` : str;
        })
        .join(",")
    );

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      disabled={!data?.length}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/20 text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="material-symbols-outlined text-base">download</span>
      Export CSV
    </button>
  );
}
