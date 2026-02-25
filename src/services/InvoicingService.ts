import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const InvoicingService = {
    generateInvoice: (payment: any, schoolName: string = 'Cortex School') => {
        const doc = new jsPDF() as any;

        // Header
        doc.setFontSize(22);
        doc.setTextColor(16, 185, 129); // Emerald-500
        doc.text(schoolName, 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // Slate-500
        doc.text('Official Payment Receipt', 14, 28);

        // Horizontal Line
        doc.setDrawColor(226, 232, 240); // Slate-200
        doc.line(14, 32, 196, 32);

        // Payment Details
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59); // Slate-800
        doc.text(`Receipt ID: ${payment.tx_ref || 'TX-' + payment.id}`, 14, 45);
        doc.text(`Date: ${new Date(payment.date).toLocaleDateString()}`, 14, 52);

        // Table
        doc.autoTable({
            startY: 65,
            head: [['Description', 'Amount (ETB)']],
            body: [
                [payment.description || 'School Fee Payment', payment.amount.toLocaleString()]
            ],
            headStyles: { fillColor: [16, 185, 129] },
            theme: 'striped'
        });

        // Total
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.text(`Total Paid: ${payment.amount.toLocaleString()} ETB`, 140, finalY);

        // Footer
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text('Thank you for choosing Cortex.', 14, 280);
        doc.text('This is a computer-generated document and requires no signature.', 14, 285);

        // Save
        doc.save(`Invoice_${payment.tx_ref || payment.id}.pdf`);
    }
};
