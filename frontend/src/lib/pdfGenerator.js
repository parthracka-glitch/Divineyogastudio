import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generate and download a high-quality PDF roster for a specific batch.
 * @param {Object} batch - The batch object.
 * @param {Array} clients - List of clients enrolled in the batch.
 */
export function downloadBatchRosterPdf(batch, clients = []) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const primaryColor = [74, 93, 35]; // #4a5d23
  const secondaryColor = [107, 106, 101]; // #6b6a65
  const accentColor = [224, 122, 95]; // #e07a5f
  const lightBg = [247, 245, 240]; // #f7f5f0

  // 1. Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("DIVINE YOGA STUDIO", 14, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Class Roster & Attendance Sheet", 14, 21);

  const todayStr = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  doc.setFontSize(9);
  doc.text(`Generated on: ${todayStr}`, 196, 21, { align: "right" });

  // 2. Batch Summary Info Card
  doc.setFillColor(...lightBg);
  doc.roundedRect(14, 34, 182, 32, 3, 3, "F");
  doc.setDrawColor(220, 218, 210);
  doc.roundedRect(14, 34, 182, 32, 3, 3, "S");

  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(batch.name || "Class Batch", 20, 43);

  doc.setFontSize(9);
  doc.setTextColor(...secondaryColor);
  doc.setFont("helvetica", "normal");

  const scheduleDays = Array.isArray(batch.schedule_days)
    ? batch.schedule_days.join(", ")
    : (batch.schedule_days || "Mon - Fri");
  const timings = `${batch.start_time || "07:00"} - ${batch.end_time || "08:00"}`;
  const category = batch.category_tag || "Mat Yoga";
  const instructor = batch.instructor_name || "Assigned Instructor";
  const capacity = batch.capacity || 20;
  const enrolledCount = clients.length;

  doc.text(`Instructor: `, 20, 51);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(`${instructor}`, 38, 51);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...secondaryColor);
  doc.text(`Category: `, 110, 51);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(`${category}`, 128, 51);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...secondaryColor);
  doc.text(`Schedule: `, 20, 59);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(`${scheduleDays} (${timings})`, 38, 59);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...secondaryColor);
  doc.text(`Enrolled: `, 110, 59);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(`${enrolledCount} / ${capacity} practitioners`, 128, 59);

  // 3. Client Table
  const tableHeaders = [
    "#",
    "Practitioner Name",
    "Contact Number",
    "Email Address",
    "Plan",
    "Status",
    "Signature / Check-in",
  ];

  const tableData = clients.map((client, index) => [
    String(index + 1),
    client.full_name || "—",
    client.phone_number || "—",
    client.email || "—",
    client.plan_name || "Regular",
    (client.status || "active").toUpperCase(),
    "", // Empty box for physical attendance check-in / signature
  ]);

  if (tableData.length === 0) {
    tableData.push(["—", "No practitioners enrolled in this batch yet.", "", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: 72,
    head: [tableHeaders],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [45, 45, 45],
      rowPageBreak: "avoid",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 42, fontStyle: "bold" },
      2: { cellWidth: 32 },
      3: { cellWidth: 42 },
      4: { cellWidth: 26 },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 14, halign: "center" },
    },
    alternateRowStyles: {
      fillColor: [252, 251, 248],
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Divine Yoga Studio — Mindful Movement & Holistic Wellness`,
        14,
        290
      );
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        196,
        290,
        { align: "right" }
      );
    },
  });

  const fileName = `${(batch.name || "batch").toLowerCase().replace(/\s+/g, "_")}_roster.pdf`;
  doc.save(fileName);
}

/**
 * Generate and download a master client roster report grouped by batch or filtered.
 * @param {Array} clients - All clients.
 * @param {Array} batches - All batches.
 * @param {string} [filterBatchId] - Optional batch filter ID.
 */
export function downloadAllClientsPdf(clients = [], batches = [], filterBatchId = "") {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const primaryColor = [74, 93, 35];
  const secondaryColor = [107, 106, 101];
  const lightBg = [247, 245, 240];

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("DIVINE YOGA STUDIO", 14, 13);

  const selectedBatch = batches.find((b) => b.id === filterBatchId);
  const subtitle = selectedBatch
    ? `Practitioner Directory — ${selectedBatch.name}`
    : "Master Practitioner Directory";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, 14, 21);

  const todayStr = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  doc.setFontSize(9);
  doc.text(`Generated: ${todayStr}`, 196, 21, { align: "right" });

  // Filter clients if batch specified
  const filteredClients = filterBatchId
    ? clients.filter((c) => c.batch_id === filterBatchId || c.batch_name === selectedBatch?.name)
    : clients;

  // Overview metrics box
  doc.setFillColor(...lightBg);
  doc.roundedRect(14, 34, 182, 18, 2, 2, "F");
  doc.setDrawColor(220, 218, 210);
  doc.roundedRect(14, 34, 182, 18, 2, 2, "S");

  doc.setFontSize(9);
  doc.setTextColor(...secondaryColor);
  doc.text(`Total Practitioners: `, 20, 45);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text(`${filteredClients.length}`, 52, 45);

  const activeCount = filteredClients.filter((c) => c.status === "active").length;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...secondaryColor);
  doc.text(`Active: `, 80, 45);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 140, 40);
  doc.text(`${activeCount}`, 93, 45);

  const whatsappCount = filteredClients.filter((c) => c.whatsapp_opt_in).length;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...secondaryColor);
  doc.text(`WhatsApp Reminders: `, 125, 45);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(`${whatsappCount} enabled`, 160, 45);

  const tableHeaders = [
    "#",
    "Practitioner",
    "Phone Number",
    "Email",
    "Batch",
    "Status",
    "Joined",
  ];

  const tableData = filteredClients.map((client, index) => {
    let batchName = "Unassigned";
    if (client.batch_id) {
      const match = batches.find((b) => b.id === client.batch_id);
      if (match) batchName = match.name;
    } else if (client.batch_name) {
      batchName = client.batch_name;
    }

    return [
      String(index + 1),
      client.full_name || "—",
      client.phone_number || "—",
      client.email || "—",
      batchName,
      (client.status || "active").toUpperCase(),
      client.join_date || "—",
    ];
  });

  if (tableData.length === 0) {
    tableData.push(["—", "No practitioners match the selected filter.", "", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: 58,
    head: [tableHeaders],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [45, 45, 45],
      rowPageBreak: "avoid",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 38, fontStyle: "bold" },
      2: { cellWidth: 30 },
      3: { cellWidth: 38 },
      4: { cellWidth: 34 },
      5: { cellWidth: 18, halign: "center" },
      6: { cellWidth: 14, halign: "center" },
    },
    alternateRowStyles: {
      fillColor: [252, 251, 248],
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Divine Yoga Studio — Mindful Movement & Holistic Wellness`,
        14,
        290
      );
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        196,
        290,
        { align: "right" }
      );
    },
  });

  const fileName = selectedBatch
    ? `${selectedBatch.name.toLowerCase().replace(/\s+/g, "_")}_clients.pdf`
    : "divine_yoga_clients_directory.pdf";
  doc.save(fileName);
}
