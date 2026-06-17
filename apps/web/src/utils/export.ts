export const exportToCsv = (filename: string, headers: string[], data: any[][]) => {
  // Add UTF-8 BOM to ensure Excel opens it correctly with accents
  const csvContent = "\uFEFF" + [
    headers.join(','),
    ...data.map(row => 
      row.map(cell => {
        if (cell === null || cell === undefined) return '""';
        const str = String(cell).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
