import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import React from 'react';
import { Result, Student } from '@/lib/api';

interface BulkReportCardData {
    student: Student;
    results: Result[];
}

/**
 * Generate a bulk PDF containing multiple student report cards
 * @param reportCards - Array of report card data for each student
 * @param fileName - Name for the downloaded PDF file
 */
export async function generateBulkReportCardsPDF(
    reportCards: BulkReportCardData[],
    fileName: string = 'bulk_report_cards.pdf'
): Promise<void> {
    if (reportCards.length === 0) {
        throw new Error('No report cards to generate');
    }

    try {
        // Create a new jsPDF document
        const pdf = new jsPDF({
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        });

        // Import dependencies once
        const ReportCardModule = await import('@/components/admin/report-card');
        const { createRoot } = await import('react-dom/client');

        let isFirstPage = true;

        for (const { student, results } of reportCards) {
            if (!isFirstPage) {
                pdf.addPage();
            }

            // Create a temporary div to render the report card
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'fixed';
            tempDiv.style.top = '0';
            tempDiv.style.left = '0';
            tempDiv.style.width = '210mm'; // A4 width
            tempDiv.style.zIndex = '-9999';
            tempDiv.style.backgroundColor = 'white';
            tempDiv.style.padding = '10mm';
            tempDiv.style.pointerEvents = 'none';
            document.body.appendChild(tempDiv);

            const root = createRoot(tempDiv);

            // Use React.createElement instead of calling the component function directly
            root.render(
                React.createElement(ReportCardModule.ReportCard, {
                    student,
                    results,
                    activeMonth: results[0]?.month,
                    className: ''
                })
            );

            // Wait more for fonts/images and ensure DOM settles
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Convert to PNG using html-to-image (more robust for modern CSS)
            // We use toPng because it's reliable and handles nested SVGs/images better
            const imgData = await toPng(tempDiv, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                skipFonts: false,
                cacheBust: true,
            });

            const imgWidth = 210; // A4 width in mm
            // A4 ratio is roughly 1.414, but we should use the element's actual proportions
            const elementHeight = tempDiv.offsetHeight;
            const elementWidth = tempDiv.offsetWidth;
            const imgHeight = (elementHeight * imgWidth) / elementWidth;

            // Add image to PDF
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

            // Cleanup
            root.unmount();
            document.body.removeChild(tempDiv);

            isFirstPage = false;
        }

        // Save the PDF
        pdf.save(fileName);
    } catch (error) {
        console.error('Error generating bulk PDF:', error);
        throw new Error(`Failed to generate bulk PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Generate separate PDFs for each student and download as ZIP
 * @param reportCards - Array of report card data for each student
 * @param zipFileName - Name for the downloaded ZIP file
 */
export async function generateSeparateReportCardsPDFs(
    reportCards: BulkReportCardData[],
    zipFileName: string = 'report_cards.zip'
): Promise<void> {
    if (reportCards.length === 0) {
        throw new Error('No report cards to generate');
    }

    try {
        // Dynamic imports once
        const JSZip = (await import('jszip')).default;
        const ReportCardModule = await import('@/components/admin/report-card');
        const { createRoot } = await import('react-dom/client');

        const zip = new JSZip();

        for (const { student, results } of reportCards) {
            const pdf = new jsPDF({
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            });

            // Create a temporary div to render the report card
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'fixed';
            tempDiv.style.top = '0';
            tempDiv.style.left = '0';
            tempDiv.style.width = '210mm'; // A4 width
            tempDiv.style.zIndex = '-9999';
            tempDiv.style.backgroundColor = 'white';
            tempDiv.style.padding = '10mm';
            tempDiv.style.pointerEvents = 'none';
            document.body.appendChild(tempDiv);

            const root = createRoot(tempDiv);

            // Use React.createElement
            root.render(
                React.createElement(ReportCardModule.ReportCard, {
                    student,
                    results,
                    activeMonth: results[0]?.month,
                    className: ''
                })
            );

            // Wait more for fonts/images and ensure DOM settles
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Convert to PNG using html-to-image
            const imgData = await toPng(tempDiv, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                skipFonts: false,
                cacheBust: true,
            });

            const imgWidth = 210;
            const elementHeight = tempDiv.offsetHeight;
            const elementWidth = tempDiv.offsetWidth;
            const imgHeight = (elementHeight * imgWidth) / elementWidth;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

            // Generate PDF blob
            const pdfBlob = pdf.output('blob');
            const safeStudentName = (student.name || student.full_name || `student_${student.id}`)
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase();

            // Add to ZIP
            zip.file(`${safeStudentName}_report_card.pdf`, pdfBlob);

            // Cleanup
            root.unmount();
            document.body.removeChild(tempDiv);
        }

        // Generate and download ZIP
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = zipFileName;
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Error generating separate PDFs:', error);
        throw new Error(`Failed to generate separate PDFs: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Generate separate PDFs for each student challan and download as ZIP
 * @param studentFees - Array of student fee objects (challans)
 * @param zipFileName - Name for the downloaded ZIP file
 */
export async function generateSeparateChallansPDFs(
    studentFees: import('@/services/feeService').StudentFee[],
    zipFileName: string = 'challans.zip'
): Promise<void> {
    if (studentFees.length === 0) {
        throw new Error('No challans to generate');
    }

    try {
        // Dynamic imports once
        const JSZip = (await import('jszip')).default;
        const ChallanTemplateModule = await import('@/components/admin/challan-template');
        const { createRoot } = await import('react-dom/client');
        const jsPDF = (await import('jspdf')).default;

        const zip = new JSZip();

        for (const fee of studentFees) {
            const pdf = new jsPDF({
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            });

            // Create a temporary div to render the challan
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'fixed';
            tempDiv.style.top = '0';
            tempDiv.style.left = '0';
            tempDiv.style.width = '210mm'; // A4 width
            tempDiv.style.height = '297mm'; // A4 height
            tempDiv.style.zIndex = '-9999';
            tempDiv.style.backgroundColor = 'white';
            tempDiv.style.pointerEvents = 'none';
            document.body.appendChild(tempDiv);

            const root = createRoot(tempDiv);

            // Use React.createElement
            root.render(
                React.createElement(ChallanTemplateModule.ChallanTemplate, { fee })
            );

            // Wait more for fonts/images and ensure DOM settles
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Convert to PNG using html-to-image
            const imgData = await toPng(tempDiv, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                skipFonts: false,
                cacheBust: true,
            });

            const imgWidth = 210;
            const elementHeight = tempDiv.offsetHeight;
            const elementWidth = tempDiv.offsetWidth;
            const imgHeight = (elementHeight * imgWidth) / elementWidth;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

            // Generate PDF blob
            const pdfBlob = pdf.output('blob');
            const safeStudentName = (fee.student_name || `student_${fee.id}`)
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase();

            // Add to ZIP (format: "Hassan_0001_challan.pdf")
            zip.file(`${safeStudentName}_${fee.invoice_number}_challan.pdf`, pdfBlob);

            // Cleanup
            root.unmount();
            document.body.removeChild(tempDiv);
        }

        // Generate and download ZIP
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = zipFileName;
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Error generating separate challan PDFs:', error);
        throw new Error(`Failed to generate separate challans ZIP: ${error instanceof Error ? error.message : String(error)}`);
    }
}
