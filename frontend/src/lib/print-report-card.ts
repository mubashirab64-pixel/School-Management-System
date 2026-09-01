/**
 * Prints only the report card content using a hidden iframe.
 * Extracts the .report-root element (actual A4 card) from inside the modal.
 */
export function printReportCard(modalId = 'report-card-print-root') {
  const modal = document.getElementById(modalId);
  if (!modal) { window.print(); return; }

  // Find the actual report card element inside the modal
  const reportRoot = modal.querySelector('.report-root') as HTMLElement | null;
  const contentHtml = reportRoot ? reportRoot.outerHTML : modal.innerHTML;

  // Collect all external stylesheets
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((el) => `<link rel="stylesheet" href="${(el as HTMLLinkElement).href}">`)
    .join('\n');

  // Collect all inline <style> tags (includes Tailwind + component styles)
  const inlineStyles = Array.from(document.querySelectorAll('style'))
    .map((el) => `<style>${el.innerHTML}</style>`)
    .join('\n');

  // Create hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;z-index:-1;visibility:hidden;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) { document.body.removeChild(iframe); window.print(); return; }

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${styleLinks}
  ${inlineStyles}
  <style>
    @page { size: A4 portrait; margin: 0; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    /* Ensure report-root fills the full A4 page */
    .report-root {
      width: 210mm !important;
      min-height: 297mm !important;
      margin: 0 auto !important;
      padding: 5mm 8mm !important;
      box-shadow: none !important;
      border: none !important;
      page-break-inside: avoid !important;
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>`);
  iframeDoc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 400);
  };
}
