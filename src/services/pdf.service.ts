import PDFDocument from 'pdfkit';
import { Response } from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

interface EmployeeData {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  blood_group: string;
  email: string;
  aadhar_number: string;
  department_name: string;
  designation_name: string;
  photo_url?: string;
}

// =======================
// HELPER FUNCTIONS
// =======================
function getInitials(firstName: string, lastName: string): string {
  const first = firstName ? firstName.charAt(0).toUpperCase() : '';
  const last = lastName ? lastName.charAt(0).toUpperCase() : '';
  return first + last || 'NA';
}

function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
}

function formatAadhar(aadhar: string): string {
  if (!aadhar) return 'N/A';
  const cleaned = String(aadhar).replace(/\D/g, '');
  if (cleaned.length === 12) {
    return cleaned.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return aadhar;
}

export const generateIDCard = async (employee: EmployeeData, res: Response) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: [550, 650],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=ID_CARD_${employee.employee_code}.pdf`);
      
      doc.pipe(res);

      // ========== PURE WHITE BACKGROUND ==========
      doc.rect(0, 0, 550, 650).fill('#ffffff');

      // ========== BLUE HEADER ==========
      doc.rect(0, 0, 550, 90).fill('#2321c4');
      
      // ========== COMPANY LOGO - PERFECT CENTERING (NO SHADOW) ==========
      try {
        const logoPaths = [
          path.join(__dirname, '../assets/logo.png'),
          path.join(__dirname, '../../src/assets/logo.png'),
          path.join(process.cwd(), 'src/assets/logo.png'),
        ];

        let logoLoaded = false;
        
        for (const logoPath of logoPaths) {
          if (fs.existsSync(logoPath)) {
            console.log('✅ Logo found at:', logoPath);
            
            // White background box for logo - perfectly centered
            const logoBoxWidth = 160;
            const logoBoxHeight = 60;
            const logoBoxX = (550 - logoBoxWidth) / 2;  // Center horizontally
            const logoBoxY = 15;  // 15px from top
            
            // White background with border only (no shadow)
            doc.rect(logoBoxX, logoBoxY, logoBoxWidth, logoBoxHeight)
               .fill('#ffffff')
               .strokeColor('#e0e0e0')
               .lineWidth(1)
               .stroke();
            
            // Add logo centered inside white box
            doc.image(logoPath, logoBoxX + 10, logoBoxY + 5, {
              fit: [logoBoxWidth - 20, logoBoxHeight - 10],
              align: 'center',
              valign: 'center'
            });
            
            logoLoaded = true;
            break;
          }
        }

        if (!logoLoaded) {
          // Centered text fallback
          doc.fillColor('#ffffff')
             .fontSize(24)
             .font('Helvetica-Bold')
             .text('COMPANY NAME', 0, 30, { align: 'center', width: 550 });
        }
      } catch (logoError) {
        console.error('❌ Error loading logo:', logoError);
        doc.fillColor('#ffffff')
           .fontSize(24)
           .font('Helvetica-Bold')
           .text('COMPANY NAME', 0, 30, { align: 'center', width: 550 });
      }

      // ========== PHOTO SECTION - PERFECT ALIGNMENT ==========
      const photoY = 105;
      const photoX = 70;
      
      // Photo circle
      doc.circle(photoX + 40, photoY + 40, 38)
         .lineWidth(2)
         .strokeColor('#2321c4')
         .stroke();

      if (employee.photo_url) {
        try {
          const response = await axios.get(employee.photo_url, { 
            responseType: 'arraybuffer',
            timeout: 5000 
          });
          const photoBuffer = Buffer.from(response.data);
          
          doc.save();
          doc.circle(photoX + 40, photoY + 40, 36).clip();
          doc.image(photoBuffer, photoX + 4, photoY + 4, {
            fit: [72, 72],
            align: 'center',
            valign: 'center'
          });
          doc.restore();
        } catch (error) {
          doc.circle(photoX + 40, photoY + 40, 36)
             .fill('#2321c4');
          
          doc.fillColor('#ffffff')
             .fontSize(22)
             .font('Helvetica-Bold')
             .text(getInitials(employee.first_name, employee.last_name), 
                   photoX + 28, photoY + 25);
        }
      } else {
        doc.circle(photoX + 40, photoY + 40, 36)
           .fill('#2321c4');
        
        doc.fillColor('#ffffff')
           .fontSize(22)
           .font('Helvetica-Bold')
           .text(getInitials(employee.first_name, employee.last_name), 
                 photoX + 28, photoY + 25);
      }

      // ========== EMPLOYEE DETAILS - ALIGNED WITH PHOTO ==========
      const nameX = 160;
      const fullName = `${employee.first_name} ${employee.last_name}`;
      
      doc.fillColor('#2321c4')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text(fullName, nameX, photoY + 10);

      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#333333')
         .text(employee.designation_name || 'N/A', nameX, photoY + 40);

      doc.fontSize(12)
         .fillColor('#666666')
         .text(employee.department_name || 'N/A', nameX, photoY + 65);

      // ========== EMPLOYEE ID ==========
      const idY = photoY + 115;
      
      doc.fillColor('#2321c4')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('EMPLOYEE ID', 70, idY);
      
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor('#333333')
         .text(employee.employee_code, 70, idY + 20);

      // ========== PERSONAL DETAILS ==========
      const personalY = idY + 60;
      
      doc.fillColor('#2321c4')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('PERSONAL DETAILS', 70, personalY);

      const formattedDOB = formatDate(employee.date_of_birth);
      const formattedAadhar = formatAadhar(employee.aadhar_number);

      // Personal details grid - perfect spacing
      const startY = personalY + 25;
      const lineHeight = 22;
      
      // Labels
      doc.fillColor('#666666')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('Date of Birth:', 70, startY)
         .text('Blood Group:', 70, startY + lineHeight)
         .text('Email:', 70, startY + lineHeight * 2)
         .text('Aadhar No:', 70, startY + lineHeight * 3);

      // Values
      doc.fillColor('#333333')
         .fontSize(10)
         .font('Helvetica')
         .text(formattedDOB, 180, startY)
         .text(employee.blood_group || 'N/A', 180, startY + lineHeight)
         .text(employee.email || 'N/A', 180, startY + lineHeight * 2)
         .text(formattedAadhar, 180, startY + lineHeight * 3);

      // ========== CONTACT DETAILS - NO EXTRA SPACE ==========
      const contactY = startY + lineHeight * 4 + 15;  // Exactly after personal details
      
      doc.fillColor('#2321c4')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('CONTACT DETAILS', 70, contactY);

      // Contact details - tight spacing
      doc.fillColor('#666666')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('Head Office:', 70, contactY + 25)
         .text('Website:', 70, contactY + 47);

      doc.fillColor('#333333')
         .fontSize(10)
         .font('Helvetica')
         .text('7208 2190 16', 180, contactY + 25)
         .text('www.compressindia.in', 180, contactY + 47);

      doc.end();
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
};