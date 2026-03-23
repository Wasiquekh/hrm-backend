import puppeteer from "puppeteer";
import { Response } from "express";
import sequelize from "../../config/database";
import path from "path";
import fs from "fs";

function formatDate(date: Date | string): string {
  if (!date) return "N/A";
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

function numberToWords(num: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100)
      return (
        tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "")
      );
    if (n < 1000)
      return (
        ones[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 !== 0 ? " " + convert(n % 100) : "")
      );
    if (n < 100000)
      return (
        convert(Math.floor(n / 1000)) +
        " Thousand" +
        (n % 1000 !== 0 ? " " + convert(n % 1000) : "")
      );
    if (n < 10000000)
      return (
        convert(Math.floor(n / 100000)) +
        " Lakh" +
        (n % 100000 !== 0 ? " " + convert(n % 100000) : "")
      );
    return (
      convert(Math.floor(n / 10000000)) +
      " Crore" +
      (n % 10000000 !== 0 ? " " + convert(n % 10000000) : "")
    );
  }
  return convert(Math.floor(num)) + " Rupees Only";
}

export const generateOfferLetterPDF = async (
  offerId: string,
  res: Response,
) => {
  try {
    const offers = await sequelize.query(
      `SELECT o.*, d.name as department_name FROM offer_letters o 
       LEFT JOIN departments d ON o.department_id = d.id WHERE o.id = :id`,
      { replacements: { id: offerId }, type: "SELECT" },
    );

    if ((offers as any[]).length === 0) {
      res.status(404).json({ success: false, message: "Not found" });
      return;
    }

    const data = (offers as any[])[0];

    // Read template
    const templatePath = path.join(
      process.cwd(),
      "src/templates/offerLetter.html",
    );
    let html = fs.readFileSync(templatePath, "utf8");

    // ========== LOGO - BASE64 CONVERSION (FIXED) ==========
    let logoBase64 = "";
    const logoPath = path.join(process.cwd(), "src/assets/logo.png");

    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      console.log("✅ Logo loaded as base64");
    } else {
      console.log("⚠️ Logo not found at:", logoPath);
    }

    // Replace placeholders
    html = html.replace(
      /{{company_name}}/g,
      "COMPRESS INDIA AIR CONDITIONING PRIVATE LIMITED",
    );
    html = html.replace(
      /{{company_address}}/g,
      "Off no. 103, 1st Floor, Hi-Tech Commercial Complex, V.B Nagar, Near SCLR Road, Kurla (West) Mumbai - 400070",
    );
    html = html.replace(/{{company_phone}}/g, "+91 8655 0114 65");
    html = html.replace(/{{company_email}}/g, "hr@compressindia.in");
    html = html.replace(/{{company_website}}/g, "www.compressindia.in");
    html = html.replace(/{{company_gst}}/g, "27AAKCC6103D1Z0");
    html = html.replace(/{{logo}}/g, logoBase64); // ← FIXED: using base64
    html = html.replace(
      /{{offer_reference}}/g,
      `OL-${data.id.substring(0, 8).toUpperCase()}`,
    );
    html = html.replace(/{{offer_date}}/g, formatDate(data.offer_date));
    html = html.replace(
      /{{candidate_name}}/g,
      `${data.first_name} ${data.last_name}`,
    );
    html = html.replace(/{{email}}/g, data.email);
    html = html.replace(/{{job_title}}/g, data.job_title);
    html = html.replace(/{{department}}/g, data.department_name);
    html = html.replace(/{{employment_type}}/g, data.employment_type);
    html = html.replace(/{{reporting_manager}}/g, data.reporting_manager);
    html = html.replace(
      /{{offered_salary}}/g,
      formatCurrency(data.offered_salary),
    );
    html = html.replace(/{{work_location}}/g, data.work_location);
    html = html.replace(/{{joining_date}}/g, formatDate(data.joining_date));
    html = html.replace(/{{offer_status}}/g, data.offer_status);
    html = html.replace(
      /{{salary_in_words}}/g,
      numberToWords(data.offered_salary),
    );

    const signDate = new Date(data.offer_date);
    signDate.setDate(signDate.getDate() + 7);
    html = html.replace(/{{sign_return_date}}/g, formatDate(signDate));
    html = html.replace(/{{generated_date}}/g, formatDate(new Date()));

    // Generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Offer_Letter_${data.id.substring(0, 8)}.pdf`,
    );
    res.send(pdf);
  } catch (error) {
    console.error("Error:", error);
    if (!res.headersSent)
      res.status(500).json({ success: false, message: "Failed" });
  }
};
