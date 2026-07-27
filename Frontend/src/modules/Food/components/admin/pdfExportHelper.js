/**
 * Helper to download raw HTML string as PDF using jsPDF + jspdf-autotable.
 * This parses the HTML content entirely in-memory using DOMParser
 * and generates/saves the PDF file directly, without appending anything
 * to the DOM or opening print dialogs/windows.
 */
export const downloadHTMLAsPDF = async (htmlContent, filename = "document") => {
  try {
    // 1. Dynamically import jsPDF and jspdf-autotable
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    // 2. Parse the HTML string in-memory (fully detached from document body)
    const parser = new DOMParser();
    const docElement = parser.parseFromString(htmlContent, 'text/html');
    
    const titleText = docElement.querySelector('h1')?.textContent || 'Report';
    const dateText = docElement.querySelector('p')?.textContent || '';
    const tableElement = docElement.querySelector('table');

    if (!tableElement) {
      throw new Error("No table found in HTML content");
    }

    // 3. Create PDF document (portrait, A4)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Add Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(titleText, 14, 18);

    // Add Date / Subtitle if present
    if (dateText) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(dateText, 14, 24);
    }

    // 4. Render Table
    autoTable(doc, {
      html: tableElement,
      startY: dateText ? 28 : 22,
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 3.5,
      },
      headStyles: {
        fillColor: [59, 130, 246], // blue-500 (#3b82f6)
        textColor: 255,
        fontStyle: "bold"
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251] // slate-50
      },
      margin: { top: 15, left: 14, right: 14, bottom: 15 },
      theme: 'striped'
    });

    // 5. Save the PDF instantly
    const fileTimestamp = new Date().toISOString().split("T")[0];
    doc.save(`${filename}_${fileTimestamp}.pdf`);
  } catch (error) {
    console.error("Direct PDF generation failed:", error);
    alert("Failed to download PDF. Please try again.");
  }
};
