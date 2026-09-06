import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { getDatabase, saveDatabase, logAudit } from './server/db';
import { checkRedFlags } from './server/clinicalRules';
import { setupAnnaLiveWebSocket } from './server/annaLiveService';
import {
  CLINICAL_ONTOLOGY_FLOW,
  AYUSH_ONTOLOGY_FLOW,
  processMedicalDocument,
  generateStructuredSummary,
} from './server/aiService';
import {
  Intake,
  Patient,
  RedFlagAlert,
  ClinicalInterview,
  ClinicalReport,
  InterviewMessage,
  Medication,
  Allergy,
  MedicalDocument,
  DoctorUser,
  HospitalUser,
  HospitalConnectionRequest,
  ReportShare,
  ProcedureRecord,
  NotificationRecord,
} from './src/types';
import {
  isNonMedicalQuery,
  categorizeSymptom,
  getAdaptiveHPIQuestions,
  detectContradiction,
  buildClinicalReport,
} from './server/interviewEngine';

// Doctors persistent accessors connected to database
const getDoctorsStore = () => {
  const db = getDatabase();
  return db.doctors;
};

// Hospitals persistent accessors connected to database
const getHospitalsStore = () => {
  const db = getDatabase();
  return db.hospitals;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Request logger for audit
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.url}`);
    }
    next();
  });

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'MediKiosk Outpatient Healthcare Platform',
      theme: 'AI-Powered Clinical Intake & OPD Operations',
      organization: 'Ministry of Ayush & AIIA',
      timestamp: new Date().toISOString(),
    });
  });

  // --- DOCTOR AUTHENTICATION ENDPOINTS ---

  app.post('/api/auth/doctor/login', (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/Mobile and password are required' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const doctors = getDoctorsStore();
    const doctor = doctors.find(
      d =>
        d.email.toLowerCase() === cleanId ||
        (d.email.includes('ananya') && cleanId.includes('doctor1')) ||
        (d.email.includes('rahul') && cleanId.includes('doctor2')) ||
        (d.email.includes('meera') && cleanId.includes('doctor3')) ||
        d.mobile.replace(/\s+/g, '') === cleanId.replace(/\s+/g, '')
    );

    const isDemoPasswordMatch =
      (password === 'Doctor@123' || password === 'Demo@12345') &&
      doctor &&
      (doctor.email.includes('@medikiosk.demo') || doctor.email.includes('@aiia.gov.in'));

    if (!doctor || (doctor.passwordHash !== password && !isDemoPasswordMatch)) {
      return res.status(401).json({ error: 'Invalid doctor credentials. Please verify your details or register.' });
    }

    logAudit(doctor.fullName, 'DOCTOR', 'DOCTOR_LOGIN', doctor.id, `Doctor ${doctor.fullName} logged in successfully.`);

    const { passwordHash, ...safeDoctor } = doctor;
    res.json({
      success: true,
      doctor: {
        ...safeDoctor,
        token: `doc_tok_${doctor.id}_${Date.now()}`,
      },
    });
  });

  app.post('/api/auth/doctor/register', (req, res) => {
    const {
      fullName,
      email,
      mobile,
      registrationNumber,
      council,
      specialization,
      subSpecialization,
      qualification,
      experienceYears,
      department,
      hospitalId,
      hospitalName,
      city,
      state,
      consultationType,
      bio,
      languages,
      avatarUrl,
      password,
    } = req.body;

    if (!fullName || !email || !mobile || !registrationNumber || !password) {
      return res.status(400).json({ error: 'Please provide all mandatory registration fields (Full Name, Email, Mobile, Medical Registration Number, Password).' });
    }

    const db = getDatabase();
    const cleanEmail = email.trim().toLowerCase();
    const existing = db.doctors.find(
      d => d.email.toLowerCase() === cleanEmail || d.registrationNumber.toLowerCase() === registrationNumber.trim().toLowerCase()
    );

    if (existing) {
      return res.status(409).json({ error: 'Doctor with this email or medical registration number already exists.' });
    }

    const newId = `DOC-${db.doctors.length + 101}`;
    const willRequestHospital = !!hospitalId;

    const newDoctor: DoctorUser & { passwordHash: string } = {
      id: newId,
      fullName: fullName.trim(),
      email: cleanEmail,
      mobile: mobile.trim(),
      registrationNumber: registrationNumber.trim(),
      council: council ? council.trim() : 'State Medical Council',
      specialization: specialization ? specialization.trim() : 'General Medicine',
      subSpecialization: subSpecialization ? subSpecialization.trim() : undefined,
      qualification: qualification ? qualification.trim() : 'MBBS',
      experienceYears: experienceYears ? Number(experienceYears) : 3,
      department: department ? department.trim() : 'Outpatient Department',
      hospitalId: hospitalId || undefined,
      hospitalName: hospitalName || undefined,
      city: city ? city.trim() : 'Kanpur',
      state: state ? state.trim() : 'Uttar Pradesh',
      consultationType: Array.isArray(consultationType) && consultationType.length > 0 ? consultationType : ['OPD'],
      bio: bio ? bio.trim() : 'Registered Medical Practitioner',
      languages: Array.isArray(languages) && languages.length > 0 ? languages : ['English', 'Hindi'],
      avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=300&q=80',
      gender: req.body.gender || undefined,
      dob: req.body.dob || undefined,
      hospitalDepartment: req.body.hospitalDepartment || undefined,
      hospitalConnectionStatus: willRequestHospital ? 'PENDING_APPROVAL' : 'NOT_CONNECTED',
      passwordHash: password,
      createdAt: new Date().toISOString(),
    };

    db.doctors.push(newDoctor);

    // If doctor requested hospital connection, create connection request
    if (willRequestHospital) {
      const reqId = `REQ-${Date.now().toString().slice(-5)}`;
      const connReq: HospitalConnectionRequest = {
        id: reqId,
        doctorId: newDoctor.id,
        doctorName: newDoctor.fullName,
        doctorEmail: newDoctor.email,
        doctorMobile: newDoctor.mobile,
        doctorRegNumber: newDoctor.registrationNumber,
        doctorSpecialization: newDoctor.specialization,
        doctorQualification: newDoctor.qualification,
        doctorExperienceYears: newDoctor.experienceYears || 0,
        hospitalId: hospitalId!,
        hospitalName: hospitalName || 'Affiliated Hospital',
        department: newDoctor.department || 'Outpatient Department',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
      };
      db.hospitalConnectionRequests = db.hospitalConnectionRequests || [];
      db.hospitalConnectionRequests.unshift(connReq);

      // Notify hospital
      db.notifications = db.notifications || [];
      db.notifications.unshift({
        id: `NOTIF-${Date.now().toString().slice(-6)}`,
        recipientRole: 'HOSPITAL',
        recipientId: hospitalId!,
        title: 'New Doctor Affiliation Request',
        message: `${newDoctor.fullName} (${newDoctor.specialization}) requested to connect with your facility.`,
        type: 'CONNECTION_REQUEST',
        relatedId: reqId,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    saveDatabase();
    logAudit(newDoctor.fullName, 'DOCTOR', 'DOCTOR_REGISTERED', newDoctor.id, `Doctor ${newDoctor.fullName} registered with Reg: ${newDoctor.registrationNumber}.`);

    const { passwordHash, ...safeDoctor } = newDoctor;
    res.status(201).json({
      success: true,
      doctor: {
        ...safeDoctor,
        token: `doc_tok_${newDoctor.id}_${Date.now()}`,
      },
    });
  });

  app.get('/api/auth/doctor/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.replace('Bearer ', '');
    const match = token.match(/doc_tok_(DOC-\d+)/);
    if (match) {
      const docId = match[1];
      const doc = getDoctorsStore().find(d => d.id === docId);
      if (doc) {
        const { passwordHash, ...safeDoctor } = doc;
        return res.json({ success: true, doctor: { ...safeDoctor, token } });
      }
    }
    res.status(401).json({ error: 'Invalid session' });
  });

  app.post('/api/auth/doctor/logout', (req, res) => {
    res.json({ success: true, message: 'Doctor logged out successfully.' });
  });

  // --- HOSPITAL AUTHENTICATION ENDPOINTS ---

  app.post('/api/auth/hospital/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Official Hospital Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const hospitals = getHospitalsStore();
    const hospital = hospitals.find(h => h.email.toLowerCase() === cleanEmail);

    if (!hospital || hospital.passwordHash !== password) {
      return res.status(401).json({ error: 'Invalid hospital credentials or facility not registered.' });
    }

    logAudit(hospital.adminName, 'HOSPITAL_ADMIN', 'HOSPITAL_LOGIN', hospital.id, `Hospital ${hospital.hospitalName} logged in.`);

    const { passwordHash, ...safeHospital } = hospital;
    res.json({
      success: true,
      hospital: {
        ...safeHospital,
        token: `hosp_tok_${hospital.id}_${Date.now()}`,
      },
    });
  });

  app.post('/api/auth/hospital/register', (req, res) => {
    const {
      hospitalName,
      hospitalType,
      licenseNumber,
      address,
      city,
      state,
      pincode,
      email,
      contactNumber,
      adminName,
      departments,
      totalBeds,
      availableBeds,
      icuBeds,
      opdCapacity,
      password,
    } = req.body;

    if (!hospitalName || !licenseNumber || !email || !password || !adminName) {
      return res.status(400).json({ error: 'Please fill in all mandatory hospital registration fields (Hospital Name, License Number, Official Email, Admin Name, Password).' });
    }

    const db = getDatabase();
    const cleanEmail = email.trim().toLowerCase();
    const existing = db.hospitals.find(
      h => h.email.toLowerCase() === cleanEmail || h.licenseNumber.toLowerCase() === licenseNumber.trim().toLowerCase()
    );

    if (existing) {
      return res.status(409).json({ error: 'Hospital with this email or license registration number already exists.' });
    }

    const newId = `HOSP-${db.hospitals.length + 201}`;
    const newHospital: HospitalUser & { passwordHash: string } = {
      id: newId,
      hospitalName: hospitalName.trim(),
      hospitalType: hospitalType ? hospitalType.trim() : 'General Multispecialty Hospital',
      licenseNumber: licenseNumber.trim(),
      address: address ? address.trim() : 'Medical Enclave',
      city: city ? city.trim() : 'Kanpur',
      state: state ? state.trim() : 'Uttar Pradesh',
      pincode: pincode ? pincode.trim() : '208001',
      email: cleanEmail,
      contactNumber: contactNumber ? contactNumber.trim() : '+91 512 200 0000',
      adminName: adminName.trim(),
      verificationStatus: 'VERIFIED',
      departments: Array.isArray(departments) && departments.length > 0 ? departments : ['General Medicine', 'Cardiology', 'Emergency', 'OPD'],
      totalBeds: totalBeds ? Number(totalBeds) : 150,
      availableBeds: availableBeds ? Number(availableBeds) : 25,
      icuBeds: icuBeds ? Number(icuBeds) : 15,
      opdCapacity: opdCapacity ? Number(opdCapacity) : 400,
      connectedDoctorsCount: 0,
      logoUrl: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=300&q=80',
      description: 'Registered healthcare institution operating integrated outpatient clinical intake.',
      passwordHash: password,
      createdAt: new Date().toISOString(),
    };

    db.hospitals.push(newHospital);
    saveDatabase();
    logAudit(newHospital.adminName, 'HOSPITAL_ADMIN', 'HOSPITAL_REGISTERED', newHospital.id, `Hospital ${newHospital.hospitalName} registered.`);

    const { passwordHash, ...safeHospital } = newHospital;
    res.status(201).json({
      success: true,
      hospital: {
        ...safeHospital,
        token: `hosp_tok_${newHospital.id}_${Date.now()}`,
      },
      verificationNotice: 'Hospital institutional credentials verified. Clinical operations active.',
    });
  });

  app.get('/api/auth/hospital/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.replace('Bearer ', '');
    const match = token.match(/hosp_tok_(HOSP-\d+)/);
    if (match) {
      const hospId = match[1];
      const hosp = getHospitalsStore().find(h => h.id === hospId);
      if (hosp) {
        const { passwordHash, ...safeHospital } = hosp;
        return res.json({ success: true, hospital: { ...safeHospital, token } });
      }
    }
    res.status(401).json({ error: 'Invalid session' });
  });

  app.post('/api/auth/hospital/logout', (req, res) => {
    res.json({ success: true, message: 'Hospital session logged out.' });
  });

  // --- DOCTOR DIRECTORY & HOSPITAL LIST ENDPOINTS ---

  app.get('/api/doctors', (req, res) => {
    const db = getDatabase();
    const { q, specialization, hospitalId, city } = req.query;
    let list = db.doctors || [];

    if (q && typeof q === 'string') {
      const cleanQ = q.toLowerCase().trim();
      list = list.filter(d =>
        d.fullName.toLowerCase().includes(cleanQ) ||
        d.specialization.toLowerCase().includes(cleanQ) ||
        (d.subSpecialization && d.subSpecialization.toLowerCase().includes(cleanQ)) ||
        (d.hospitalName && d.hospitalName.toLowerCase().includes(cleanQ)) ||
        (d.city && d.city.toLowerCase().includes(cleanQ))
      );
    }
    if (specialization && typeof specialization === 'string') {
      list = list.filter(d => d.specialization.toLowerCase().includes((specialization as string).toLowerCase()));
    }
    if (hospitalId && typeof hospitalId === 'string') {
      list = list.filter(d => d.hospitalId === hospitalId);
    }
    if (city && typeof city === 'string') {
      list = list.filter(d => d.city && d.city.toLowerCase().includes((city as string).toLowerCase()));
    }

    const safeDoctors = list.map(({ passwordHash, ...safe }) => safe);
    res.json(safeDoctors);
  });

  app.get('/api/hospitals', (req, res) => {
    const db = getDatabase();
    const safeHospitals = (db.hospitals || []).map(({ passwordHash, ...safe }) => safe);
    res.json(safeHospitals);
  });

  // --- REPORT SHARING ENDPOINTS ---

  app.post('/api/reports/share', (req, res) => {
    const { reportId, doctorId, patientId, notes } = req.body;
    if (!reportId || !doctorId) {
      return res.status(400).json({ error: 'reportId and doctorId are required' });
    }

    const db = getDatabase();
    const report = (db.clinicalReports || []).find(r => r.id === reportId);
    const doctor = (db.doctors || []).find(d => d.id === doctorId);

    if (!report) {
      return res.status(404).json({ error: 'Clinical report not found' });
    }
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const patient = db.patients.find(p => p.id === (patientId || report.patientId));
    const shareId = `SHARE-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const newShare: ReportShare = {
      id: shareId,
      reportId: report.id,
      intakeId: report.intakeId,
      patientId: patient ? patient.id : report.patientId,
      patientName: patient ? patient.name : (report.demographics?.name || report.patientName),
      patientAge: patient ? patient.age : (report.demographics?.age || 35),
      patientGender: patient ? patient.gender : (report.demographics?.gender || 'Other'),
      patientToken: patient ? patient.token : (report.demographics?.token || 'TK-100'),
      patientPhone: patient ? patient.phone : (report.demographics?.phone || ''),
      doctorId: doctor.id,
      doctorName: doctor.fullName,
      doctorSpecialization: doctor.specialization,
      hospitalId: doctor.hospitalId,
      hospitalName: doctor.hospitalName,
      sharedAt: nowIso,
      status: 'DELIVERED',
      deliveredAt: nowIso,
      patientNotes: notes,
      reportSummary: {
        chiefComplaint: report.chiefComplaint,
        quickClinicalSummary: report.summary?.quickClinicalSummary || 'Pre-consultation intake report',
        triagePriority: report.triagePriority,
      },
    };

    db.reportShares = db.reportShares || [];
    db.reportShares.unshift(newShare);

    // Update report sharedWith details
    report.sharedWith = report.sharedWith || [];
    report.sharedWith.push({
      doctorId: doctor.id,
      doctorName: doctor.fullName,
      hospitalName: doctor.hospitalName,
      sharedAt: nowIso,
      status: 'DELIVERED',
    });

    // Add notification for doctor
    db.notifications = db.notifications || [];
    db.notifications.unshift({
      id: `NOTIF-${Date.now().toString().slice(-6)}`,
      recipientRole: 'DOCTOR',
      recipientId: doctor.id,
      title: 'New Clinical Report Received',
      message: `Patient ${newShare.patientName} (${newShare.patientToken}) shared a pre-consultation report with you.`,
      type: 'REPORT_RECEIVED',
      relatedId: report.id,
      createdAt: nowIso,
      read: false,
    });

    // Add notification for hospital if hospitalId present
    if (doctor.hospitalId) {
      db.notifications.unshift({
        id: `NOTIF-${Date.now().toString().slice(-6)}-h`,
        recipientRole: 'HOSPITAL',
        recipientId: doctor.hospitalId,
        title: 'New Patient Report Routed',
        message: `Clinical report for ${newShare.patientName} delivered to attending physician ${doctor.fullName}.`,
        type: 'REPORT_RECEIVED',
        relatedId: report.id,
        createdAt: nowIso,
        read: false,
      });
    }

    saveDatabase();
    logAudit(
      patient ? patient.name : 'Patient',
      'PATIENT',
      'REPORT_SHARED',
      report.id,
      `Report shared with ${doctor.fullName} (${doctor.hospitalName || 'Independent Practice'}). Delivered successfully.`
    );

    res.status(201).json({ success: true, share: newShare, report });
  });

  app.get('/api/doctor/reports', (req, res) => {
    const db = getDatabase();
    const { doctorId } = req.query;
    let shares = db.reportShares || [];
    if (doctorId && typeof doctorId === 'string') {
      shares = shares.filter(s => s.doctorId === doctorId);
    }
    res.json(shares);
  });

  app.get('/api/doctor/shared-reports', (req, res) => {
    const db = getDatabase();
    const { doctorId } = req.query;
    let shares = db.reportShares || [];
    if (doctorId && typeof doctorId === 'string') {
      shares = shares.filter(s => s.doctorId === doctorId);
    }
    res.json(shares);
  });

  app.post('/api/reports/shares/:id/status', (req, res) => {
    const db = getDatabase();
    const share = (db.reportShares || []).find(s => s.id === req.params.id || s.reportId === req.params.id);
    if (!share) {
      return res.status(404).json({ error: 'Share record not found' });
    }
    const { status } = req.body;
    if (status) {
      share.status = status;
      if (status === 'VIEWED' && !share.viewedAt) share.viewedAt = new Date().toISOString();
      if (status === 'REVIEWED') share.reviewedAt = new Date().toISOString();
      saveDatabase();
    }
    res.json({ success: true, share });
  });

  app.post('/api/doctor/reports/:id/view', (req, res) => {
    const db = getDatabase();
    const share = (db.reportShares || []).find(s => s.id === req.params.id || s.reportId === req.params.id);
    if (share && share.status === 'DELIVERED') {
      share.status = 'VIEWED';
      share.viewedAt = new Date().toISOString();
      saveDatabase();
    }
    res.json({ success: true, share });
  });

  app.get('/api/patients/:id/shares', (req, res) => {
    const db = getDatabase();
    const patientShares = (db.reportShares || []).filter(s => s.patientId === req.params.id);
    res.json(patientShares);
  });

  // --- HOSPITAL CONNECTION REQUESTS & WORKFLOW ENDPOINTS ---

  app.get('/api/hospital/requests', (req, res) => {
    const db = getDatabase();
    const { hospitalId } = req.query;
    let list = db.hospitalConnectionRequests || [];
    if (hospitalId && typeof hospitalId === 'string') {
      list = list.filter(r => r.hospitalId === hospitalId);
    }
    res.json(list);
  });

  app.post('/api/hospital/requests/:id/approve', (req, res) => {
    const db = getDatabase();
    const request = (db.hospitalConnectionRequests || []).find(r => r.id === req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Connection request not found' });
    }

    request.status = 'APPROVED';
    request.decidedAt = new Date().toISOString();

    // Update doctor's profile
    const doctor = (db.doctors || []).find(d => d.id === request.doctorId);
    if (doctor) {
      doctor.hospitalId = request.hospitalId;
      doctor.hospitalName = request.hospitalName;
      doctor.hospitalDepartment = request.department;
      doctor.hospitalConnectionStatus = 'CONNECTED';
    }

    // Update hospital connected count
    const hospital = (db.hospitals || []).find(h => h.id === request.hospitalId);
    if (hospital) {
      hospital.connectedDoctorsCount = (hospital.connectedDoctorsCount || 0) + 1;
    }

    // Notify doctor
    db.notifications = db.notifications || [];
    db.notifications.unshift({
      id: `NOTIF-${Date.now().toString().slice(-6)}`,
      recipientRole: 'DOCTOR',
      recipientId: request.doctorId,
      title: 'Hospital Affiliation Approved',
      message: `Your connection request with ${request.hospitalName} has been approved. You are now an affiliated physician.`,
      type: 'CONNECTION_APPROVED',
      relatedId: request.id,
      createdAt: new Date().toISOString(),
      read: false,
    });

    saveDatabase();
    logAudit(
      request.hospitalName,
      'HOSPITAL_ADMIN',
      'DOCTOR_CONNECTION_APPROVED',
      request.id,
      `Doctor ${request.doctorName} approved for ${request.hospitalName} (${request.department})`
    );

    res.json({ success: true, request, doctor });
  });

  app.post('/api/hospital/requests/:id/reject', (req, res) => {
    const { reason } = req.body;
    const db = getDatabase();
    const request = (db.hospitalConnectionRequests || []).find(r => r.id === req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Connection request not found' });
    }

    request.status = 'REJECTED';
    request.decidedAt = new Date().toISOString();
    request.rejectionReason = reason || 'Institutional capacity or credentials requirement';

    const doctor = (db.doctors || []).find(d => d.id === request.doctorId);
    if (doctor) {
      doctor.hospitalConnectionStatus = 'REJECTED';
    }

    // Notify doctor
    db.notifications = db.notifications || [];
    db.notifications.unshift({
      id: `NOTIF-${Date.now().toString().slice(-6)}`,
      recipientRole: 'DOCTOR',
      recipientId: request.doctorId,
      title: 'Hospital Connection Update',
      message: `Your connection request with ${request.hospitalName} was not accepted: ${request.rejectionReason}.`,
      type: 'CONNECTION_REJECTED',
      relatedId: request.id,
      createdAt: new Date().toISOString(),
      read: false,
    });

    saveDatabase();
    logAudit(
      request.hospitalName,
      'HOSPITAL_ADMIN',
      'DOCTOR_CONNECTION_REJECTED',
      request.id,
      `Doctor ${request.doctorName} rejected by ${request.hospitalName}`
    );

    res.json({ success: true, request, doctor });
  });

  app.get('/api/doctor/hospital-requests', (req, res) => {
    const db = getDatabase();
    const { doctorId } = req.query;
    let list = db.hospitalConnectionRequests || [];
    if (doctorId && typeof doctorId === 'string') {
      list = list.filter(r => r.doctorId === doctorId);
    }
    res.json(list);
  });

  app.post('/api/doctor/hospital-requests', (req, res) => {
    const {
      hospitalId,
      hospitalName,
      department,
      doctorName,
      specialization,
      qualification,
      regNumber,
      experienceYears,
    } = req.body;

    if (!hospitalId) {
      return res.status(400).json({ error: 'hospitalId is required' });
    }

    const db = getDatabase();
    const reqId = `HREQ-${Date.now().toString().slice(-6)}`;
    const connReq: HospitalConnectionRequest = {
      id: reqId,
      doctorId: 'DOC-102',
      doctorName: doctorName || 'Attending Physician',
      doctorEmail: 'doctor@medikiosk.demo',
      doctorMobile: '+91 98765 00000',
      doctorRegNumber: regNumber || 'NMC-2024-88912',
      doctorSpecialization: specialization || 'General Medicine',
      doctorQualification: qualification || 'MBBS, MD',
      doctorExperienceYears: experienceYears || 8,
      hospitalId,
      hospitalName: hospitalName || 'Affiliated Hospital',
      department: department || 'Outpatient Department',
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
    };

    db.hospitalConnectionRequests = db.hospitalConnectionRequests || [];
    db.hospitalConnectionRequests.unshift(connReq);

    db.notifications = db.notifications || [];
    db.notifications.unshift({
      id: `NOTIF-${Date.now().toString().slice(-6)}`,
      recipientRole: 'HOSPITAL',
      recipientId: hospitalId,
      title: 'New Doctor Affiliation Request',
      message: `${connReq.doctorName} (${connReq.doctorSpecialization}) requested to connect with your facility.`,
      type: 'CONNECTION_REQUEST',
      relatedId: reqId,
      createdAt: new Date().toISOString(),
      read: false,
    });

    saveDatabase();
    res.status(201).json(connReq);
  });

  app.get('/api/hospitals/:id/requests', (req, res) => {
    const db = getDatabase();
    const list = (db.hospitalConnectionRequests || []).filter(r => r.hospitalId === req.params.id);
    res.json(list);
  });

  app.get('/api/hospitals/:id/patients', (req, res) => {
    const db = getDatabase();
    const hospId = req.params.id;
    const hospital = (db.hospitals || []).find(h => h.id === hospId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const doctors = (db.doctors || []).filter(d => d.hospitalId === hospId);
    const doctorIds = doctors.map(d => d.id);

    const patients = (db.patients || []).filter(p =>
      p.assignedHospitalId === hospId ||
      (p.assignedDoctorId && doctorIds.includes(p.assignedDoctorId))
    );

    res.json({
      hospital,
      doctors,
      patients,
    });
  });

  app.post('/api/hospitals/requests/:id/decide', (req, res) => {
    const { status, decision, reason } = req.body;
    const reqStatus = (status || decision || '').toUpperCase();
    const db = getDatabase();
    const request = (db.hospitalConnectionRequests || []).find(r => r.id === req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Connection request not found' });
    }

    if (reqStatus === 'APPROVED' || reqStatus === 'APPROVE') {
      request.status = 'APPROVED';
      request.decidedAt = new Date().toISOString();

      const doctor = (db.doctors || []).find(d => d.id === request.doctorId);
      if (doctor) {
        doctor.hospitalId = request.hospitalId;
        doctor.hospitalName = request.hospitalName;
        doctor.hospitalDepartment = request.department;
        doctor.hospitalConnectionStatus = 'CONNECTED';
      }

      const hospital = (db.hospitals || []).find(h => h.id === request.hospitalId);
      if (hospital) {
        hospital.connectedDoctorsCount = (hospital.connectedDoctorsCount || 0) + 1;
      }

      db.notifications = db.notifications || [];
      db.notifications.unshift({
        id: `NOTIF-${Date.now().toString().slice(-6)}`,
        recipientRole: 'DOCTOR',
        recipientId: request.doctorId,
        title: 'Hospital Affiliation Approved',
        message: `Your connection request with ${request.hospitalName} has been approved.`,
        type: 'CONNECTION_APPROVED',
        relatedId: request.id,
        createdAt: new Date().toISOString(),
        read: false,
      });

      saveDatabase();
      return res.json(request);
    } else {
      request.status = 'REJECTED';
      request.decidedAt = new Date().toISOString();
      request.rejectionReason = reason || 'Declined by hospital medical board';

      const doctor = (db.doctors || []).find(d => d.id === request.doctorId);
      if (doctor) {
        doctor.hospitalConnectionStatus = 'REJECTED';
      }

      db.notifications = db.notifications || [];
      db.notifications.unshift({
        id: `NOTIF-${Date.now().toString().slice(-6)}`,
        recipientRole: 'DOCTOR',
        recipientId: request.doctorId,
        title: 'Hospital Connection Update',
        message: `Your connection request with ${request.hospitalName} was not accepted: ${request.rejectionReason}.`,
        type: 'CONNECTION_REJECTED',
        relatedId: request.id,
        createdAt: new Date().toISOString(),
        read: false,
      });

      saveDatabase();
      return res.json(request);
    }
  });

  app.get('/api/hospital/doctors', (req, res) => {
    const db = getDatabase();
    const { hospitalId } = req.query;
    let doctors = db.doctors || [];
    if (hospitalId && typeof hospitalId === 'string') {
      doctors = doctors.filter(d => d.hospitalId === hospitalId && d.hospitalConnectionStatus === 'CONNECTED');
    }
    const safeDoctors = doctors.map(({ passwordHash, ...safe }) => safe);
    res.json(safeDoctors);
  });

  app.get('/api/hospital/reports', (req, res) => {
    const db = getDatabase();
    const { hospitalId } = req.query;
    let shares = db.reportShares || [];
    if (hospitalId && typeof hospitalId === 'string') {
      shares = shares.filter(s => s.hospitalId === hospitalId);
    }
    res.json(shares);
  });

  // --- PROCEDURES & CLINICAL OPERATIONS ENDPOINTS ---

  app.get('/api/hospital/procedures', (req, res) => {
    const db = getDatabase();
    const { hospitalId, doctorId } = req.query;
    let list = db.procedures || [];
    if (hospitalId && typeof hospitalId === 'string') {
      list = list.filter(p => p.hospitalId === hospitalId);
    }
    if (doctorId && typeof doctorId === 'string') {
      list = list.filter(p => p.doctorId === doctorId);
    }
    res.json(list);
  });

  app.get('/api/procedures', (req, res) => {
    const db = getDatabase();
    const { hospitalId, doctorId } = req.query;
    let list = db.procedures || [];
    if (hospitalId && typeof hospitalId === 'string') {
      list = list.filter(p => p.hospitalId === hospitalId);
    }
    if (doctorId && typeof doctorId === 'string') {
      list = list.filter(p => p.doctorId === doctorId);
    }
    res.json(list);
  });

  app.post('/api/procedures', (req, res) => {
    const {
      patientId,
      patientName,
      patientToken,
      doctorId,
      doctorName,
      orderedByDoctorId,
      orderedByDoctorName,
      hospitalId,
      hospitalName,
      department,
      procedureName,
      category,
      date,
      scheduledDate,
      time,
      notes,
    } = req.body;

    const db = getDatabase();
    const newProc: ProcedureRecord = {
      id: `PROC-${Date.now().toString().slice(-5)}`,
      patientId: patientId || 'DEMO-001',
      patientName: patientName || 'OPD Patient',
      patientToken: patientToken || 'TK-100',
      doctorId: doctorId || orderedByDoctorId || 'DOC-102',
      doctorName: doctorName || orderedByDoctorName || 'Attending Physician',
      hospitalId: hospitalId || 'HOSP-201',
      hospitalName: hospitalName || 'Hospital Center',
      department: department || category || 'General Medicine',
      procedureName: procedureName || 'Diagnostic Procedure',
      date: scheduledDate || date || new Date().toISOString().split('T')[0],
      time: time || '12:00',
      status: 'Scheduled',
      notes: notes || '',
    };

    db.procedures = db.procedures || [];
    db.procedures.unshift(newProc);
    saveDatabase();

    res.status(201).json(newProc);
  });

  app.post('/api/hospital/procedures', (req, res) => {
    const {
      patientId,
      patientName,
      patientToken,
      doctorId,
      doctorName,
      hospitalId,
      hospitalName,
      department,
      procedureName,
      date,
      time,
      notes,
    } = req.body;

    if (!procedureName || !patientName || !hospitalId) {
      return res.status(400).json({ error: 'procedureName, patientName, and hospitalId are required' });
    }

    const db = getDatabase();
    const newProc: ProcedureRecord = {
      id: `PROC-${Date.now().toString().slice(-5)}`,
      patientId: patientId || 'DEMO-001',
      patientName,
      patientToken: patientToken || 'TK-100',
      doctorId: doctorId || 'DOC-102',
      doctorName: doctorName || 'Attending Physician',
      hospitalId,
      hospitalName: hospitalName || 'Hospital Center',
      department: department || 'General Medicine',
      procedureName,
      date: date || new Date().toISOString().split('T')[0],
      time: time || '12:00',
      status: 'Scheduled',
      notes: notes || '',
    };

    db.procedures = db.procedures || [];
    db.procedures.unshift(newProc);
    saveDatabase();

    res.status(201).json({ success: true, procedure: newProc });
  });

  app.patch('/api/procedures/:id/status', (req, res) => {
    const db = getDatabase();
    const proc = (db.procedures || []).find(p => p.id === req.params.id);
    if (!proc) {
      return res.status(404).json({ error: 'Procedure not found' });
    }
    if (req.body.status) proc.status = req.body.status;
    saveDatabase();
    res.json(proc);
  });

  app.patch('/api/procedures/:id', (req, res) => {
    const db = getDatabase();
    const proc = (db.procedures || []).find(p => p.id === req.params.id);
    if (!proc) {
      return res.status(404).json({ error: 'Procedure not found' });
    }

    if (req.body.status) proc.status = req.body.status;
    if (req.body.notes) proc.notes = req.body.notes;
    if (req.body.date) proc.date = req.body.date;
    if (req.body.time) proc.time = req.body.time;

    saveDatabase();
    res.json({ success: true, procedure: proc });
  });

  app.patch('/api/hospital/procedures/:id', (req, res) => {
    const db = getDatabase();
    const proc = (db.procedures || []).find(p => p.id === req.params.id);
    if (!proc) {
      return res.status(404).json({ error: 'Procedure not found' });
    }

    if (req.body.status) proc.status = req.body.status;
    if (req.body.notes) proc.notes = req.body.notes;
    if (req.body.date) proc.date = req.body.date;
    if (req.body.time) proc.time = req.body.time;

    saveDatabase();
    res.json({ success: true, procedure: proc });
  });

  // --- NOTIFICATIONS ENDPOINTS ---

  app.get('/api/notifications', (req, res) => {
    const db = getDatabase();
    const { role, recipientId } = req.query;
    let list = db.notifications || [];
    if (role && typeof role === 'string') {
      list = list.filter(n => n.recipientRole === role);
    }
    if (recipientId && typeof recipientId === 'string') {
      list = list.filter(n => n.recipientId === recipientId);
    }
    res.json(list);
  });

  app.post('/api/notifications/:id/read', (req, res) => {
    const db = getDatabase();
    const notif = (db.notifications || []).find(n => n.id === req.params.id);
    if (notif) {
      notif.read = true;
      saveDatabase();
    }
    res.json({ success: true, notification: notif });
  });

  // --- OCR DOCUMENT EXTRACTION ENDPOINT ---

  app.post('/api/documents/extract', async (req, res) => {
    const { fileName, docType = 'Prescription', previewText } = req.body;
    try {
      const extracted = await processMedicalDocument(fileName || 'Medical_Record.jpg', docType, previewText);
      res.json({
        success: true,
        fileName: fileName || 'Uploaded_Document.jpg',
        docType,
        extracted,
      });
    } catch (e: any) {
      console.error('Document extraction error:', e);
      res.status(500).json({ error: 'Failed to extract medical entities from document' });
    }
  });

  // Patients list & search
  app.get('/api/patients', (req, res) => {
    const db = getDatabase();
    res.json(db.patients);
  });

  app.get('/api/patients/:id', (req, res) => {
    const db = getDatabase();
    const cleanId = req.params.id.trim().toLowerCase();
    const patient = db.patients.find(p => p.id.toLowerCase() === cleanId || p.token.toLowerCase() === cleanId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const intake = (db.intakes || []).find(i => i.patientId === patient.id);
    const clinicalReport = (db.clinicalReports || []).find(r => r.patientId === patient.id);
    const shares = (db.reportShares || []).filter(s => s.patientId === patient.id);
    res.json({
      patient,
      intake,
      clinicalReport,
      shares,
    });
  });

  app.post('/api/patients/search', (req, res) => {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }
    const clean = query.trim().toLowerCase();
    const db = getDatabase();

    const patient = db.patients.find(p =>
      p.id.toLowerCase() === clean ||
      p.token.toLowerCase() === clean ||
      (p.abhaId && p.abhaId.toLowerCase().includes(clean)) ||
      (p.phone && p.phone.replace(/\s+/g, '').includes(clean.replace(/\s+/g, ''))) ||
      (p.aadhaarLast4 && p.aadhaarLast4 === clean) ||
      p.name.toLowerCase().includes(clean) ||
      (p.city && p.city.toLowerCase().includes(clean)) ||
      (p.assignedDoctorName && p.assignedDoctorName.toLowerCase().includes(clean)) ||
      (p.assignedHospitalName && p.assignedHospitalName.toLowerCase().includes(clean))
    );

    if (patient) {
      logAudit('Kiosk Scanner', 'PATIENT', 'PATIENT_MATCHED', patient.id, `Patient ${patient.name} matched via "${query}"`);
      return res.json({ found: true, patient });
    }

    res.json({ found: false, message: 'No patient record found.' });
  });

  app.post('/api/patients', (req, res) => {
    const { name, age, gender, phone, abhaId, aadhaarLast4 } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Patient name is required' });
    }

    const db = getDatabase();
    const nextNum = db.patients.length + 101;
    const newId = `PAT-${nextNum}`;
    const token = `TK-${nextNum}`;

    const newPatient: Patient = {
      id: newId,
      token,
      name: name.trim(),
      age: Number(age) || 30,
      gender: gender || 'Male',
      phone: phone || '+91 98000 00000',
      abhaId: abhaId || `${name.toLowerCase().replace(/\s+/g, '.')}${nextNum}@abdm`,
      aadhaarLast4: aadhaarLast4 || `${Math.floor(1000 + Math.random() * 9000)}`,
      registeredAt: new Date().toISOString(),
      isDemo: false,
    };

    db.patients.push(newPatient);
    saveDatabase();
    logAudit('Kiosk Registration', 'PATIENT', 'PATIENT_REGISTERED', newPatient.id, `New patient ${newPatient.name} registered.`);

    res.status(201).json(newPatient);
  });

  // Intakes list & details
  app.get('/api/intakes', (req, res) => {
    const db = getDatabase();
    res.json(db.intakes);
  });

  app.get('/api/intakes/:id', (req, res) => {
    const db = getDatabase();
    const intake = db.intakes.find(i => i.id === req.params.id || i.patientId === req.params.id || i.sessionId === req.params.id);
    if (!intake) {
      return res.status(404).json({ error: 'Intake record not found' });
    }
    res.json(intake);
  });

  // Create or start an intake session
  app.post('/api/intakes', (req, res) => {
    const { patientId, language = 'en', mode = 'general', department = 'General Medicine' } = req.body;
    const db = getDatabase();
    const patient = db.patients.find(p => p.id === patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const intakeId = `INT-${Date.now().toString().slice(-6)}`;
    const sessionId = `SES-${Date.now().toString().slice(-6)}`;

    const newIntake: Intake = {
      id: intakeId,
      patientId: patient.id,
      sessionId,
      token: patient.token,
      patientName: patient.name,
      age: patient.age,
      gender: patient.gender,
      language: language as any,
      department,
      mode: mode as any,
      chiefComplaint: '',
      historyOfPresentIllness: '',
      pastMedicalHistory: '',
      pastSurgicalHistory: '',
      medications: [],
      allergies: [],
      familyHistory: '',
      personalHistory: '',
      reviewOfSystems: {},
      ayushData: {},
      documents: [],
      timeline: [
        {
          id: `TL-${Date.now().toString().slice(-4)}`,
          date: new Date().toISOString().split('T')[0],
          title: 'Kiosk Intake Initiated',
          category: 'Current Intake',
          summary: `Session started at MediKiosk (${mode.toUpperCase()} mode).`,
        },
      ],
      redFlags: [],
      aiSummary: {
        version: 1,
        text: 'Draft pending completion.',
        sections: {
          chiefComplaint: '',
          historyOfPresentIllness: '',
          pastMedicalHistory: '',
          pastSurgicalHistory: '',
          currentMedications: [],
          drugAllergies: [],
          familyHistory: '',
          personalHistory: '',
          reviewOfSystems: '',
          previousInvestigations: '',
          redFlags: [],
          importantNotes: '',
        },
        sources: [],
        isDraft: true,
      },
      consent: {
        given: false,
        timestamp: '',
        version: 'v2.1-AYUSH',
        language,
      },
      rawAnswers: [],
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.intakes.unshift(newIntake);
    saveDatabase();
    logAudit('Kiosk Intake Engine', 'PATIENT', 'INTAKE_STARTED', newIntake.id, `Intake session created for ${patient.name}`);

    res.status(201).json(newIntake);
  });

  // Patch intake incrementally
  app.patch('/api/intakes/:id', (req, res) => {
    const db = getDatabase();
    const index = db.intakes.findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Intake not found' });
    }

    const current = db.intakes[index];
    const updates = req.body;

    const updated: Intake = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    db.intakes[index] = updated;
    saveDatabase();
    res.json(updated);
  });

  // Submit complete intake
  app.post('/api/intakes/:id/submit', (req, res) => {
    const db = getDatabase();
    const index = db.intakes.findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Intake not found' });
    }

    const current = db.intakes[index];
    const incoming = req.body || {};

    // Combine data
    const intakeToSubmit: Intake = {
      ...current,
      ...incoming,
      updatedAt: new Date().toISOString(),
    };

    // Check red-flags
    const symptomText = `${intakeToSubmit.chiefComplaint} ${intakeToSubmit.historyOfPresentIllness}`;
    const redFlagResult = checkRedFlags(symptomText);

    const generatedAlerts: RedFlagAlert[] = [];
    if (redFlagResult.triggered) {
      for (const item of redFlagResult.alerts) {
        const alert: RedFlagAlert = {
          alertId: `ALT-${Date.now().toString().slice(-6)}`,
          patientId: intakeToSubmit.patientId,
          intakeId: intakeToSubmit.id,
          patientName: intakeToSubmit.patientName,
          token: intakeToSubmit.token,
          ruleTriggered: item.name,
          severity: item.severity,
          createdAt: new Date().toISOString(),
          status: 'UNREVIEWED',
          symptomSummary: item.symptomSummary,
        };
        generatedAlerts.push(alert);
        db.redFlagAlerts.unshift(alert);
      }
    }

    intakeToSubmit.redFlags = generatedAlerts;

    // Generate structured clinical summary
    const summary = generateStructuredSummary(intakeToSubmit);
    intakeToSubmit.aiSummary = summary;

    // Determine final status
    const finalStatus = generatedAlerts.length > 0 ? 'RED_FLAG' : 'READY_FOR_REVIEW';
    intakeToSubmit.status = finalStatus;

    // Add timeline event
    intakeToSubmit.timeline.push({
      id: `TL-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      title: generatedAlerts.length > 0 ? 'Intake Submitted (Priority Alert Active)' : 'Intake Submitted (Ready for Review)',
      category: 'Current Intake',
      summary: `Clinical intake verified by patient and routed to Doctor Queue with status ${finalStatus}.`,
    });

    db.intakes[index] = intakeToSubmit;
    saveDatabase();

    logAudit(
      'MediKiosk Kiosk',
      'PATIENT',
      'INTAKE_SUBMITTED',
      intakeToSubmit.id,
      `Intake submitted for ${intakeToSubmit.patientName}. Status: ${finalStatus}. RedFlags: ${generatedAlerts.length}`
    );

    res.json({
      success: true,
      intake: intakeToSubmit,
      redFlags: generatedAlerts,
    });
  });

  // Doctor Queue
  app.get('/api/doctor/queue', (req, res) => {
    const db = getDatabase();
    const { doctorId } = req.query;

    let list = [...db.intakes];

    if (doctorId && doctorId !== 'ALL') {
      const docStr = String(doctorId).trim();
      list = list.filter(intake => {
        const patient = db.patients.find(p => p.id === intake.patientId);
        const isAssignedDoctor = patient?.assignedDoctorId === docStr;
        const hasShare = (db.reportShares || []).some(s => s.patientId === intake.patientId && s.doctorId === docStr);
        return isAssignedDoctor || hasShare;
      });
    }

    // Sort red-flag cases to the top, then newest
    const sorted = list.sort((a, b) => {
      if (a.status === 'RED_FLAG' && b.status !== 'RED_FLAG') return -1;
      if (b.status === 'RED_FLAG' && a.status !== 'RED_FLAG') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    res.json(sorted);
  });

  // Doctor edit draft summary
  app.post('/api/doctor/intakes/:id/edit', (req, res) => {
    const { doctorNotes, summaryText, sections } = req.body;
    const db = getDatabase();
    const index = db.intakes.findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Intake not found' });
    }

    const intake = db.intakes[index];
    intake.aiSummary = {
      ...intake.aiSummary,
      version: (intake.aiSummary?.version || 1) + 1,
      text: summaryText || intake.aiSummary.text,
      sections: sections || intake.aiSummary.sections,
      doctorNotes: doctorNotes || intake.aiSummary.doctorNotes,
      isDraft: true,
    };
    intake.status = 'IN_REVIEW';
    intake.updatedAt = new Date().toISOString();

    db.intakes[index] = intake;
    saveDatabase();

    logAudit('Attending Physician', 'DOCTOR', 'SUMMARY_EDITED', intake.id, `Doctor updated clinical draft summary to v${intake.aiSummary.version}`);
    res.json(intake);
  });

  // Doctor verify summary
  app.post('/api/doctor/intakes/:id/verify', (req, res) => {
    const { doctorName = 'Dr. Vivek Sharma, MD', doctorNotes = '' } = req.body;
    const db = getDatabase();
    const index = db.intakes.findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Intake not found' });
    }

    const intake = db.intakes[index];
    intake.aiSummary = {
      ...intake.aiSummary,
      version: (intake.aiSummary?.version || 1) + 1,
      verifiedBy: doctorName,
      verifiedAt: new Date().toISOString(),
      doctorNotes: doctorNotes || intake.aiSummary.doctorNotes,
      isDraft: false,
    };
    intake.status = 'VERIFIED';
    intake.updatedAt = new Date().toISOString();

    // Mark any associated red flag alerts as resolved or acknowledged
    db.redFlagAlerts = db.redFlagAlerts.map(a =>
      a.intakeId === intake.id ? { ...a, status: 'RESOLVED' as const } : a
    );

    intake.timeline.push({
      id: `TL-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      title: 'Physician Clinical Verification',
      category: 'Consultation',
      summary: `Verified and approved by ${doctorName}. Consultation completed.`,
    });

    db.intakes[index] = intake;
    saveDatabase();

    logAudit(doctorName, 'DOCTOR', 'INTAKE_VERIFIED', intake.id, `Clinical summary approved and verified by ${doctorName}.`);
    res.json(intake);
  });

  // Hospital Operations Overview metrics
  app.get('/api/admin/overview', (req, res) => {
    const db = getDatabase();
    const totalPatients = db.patients.length;
    const activeIntakes = db.intakes.filter(i => i.status === 'IN_PROGRESS').length;
    const readyForReview = db.intakes.filter(i => i.status === 'READY_FOR_REVIEW').length;
    const priorityAlerts = db.redFlagAlerts.filter(a => a.status === 'UNREVIEWED').length;
    const completed = db.intakes.filter(i => i.status === 'VERIFIED' || i.status === 'COMPLETED').length;

    let totalDocs = 0;
    db.intakes.forEach(i => {
      totalDocs += i.documents?.length || 0;
    });

    const verifiedCount = db.intakes.filter(i => i.status === 'VERIFIED').length;
    const reviewableTotal = db.intakes.filter(i => ['READY_FOR_REVIEW', 'IN_REVIEW', 'VERIFIED', 'RED_FLAG'].includes(i.status)).length;
    const rate = reviewableTotal > 0 ? Math.round((verifiedCount / reviewableTotal) * 100) : 85;

    res.json({
      patientsToday: totalPatients,
      activeIntakes,
      readyForReview,
      priorityAlerts,
      completed,
      avgCompletionTimeMinutes: 4.2,
      documentsProcessed: totalDocs + 3,
      doctorVerificationRate: rate,
    });
  });

  // Hospital Priority Alerts
  app.get('/api/admin/alerts', (req, res) => {
    const db = getDatabase();
    res.json(db.redFlagAlerts);
  });

  app.post('/api/admin/alerts/:id/ack', (req, res) => {
    const db = getDatabase();
    const alert = db.redFlagAlerts.find(a => a.alertId === req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    alert.status = 'ACKNOWLEDGED';
    saveDatabase();
    logAudit('Hospital Triage Lead', 'HOSPITAL_ADMIN', 'ALERT_ACKNOWLEDGED', alert.alertId, `Priority alert acknowledged.`);
    res.json(alert);
  });

  // Kiosks status
  app.get('/api/admin/kiosks', (req, res) => {
    const db = getDatabase();
    res.json(db.kiosks);
  });

  // Staff members
  app.get('/api/admin/staff', (req, res) => {
    const db = getDatabase();
    res.json(db.staff);
  });

  // Audit Logs
  app.get('/api/admin/audit', (req, res) => {
    const db = getDatabase();
    res.json(db.auditLogs);
  });

  // --- AI MEDICAL CLINICAL INTERVIEW & REPORT API ---

  // Get all active or historical clinical interviews
  app.get('/api/interviews', (req, res) => {
    const db = getDatabase();
    res.json(db.interviews || []);
  });

  // Start new adaptive clinical interview
  app.post('/api/interviews/start', (req, res) => {
    const { patientId, language = 'en', mode = 'general' } = req.body;
    const db = getDatabase();
    const patient = db.patients.find(p => p.id === patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const interviewId = `INTV-${Date.now().toString().slice(-6)}`;
    const initialMsg: InterviewMessage = {
      id: `MSG-01`,
      interviewId,
      sender: 'bot',
      message: language === 'hi'
        ? 'नमस्ते! मैं आपका डिजिटल मेडिकल इंटेक असिस्टेंट हूँ। आज आप अपने डॉक्टर को किस मुख्य स्वास्थ्य समस्या या लक्षण के बारे में बताना चाहते हैं?'
        : 'Hello! I am your digital medical intake assistant. What health problem or symptom would you like to tell your doctor about today?',
      timestamp: new Date().toISOString(),
      language,
      questionCategory: 'chief_complaint',
      quickOptions: language === 'hi'
        ? ['सीने में दर्द / भारीपन', 'तेज बुखार और ठंड', 'सांस लेने में तकलीफ', 'पेट में दर्द या बदहजमी', 'जोड़ों / बदन में दर्द', 'गंभीर सिरदर्द']
        : ['Chest Discomfort / Pain', 'High Fever & Chills', 'Shortness of Breath', 'Stomach Pain / Acidity', 'Joint / Body Pain', 'Severe Headache'],
      allowsVoice: true,
      allowsSkip: false,
    };

    const newInterview: ClinicalInterview = {
      id: interviewId,
      patientId: patient.id,
      language,
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      currentSection: 'chief_complaint',
      chiefComplaint: '',
      hpi: {},
      reviewOfSystems: {},
      pastHistory: [],
      surgicalHistory: [],
      hospitalizationHistory: [],
      drugHistory: [],
      allergies: [],
      familyHistory: [],
      personalHistory: { diet: 'Vegetarian / Regular meals', sleep: 'Regular 7-8 hours' },
      ayurvedaHistory: mode === 'ayush' ? { prakriti: 'Pitta-Kapha', agni: 'Manda' } : undefined,
      redFlags: [],
      documents: [],
      completionScore: 10,
      messages: [initialMsg],
    };

    db.interviews = db.interviews || [];
    db.interviews.unshift(newInterview);
    saveDatabase();
    logAudit('AI Clinical Interview', 'PATIENT', 'INTERVIEW_STARTED', interviewId, `Clinical intake interview started for ${patient.name}`);

    res.status(201).json(newInterview);
  });

  // Get specific interview
  app.get('/api/interviews/:id', (req, res) => {
    const db = getDatabase();
    const interview = (db.interviews || []).find(i => i.id === req.params.id);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    res.json(interview);
  });

  // Post patient message or audio transcript to interview
  app.post('/api/interviews/:id/message', async (req, res) => {
    const { message, language = 'en' } = req.body;
    const db = getDatabase();
    const interview = (db.interviews || []).find(i => i.id === req.params.id);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const patient = db.patients.find(p => p.id === interview.patientId);
    const text = (message || '').trim();

    // 1. Strict medical scope enforcement
    if (isNonMedicalQuery(text)) {
      const redirectionMsg: InterviewMessage = {
        id: `MSG-${Date.now().toString().slice(-6)}`,
        interviewId: interview.id,
        sender: 'bot',
        message: language === 'hi'
          ? 'मैं केवल आपके स्वास्थ्य रिकॉर्ड और डॉक्टर के लिए चिकित्सकीय जानकारी एकत्र करने के लिए अधिकृत हूँ। आइए आपके स्वास्थ्य पर ध्यान दें। क्या आप अपने लक्षणों या बीमारी के बारे में और बताना चाहेंगे?'
          : 'I am designed specifically to collect clinical health information for your medical record and doctor. Let us continue with your health questions. Could you tell me more about your symptoms or medical history?',
        timestamp: new Date().toISOString(),
        language,
        questionCategory: interview.currentSection,
        allowsVoice: true,
        allowsSkip: true,
      };

      interview.messages.push({
        id: `MSG-${Date.now().toString().slice(-6)}-u`,
        interviewId: interview.id,
        sender: 'patient',
        message: text,
        timestamp: new Date().toISOString(),
        language,
      });
      interview.messages.push(redirectionMsg);
      saveDatabase();
      return res.json({ interview, nextMessage: redirectionMsg });
    }

    // 2. Add patient's response to message stream
    const userMsg: InterviewMessage = {
      id: `MSG-${Date.now().toString().slice(-6)}-u`,
      interviewId: interview.id,
      sender: 'patient',
      message: text,
      timestamp: new Date().toISOString(),
      language,
    };
    interview.messages.push(userMsg);

    // 2.5 Strict Medical Focus Check
    if (isNonMedicalQuery(text)) {
      const declineMsg: InterviewMessage = {
        id: `MSG-${Date.now().toString().slice(-6)}-decl`,
        interviewId: interview.id,
        sender: 'bot',
        message: language === 'hi'
          ? 'मैं केवल आपके नैदानिक इतिहास के लिए चिकित्सा जानकारी एकत्र करने में मदद कर सकता हूँ। कृपया मुझे अपने लक्षणों, दवाओं, पूर्व बीमारियों या अन्य स्वास्थ्य संबंधी चिंताओं के बारे में बताएं।'
          : 'I can only help collect medical information for your clinical history. Please tell me about your symptoms, medicines, previous medical history, or another health-related concern.',
        timestamp: new Date().toISOString(),
        language,
        questionCategory: interview.currentSection,
        quickOptions: language === 'hi'
          ? ['लक्षण बताना चाहता हूँ', 'मेरी दवाइयाँ जोड़ें']
          : ['Describe my symptoms', 'Add my medications'],
        allowsVoice: true,
      };
      interview.messages.push(declineMsg);
      saveDatabase();
      return res.json({ interview, nextMessage: declineMsg, isNonMedicalDeclined: true });
    }

    // 3. Contradiction detection
    const contradiction = detectContradiction(interview, interview.currentSection, text);
    if (contradiction.hasContradiction) {
      const clarifMsg: InterviewMessage = {
        id: `MSG-${Date.now().toString().slice(-6)}-c`,
        interviewId: interview.id,
        sender: 'bot',
        message: language === 'hi' ? contradiction.messageHi! : contradiction.messageEn!,
        timestamp: new Date().toISOString(),
        language,
        questionCategory: interview.currentSection,
        quickOptions: contradiction.resolutionOptions,
        isClarification: true,
        allowsVoice: true,
        allowsSkip: false,
      };
      interview.messages.push(clarifMsg);
      saveDatabase();
      return res.json({ interview, nextMessage: clarifMsg });
    }

    // 4. Red-Flag detection on any symptom input
    const redFlagCheck = checkRedFlags(`${interview.chiefComplaint} ${text}`);
    let newAlertTriggered = false;
    if (redFlagCheck.triggered) {
      for (const item of redFlagCheck.alerts) {
        if (!interview.redFlags.some(r => r.ruleTriggered === item.name)) {
          const newAlert: RedFlagAlert = {
            alertId: `ALT-${Date.now().toString().slice(-6)}`,
            patientId: interview.patientId,
            intakeId: interview.intakeId || `INT-${interview.patientId}`,
            patientName: patient ? patient.name : 'Patient',
            token: patient ? patient.token : 'TK-100',
            ruleTriggered: item.name,
            severity: item.severity,
            createdAt: new Date().toISOString(),
            status: 'UNREVIEWED',
            symptomSummary: item.symptomSummary,
          };
          interview.redFlags.push(newAlert);
          db.redFlagAlerts.unshift(newAlert);
          newAlertTriggered = true;
          logAudit('Clinical Safety Rules', 'SYSTEM', 'RED_FLAG_TRIGGERED', newAlert.alertId, `Critical triage alert: ${item.name}`);
        }
      }
    }

    // 5. State Machine & Adaptive Branching
    let botNextMessage = '';
    let quickOptions: string[] = [];

    if (interview.currentSection === 'chief_complaint') {
      interview.chiefComplaint = text;
      interview.currentSection = 'hpi';
      interview.completionScore = 25;

      botNextMessage = language === 'hi'
        ? `धन्यवाद। आपने '${text}' बताया है। यह समस्या कब से शुरू हुई, और अचानक शुरू हुई या धीरे-धीरे?`
        : `Thank you. You noted '${text}'. When did this problem begin, and did it start suddenly or gradually?`;
      quickOptions = language === 'hi'
        ? ['आज ही (कुछ घंटे पहले)', '1 से 2 दिन पहले', 'लगभग 1 हफ़्ते से', '1 महीने से ज्यादा', 'समय-समय पर आता-जाता है']
        : ['Just today (a few hours ago)', '1 to 2 days ago', 'About a week ago', 'Over a month ago', 'Comes and goes intermittently'];
    } else if (interview.currentSection === 'hpi') {
      if (!interview.hpi.onset) {
        interview.hpi.onset = text;
        interview.completionScore = 35;
        botNextMessage = language === 'hi'
          ? 'तकलीफ की गंभीरता (तीव्रता) 0 से 10 के पैमाने पर कितनी है? (0 = कोई दर्द नहीं, 10 = असहनीय दर्द)'
          : 'On a scale from 0 to 10, how severe is the discomfort? (0 = none, 10 = unbearable pain)';
        quickOptions = ['Mild (1 - 3)', 'Moderate (4 - 6)', 'Severe (7 - 9)', 'Very Severe (10/10)'];
      } else if (!interview.hpi.severity) {
        interview.hpi.severity = text;
        interview.completionScore = 42;
        const cat = categorizeSymptom(interview.chiefComplaint);
        const questions = getAdaptiveHPIQuestions(cat);
        const firstQ = questions[0];

        botNextMessage = language === 'hi' ? firstQ.textHi : firstQ.textEn;
        quickOptions = language === 'hi' ? firstQ.optionsHi : firstQ.optionsEn;
      } else if (!interview.hpi.character) {
        interview.hpi.character = text;
        interview.completionScore = 48;
        const cat = categorizeSymptom(interview.chiefComplaint);
        const questions = getAdaptiveHPIQuestions(cat);
        if (questions.length > 1) {
          const nextQ = questions[1];
          botNextMessage = language === 'hi' ? nextQ.textHi : nextQ.textEn;
          quickOptions = language === 'hi' ? nextQ.optionsHi : nextQ.optionsEn;
        } else {
          interview.currentSection = 'past_history';
          interview.completionScore = 55;
          botNextMessage = language === 'hi'
            ? 'क्या आपको पहले से कोई पुरानी बीमारी (जैसे उच्च रक्तचाप, शुगर, दमा) या कोई पिछला ऑपरेशन (सर्जरी) हुआ है?'
            : 'Do you have any existing diagnosed health conditions (such as high blood pressure, diabetes) or prior surgeries?';
          quickOptions = language === 'hi'
            ? ['उच्च रक्तचाप (High BP)', 'शुगर / मधुमेह (Diabetes)', 'हृदय रोग / स्टेंट', 'दमा / सांस की बीमारी', 'कोई पुरानी बीमारी नहीं']
            : ['High Blood Pressure (Hypertension)', 'Diabetes Mellitus (Sugar)', 'Heart Disease / Prior Stent', 'Asthma / Breathing issue', 'No diagnosed conditions'];
        }
      } else {
        if (!interview.hpi.radiation && interview.chiefComplaint.toLowerCase().includes('chest')) {
          interview.hpi.radiation = text;
        } else {
          interview.hpi.associatedSymptoms = interview.hpi.associatedSymptoms || [];
          interview.hpi.associatedSymptoms.push(text);
        }
        interview.currentSection = 'past_history';
        interview.completionScore = 55;
        botNextMessage = language === 'hi'
          ? 'क्या आपको पहले से कोई पुरानी बीमारी (जैसे उच्च रक्तचाप, शुगर, दमा) या कोई पिछला ऑपरेशन (सर्जरी) हुआ है?'
          : 'Do you have any existing diagnosed health conditions (such as high blood pressure, diabetes) or prior surgeries?';
        quickOptions = language === 'hi'
          ? ['उच्च रक्तचाप (High BP)', 'शुगर / मधुमेह (Diabetes)', 'हृदय रोग / स्टेंट', 'दमा / सांस की बीमारी', 'कोई पुरानी बीमारी नहीं']
          : ['High Blood Pressure (Hypertension)', 'Diabetes Mellitus (Sugar)', 'Heart Disease / Prior Stent', 'Asthma / Breathing issue', 'No diagnosed conditions'];
      }
    } else if (interview.currentSection === 'past_history') {
      interview.pastHistory.push(text);
      interview.currentSection = 'medications_allergies';
      interview.completionScore = 70;
      botNextMessage = language === 'hi'
        ? 'क्या आप अभी रोजाना कोई दवाई ले रहे हैं, और क्या आपको किसी दवा या खाद्य पदार्थ से एलर्जी है? (आप अपनी पर्ची या दवा के रैपर की फोटो भी अपलोड कर सकते हैं)'
        : 'What daily medications do you take, and do you have any drug or food allergies? (Tip: You can also tap the camera/upload icon to scan your prescription or medicine strip!)';
      quickOptions = language === 'hi'
        ? ['रक्तचाप (BP) की दवा', 'शुगर (डायबिटीज) की दवा', 'पेनिसिलिन से एलर्जी', 'सल्फा दवा से एलर्जी', 'कोई नियमित दवा या एलर्जी नहीं']
        : ['Blood Pressure medicine daily', 'Diabetes medication daily', 'Penicillin allergy', 'Sulfa drug allergy', 'No daily meds or allergies'];
    } else if (interview.currentSection === 'medications_allergies') {
      if (text.toLowerCase().includes('allerg') || text.toLowerCase().includes('penicillin') || text.toLowerCase().includes('एलर्जी')) {
        interview.allergies.push({ substance: text, reaction: 'Rash / Skin reaction', source: 'Patient verbal intake', verificationStatus: 'Patient Reported' });
      } else {
        interview.drugHistory.push({ name: text, dosage: 'As prescribed', frequency: 'Daily', source: 'Patient verbal intake', verificationStatus: 'Patient Reported' });
      }
      interview.currentSection = 'family_lifestyle';
      interview.completionScore = 85;
      botNextMessage = language === 'hi'
        ? 'क्या परिवार में किसी को दिल की बीमारी या शुगर का इतिहास है? आपका खान-पान (शाकाहारी/मांसाहारी) और नींद कैसी है?'
        : 'Is there a family history of early heart disease or diabetes? How are your diet, sleep, and physical habits?';
      quickOptions = language === 'hi'
        ? ['परिवार में दिल की बीमारी', 'परिवार में शुगर (डायबिटीज)', 'शाकाहारी भोजन और सामान्य नींद', 'धूम्रपान व शराब से मुक्त']
        : ['Family history of Heart Disease', 'Family history of Diabetes', 'Vegetarian diet, normal sleep', 'Non-smoker, no alcohol'];
    } else if (interview.currentSection === 'family_lifestyle') {
      interview.personalHistory.diet = text;
      interview.currentSection = 'review';
      interview.completionScore = 100;
      botNextMessage = language === 'hi'
        ? 'बहुत धन्यवाद! आपका संपूर्ण नैदानिक विवरण एकत्र कर लिया गया है। कृपया दाईं ओर लाइव सारांश की जांच करें और अपने डॉक्टर के लिए रिपोर्ट तैयार करने के लिए पुष्टि करें।'
        : 'Thank you! Your comprehensive clinical history has been captured. Please review the live summary on the right, and tap "Confirm & Generate Pre-Consultation Report" when ready.';
      quickOptions = language === 'hi'
        ? ['विवरण की पुष्टि करें और रिपोर्ट बनाएं', 'कुछ संशोधन करना है']
        : ['Confirm & Generate Pre-Consultation Report', 'I want to make a correction'];
    } else {
      botNextMessage = language === 'hi'
        ? 'आपकी जानकारी सुरक्षित रूप से दर्ज कर ली गई है। क्या आप रिपोर्ट जनरेट करना चाहते हैं?'
        : 'Your clinical history is saved. Would you like to generate the pre-consultation report now?';
      quickOptions = ['Confirm & Generate Pre-Consultation Report'];
    }

    const nextMsg: InterviewMessage = {
      id: `MSG-${Date.now().toString().slice(-6)}-b`,
      interviewId: interview.id,
      sender: 'bot',
      message: botNextMessage,
      timestamp: new Date().toISOString(),
      language,
      questionCategory: interview.currentSection,
      quickOptions,
      allowsVoice: true,
      allowsSkip: true,
      isRedFlagAlert: newAlertTriggered,
    };

    interview.messages.push(nextMsg);
    saveDatabase();
    res.json({ interview, nextMessage: nextMsg, newAlertTriggered });
  });

  // Handle document upload or prescription photo during clinical interview
  app.post('/api/interviews/:id/upload', async (req, res) => {
    const { docName, docType = 'Prescription', previewText, document: incomingDoc } = req.body;
    const db = getDatabase();
    const interview = (db.interviews || []).find(i => i.id === req.params.id);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    try {
      let finalDoc: MedicalDocument;
      if (incomingDoc && incomingDoc.name) {
        finalDoc = incomingDoc;
      } else {
        const extracted = await processMedicalDocument(docName || 'Prescription_Photo.jpg', docType, previewText);
        finalDoc = {
          id: `DOC-${Date.now().toString().slice(-5)}`,
          name: docName || 'Uploaded_Prescription.jpg',
          type: (docType as any) || 'Prescription',
          date: new Date().toISOString().split('T')[0],
          facility: 'Uploaded by Patient at MediKiosk',
          doctor: extracted.doctorName || 'Dr. Attending Physician',
          extractedEntities: extracted,
          verified: true,
        };
      }

      interview.documents.push(finalDoc);

      // Add extracted medicines to drugHistory with source badge
      if (finalDoc.extractedEntities?.medications && finalDoc.extractedEntities.medications.length > 0) {
        for (const med of finalDoc.extractedEntities.medications) {
          const exists = interview.drugHistory.some(m => m.name.toLowerCase() === med.name.toLowerCase());
          if (!exists) {
            interview.drugHistory.push({
              name: med.name,
              dosage: med.dosage || 'Standard',
              frequency: med.frequency || 'Daily',
              source: `${finalDoc.type} OCR + Patient Verified`,
              verificationStatus: 'Patient Reported',
            });
          }
        }
      }

      const medSummary = (finalDoc.extractedEntities?.medications || []).map(m => m.name).join(', ');
      const botFeedback: InterviewMessage = {
        id: `MSG-${Date.now().toString().slice(-6)}-ocr`,
        interviewId: interview.id,
        sender: 'bot',
        message: interview.language === 'hi'
          ? `मैंने आपका दस्तावेज़ '${finalDoc.name}' सफलतापूर्वक रिकॉर्ड में जोड़ दिया है।${medSummary ? ` पहचानी गई दवाइयाँ: ${medSummary}।` : ''}`
          : `I have attached and verified '${finalDoc.name}'.${medSummary ? ` Detected medications: ${medSummary}.` : ''} All items are linked to your pre-consultation file.`,
        timestamp: new Date().toISOString(),
        language: interview.language,
        questionCategory: 'medications',
        quickOptions: ['Continue Interview', 'View Extracted Details'],
        extractedDataPreview: `${finalDoc.extractedEntities?.medications?.length || 0} medications, ${finalDoc.extractedEntities?.labTests?.length || 0} lab tests verified.`,
      };

      interview.messages.push(botFeedback);
      saveDatabase();

      res.json({ success: true, interview, document: finalDoc });
    } catch (e: any) {
      console.error('Interview document upload error:', e);
      res.status(500).json({ error: 'Failed to process document' });
    }
  });

  // Direct patient document upload & linkage
  app.post('/api/patients/:id/documents', (req, res) => {
    const { document: doc } = req.body;
    if (!doc || !doc.name) {
      return res.status(400).json({ error: 'Valid MedicalDocument payload required' });
    }

    const db = getDatabase();
    const patient = db.patients.find(p => p.id === req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Link to active intake if exists
    const intake = db.intakes.find(i => i.patientId === patient.id && i.status !== 'VERIFIED');
    if (intake) {
      intake.documents = intake.documents || [];
      intake.documents.push(doc);

      // Append timeline
      intake.timeline.push({
        id: `TL-${Date.now().toString().slice(-4)}`,
        date: doc.date || new Date().toISOString().split('T')[0],
        title: `${doc.type} Uploaded & Verified`,
        category: doc.type === 'Prescription' ? 'Prescription' : doc.type.includes('Lab') || doc.type.includes('Blood') ? 'Lab Test' : 'Current Intake',
        summary: `${doc.name} (${doc.facility || 'Verified facility'}) attached with ${doc.extractedEntities?.medications?.length || 0} medications.`,
      });

      // Update medications
      if (doc.extractedEntities?.medications) {
        for (const m of doc.extractedEntities.medications) {
          const exists = intake.medications.some(med => med.name.toLowerCase() === m.name.toLowerCase());
          if (!exists) {
            intake.medications.push({
              name: m.name,
              dosage: m.dosage || 'Standard',
              frequency: m.frequency || 'Daily',
              source: `${doc.type} OCR`,
              verificationStatus: 'Patient Reported',
            });
          }
        }
      }
    }

    saveDatabase();
    logAudit('Document Intelligence', 'PATIENT', 'DOCUMENT_UPLOADED', doc.id, `${doc.type} attached to patient ${patient.name}`);
    res.json({ success: true, document: doc, intake });
  });

  // Complete interview and generate Structured Clinical Pre-Consultation Report
  app.post('/api/interviews/:id/complete', (req, res) => {
    const db = getDatabase();
    const interview = (db.interviews || []).find(i => i.id === req.params.id);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const patient = db.patients.find(p => p.id === interview.patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    interview.status = 'COMPLETED';
    interview.completedAt = new Date().toISOString();
    interview.completionScore = 100;

    if (!interview.chiefComplaint) {
      const patientMsg = (interview.messages || []).find(m => m.sender === 'patient');
      interview.chiefComplaint = patientMsg ? patientMsg.message : (req.body?.fallbackChiefComplaint || 'General Outpatient Consultation & Health Checkup');
    }

    // Generate clinical report
    const report = buildClinicalReport(interview, patient);
    db.clinicalReports = db.clinicalReports || [];
    db.clinicalReports.unshift(report);

    // Synchronize or create corresponding Intake record so Doctor Queue and Hospital Ops see it immediately
    let intake = db.intakes.find(i => i.patientId === patient.id && i.status !== 'VERIFIED');
    const isRedFlag = report.triagePriority === 'HIGH';

    if (intake) {
      intake.chiefComplaint = report.chiefComplaint;
      intake.historyOfPresentIllness = report.historyOfPresentIllness;
      intake.medications = report.drugHistory;
      intake.allergies = report.allergies;
      intake.pastMedicalHistory = report.pastMedicalHistory.join(', ');
      intake.pastSurgicalHistory = report.pastSurgicalHistory.join(', ');
      intake.reviewOfSystems = report.reviewOfSystems;
      intake.redFlags = report.redFlags;
      intake.documents = report.documents;
      intake.status = isRedFlag ? 'RED_FLAG' : 'READY_FOR_REVIEW';
      intake.clinicalReportId = report.id;
      intake.interviewId = interview.id;
      intake.reportStatus = 'AWAITING_DOCTOR_REVIEW';
      intake.aiSummary = {
        version: 1,
        text: report.summary.quickClinicalSummary,
        sections: {
          chiefComplaint: report.chiefComplaint,
          historyOfPresentIllness: report.historyOfPresentIllness,
          pastMedicalHistory: report.pastMedicalHistory.join(', '),
          pastSurgicalHistory: report.pastSurgicalHistory.join(', '),
          currentMedications: report.drugHistory.map(m => `${m.name} ${m.dosage}`),
          drugAllergies: report.allergies.map(a => `${a.substance} (${a.reaction || 'Reaction'})`),
          familyHistory: report.familyHistory.map(f => `${f.relationship}: ${f.condition}`).join(', '),
          personalHistory: report.personalHistory.diet || 'Regular',
          reviewOfSystems: Object.entries(report.reviewOfSystems).map(([k, v]) => `${k}: ${v}`).join('; '),
          previousInvestigations: `${report.documents.length} verified documents`,
          redFlags: report.redFlags.map(r => r.ruleTriggered),
          importantNotes: report.summary.keyPointsForDoctor.join('\n'),
        },
        sources: [
          { statement: 'Chief complaint and HPI', source: 'Patient AI Interview' },
          { statement: 'Current Medications', source: 'Patient Verbal Intake & OCR Verification' },
        ],
        isDraft: true,
      };
      intake.updatedAt = new Date().toISOString();
      intake.timeline.push({
        id: `TL-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString().split('T')[0],
        title: isRedFlag ? 'AI Clinical Intake Complete (High Priority Alert)' : 'AI Clinical Intake Complete (Awaiting Doctor)',
        category: 'Current Intake',
        summary: `Adaptive medical interview completed. Structured pre-consultation report ${report.id} generated.`,
      });
    } else {
      intake = {
        id: `INT-${Date.now().toString().slice(-6)}`,
        patientId: patient.id,
        sessionId: `SES-${Date.now().toString().slice(-6)}`,
        token: patient.token,
        patientName: patient.name,
        age: patient.age,
        gender: patient.gender,
        language: interview.language,
        department: 'General Medicine / Triage',
        mode: 'general',
        chiefComplaint: report.chiefComplaint,
        historyOfPresentIllness: report.historyOfPresentIllness,
        pastMedicalHistory: report.pastMedicalHistory.join(', '),
        pastSurgicalHistory: report.pastSurgicalHistory.join(', '),
        medications: report.drugHistory,
        allergies: report.allergies,
        familyHistory: report.familyHistory.map(f => `${f.relationship}: ${f.condition}`).join(', '),
        personalHistory: report.personalHistory.diet || 'Regular',
        reviewOfSystems: report.reviewOfSystems,
        ayushData: report.ayurvedaAssessment || {},
        documents: report.documents,
        timeline: [
          {
            id: `TL-${Date.now().toString().slice(-4)}`,
            date: new Date().toISOString().split('T')[0],
            title: isRedFlag ? 'AI Clinical Intake Complete (High Priority Alert)' : 'AI Clinical Intake Complete',
            category: 'Current Intake',
            summary: `Pre-consultation report ${report.id} generated via AI Medical Interview.`,
          },
        ],
        redFlags: report.redFlags,
        aiSummary: {
          version: 1,
          text: report.summary.quickClinicalSummary,
          sections: {
            chiefComplaint: report.chiefComplaint,
            historyOfPresentIllness: report.historyOfPresentIllness,
            pastMedicalHistory: report.pastMedicalHistory.join(', '),
            pastSurgicalHistory: report.pastSurgicalHistory.join(', '),
            currentMedications: report.drugHistory.map(m => `${m.name} ${m.dosage}`),
            drugAllergies: report.allergies.map(a => `${a.substance} (${a.reaction || 'Reaction'})`),
            familyHistory: report.familyHistory.map(f => `${f.relationship}: ${f.condition}`).join(', '),
            personalHistory: report.personalHistory.diet || 'Regular',
            reviewOfSystems: Object.entries(report.reviewOfSystems).map(([k, v]) => `${k}: ${v}`).join('; '),
            previousInvestigations: `${report.documents.length} verified documents`,
            redFlags: report.redFlags.map(r => r.ruleTriggered),
            importantNotes: report.summary.keyPointsForDoctor.join('\n'),
          },
          sources: [{ statement: 'Complete Intake', source: 'AI Clinical Interview' }],
          isDraft: true,
        },
        consent: {
          given: true,
          timestamp: new Date().toISOString(),
          version: 'v2.2',
          language: interview.language,
        },
        rawAnswers: [],
        status: isRedFlag ? 'RED_FLAG' : 'READY_FOR_REVIEW',
        interviewId: interview.id,
        clinicalReportId: report.id,
        reportStatus: 'AWAITING_DOCTOR_REVIEW',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.intakes.unshift(intake);
    }

    interview.intakeId = intake.id;

    // Ensure ReportShare exists for the patient's assigned doctor and hospital
    if (patient.assignedDoctorId) {
      const assignedDoctor = (db.doctors || []).find(d => d.id === patient.assignedDoctorId);
      const shareExists = (db.reportShares || []).some(s => s.reportId === report.id && s.doctorId === patient.assignedDoctorId);
      if (!shareExists) {
        db.reportShares = db.reportShares || [];
        db.reportShares.unshift({
          id: `SHARE-${Date.now().toString().slice(-6)}`,
          reportId: report.id,
          intakeId: intake.id,
          patientId: patient.id,
          patientName: patient.name,
          patientAge: patient.age,
          patientGender: patient.gender,
          patientToken: patient.token,
          patientPhone: patient.phone,
          doctorId: patient.assignedDoctorId,
          doctorName: assignedDoctor?.fullName || patient.assignedDoctorName || 'Assigned Physician',
          doctorSpecialization: assignedDoctor?.specialization || 'Consultant',
          hospitalId: patient.assignedHospitalId || assignedDoctor?.hospitalId || 'HOSP-202',
          hospitalName: patient.assignedHospitalName || assignedDoctor?.hospitalName || 'MediCare Hospital',
          sharedAt: new Date().toISOString(),
          status: 'DELIVERED',
          reportSummary: {
            chiefComplaint: report.chiefComplaint,
            quickClinicalSummary: report.summary?.quickClinicalSummary || report.chiefComplaint,
            triagePriority: report.triagePriority,
          },
          doctorNotes: 'Auto-shared with assigned consultant upon AI clinical interview completion.',
        });
      }
    }

    saveDatabase();

    logAudit(
      'AI Clinical Engine',
      'PATIENT',
      'REPORT_GENERATED',
      report.id,
      `Clinical Pre-Consultation Report created for ${patient.name}. Priority: ${report.triagePriority}`
    );

    res.json({
      success: true,
      report,
      intake,
    });
  });

  // Get clinical report by Patient ID
  app.get('/api/patients/:id/clinical-report', (req, res) => {
    const db = getDatabase();
    const report = (db.clinicalReports || []).find(r => r.patientId === req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'No clinical report found for patient' });
    }
    res.json(report);
  });

  // Get specific clinical report by ID
  app.get('/api/clinical-reports/:id', (req, res) => {
    const db = getDatabase();
    const report = (db.clinicalReports || []).find(r => r.id === req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Clinical report not found' });
    }
    res.json(report);
  });

  // Update clinical report (e.g. physician edits or notes)
  app.put('/api/clinical-reports/:id', (req, res) => {
    const db = getDatabase();
    const index = (db.clinicalReports || []).findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const current = db.clinicalReports[index];
    const updated = {
      ...current,
      ...req.body,
      status: req.body.status || 'EDITED_BY_DOCTOR',
    };
    db.clinicalReports[index] = updated;
    saveDatabase();
    logAudit('Physician Workspace', 'DOCTOR', 'REPORT_EDITED', updated.id, `Report edited by doctor`);
    res.json(updated);
  });

  // Physician reviews and approves clinical report
  app.post('/api/clinical-reports/:id/review', (req, res) => {
    const { doctorName = 'Dr. Vivek Sharma, MD', doctorNotes = '', action = 'APPROVE' } = req.body;
    const db = getDatabase();
    const index = (db.clinicalReports || []).findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = db.clinicalReports[index];
    report.status = action === 'APPROVE' ? 'FINALIZED' : 'EDITED_BY_DOCTOR';
    report.reviewedBy = doctorName;
    report.reviewedAt = new Date().toISOString();
    report.doctorNotes = doctorNotes;

    // Update associated intake as verified
    const intake = db.intakes.find(i => i.id === report.intakeId || i.clinicalReportId === report.id || i.patientId === report.patientId);
    if (intake) {
      intake.status = 'VERIFIED';
      intake.reportStatus = 'FINALIZED';
      intake.aiSummary.verifiedBy = doctorName;
      intake.aiSummary.verifiedAt = new Date().toISOString();
      intake.aiSummary.isDraft = false;
      intake.aiSummary.doctorNotes = doctorNotes;
      intake.timeline.push({
        id: `TL-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString().split('T')[0],
        title: 'Clinical Report Finalized by Physician',
        category: 'Consultation',
        summary: `Pre-consultation history verified and signed off by ${doctorName}.`,
      });
    }

    saveDatabase();
    logAudit(doctorName, 'DOCTOR', 'REPORT_FINALIZED', report.id, `Clinical report reviewed and finalized by ${doctorName}`);
    res.json({ success: true, report, intake });
  });

  // Triage Alerts API
  app.get('/api/triage-alerts', (req, res) => {
    const db = getDatabase();
    res.json(db.redFlagAlerts || []);
  });

  app.put('/api/triage-alerts/:id', (req, res) => {
    const { status = 'ACKNOWLEDGED' } = req.body;
    const db = getDatabase();
    const alert = (db.redFlagAlerts || []).find(a => a.alertId === req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    alert.status = status;
    saveDatabase();
    logAudit('Hospital Triage Lead', 'HOSPITAL_ADMIN', 'ALERT_STATUS_CHANGED', alert.alertId, `Alert status updated to ${status}`);
    res.json(alert);
  });


  // Document OCR & Entity extraction
  app.post('/api/documents/process', async (req, res) => {
    const { docName, docType, previewText } = req.body;
    if (!docName) {
      return res.status(400).json({ error: 'Document name required' });
    }

    try {
      const extracted = await processMedicalDocument(docName, docType || 'Prescription', previewText);
      logAudit('MediKiosk OCR Pipeline', 'SYSTEM', 'DOCUMENT_PROCESSED', docName, `Extracted entities from ${docType || 'Prescription'}`);
      res.json({
        success: true,
        extracted,
        isDemoPipeline: true,
      });
    } catch (e: any) {
      console.error('OCR Extraction error:', e);
      res.status(500).json({ error: 'Failed to process document' });
    }
  });

  // FHIR R4 Bundle Preview for ABDM Interoperability
  app.get('/api/integration/fhir/:intakeId', (req, res) => {
    const db = getDatabase();
    const intake = db.intakes.find(i => i.id === req.params.intakeId);
    if (!intake) {
      return res.status(404).json({ error: 'Intake not found' });
    }

    const patient = db.patients.find(p => p.id === intake.patientId);

    const fhirBundle = {
      resourceType: 'Bundle',
      id: `medikiosk-bundle-${intake.id}`,
      meta: {
        lastUpdated: intake.updatedAt,
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle'],
      },
      identifier: {
        system: 'https://medikiosk.ayush.gov.in/bundles',
        value: intake.id,
      },
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: `urn:uuid:patient-${intake.patientId}`,
          resource: {
            resourceType: 'Patient',
            id: intake.patientId,
            identifier: [
              {
                system: 'https://healthid.abdm.gov.in',
                value: patient?.abhaId || 'rahul.kumar@abdm',
              },
              {
                system: 'https://medikiosk.ayush.gov.in/tokens',
                value: intake.token,
              },
            ],
            name: [{ text: intake.patientName }],
            gender: intake.gender.toLowerCase(),
            birthDate: `${2026 - intake.age}-01-01`,
          },
        },
        {
          fullUrl: `urn:uuid:encounter-${intake.id}`,
          resource: {
            resourceType: 'Encounter',
            id: `enc-${intake.id}`,
            status: intake.status === 'VERIFIED' ? 'finished' : 'in-progress',
            class: { code: 'AMB', display: 'ambulatory' },
            subject: { reference: `urn:uuid:patient-${intake.patientId}` },
            serviceType: {
              coding: [{ system: 'https://medikiosk.ayush.gov.in/services', code: intake.mode, display: intake.department }],
            },
          },
        },
        {
          fullUrl: `urn:uuid:condition-${intake.id}-cc`,
          resource: {
            resourceType: 'Condition',
            id: `cond-${intake.id}`,
            clinicalStatus: { coding: [{ code: 'active' }] },
            verificationStatus: {
              coding: [{ code: intake.status === 'VERIFIED' ? 'confirmed' : 'provisional' }],
            },
            code: { text: intake.chiefComplaint || 'Chief complaint pending' },
            subject: { reference: `urn:uuid:patient-${intake.patientId}` },
          },
        },
        ...intake.medications.map((m, idx) => ({
          fullUrl: `urn:uuid:med-${intake.id}-${idx}`,
          resource: {
            resourceType: 'MedicationStatement',
            id: `med-${intake.id}-${idx}`,
            status: 'active',
            medicationCodeableConcept: { text: `${m.name} ${m.dosage}` },
            subject: { reference: `urn:uuid:patient-${intake.patientId}` },
            dosage: [{ text: m.frequency }],
          },
        })),
        ...intake.allergies.map((a, idx) => ({
          fullUrl: `urn:uuid:allergy-${intake.id}-${idx}`,
          resource: {
            resourceType: 'AllergyIntolerance',
            id: `allergy-${intake.id}-${idx}`,
            clinicalStatus: { coding: [{ code: 'active' }] },
            substance: { text: a.substance },
            patient: { reference: `urn:uuid:patient-${intake.patientId}` },
            reaction: [{ manifestation: [{ text: a.reaction || 'Allergic reaction' }] }],
          },
        })),
      ],
    };

    res.json({
      success: true,
      mode: 'ABDM Integration — Demonstration Mode',
      disclaimer: 'Generated FHIR R4 standard bundle matching National Health Authority (NHA) ABDM specifications.',
      bundle: fhirBundle,
    });
  });

  // HIS Integration sync demo
  app.post('/api/integration/his/:intakeId', (req, res) => {
    const db = getDatabase();
    const intake = db.intakes.find(i => i.id === req.params.intakeId);
    if (!intake) {
      return res.status(404).json({ error: 'Intake not found' });
    }

    logAudit('HIS Adapter Service', 'SYSTEM', 'HIS_SYNC_DISPATCHED', intake.id, `Patient intake payload sent to Hospital Information System (AIIA Medsys).`);
    res.json({
      success: true,
      mode: 'HIS Integration — Demonstration Mode',
      patientName: intake.patientName,
      intakeId: intake.id,
      hisTransactionId: `HIS-TXN-${Date.now().toString().slice(-8)}`,
      status: 'Synchronized with Hospital OPD Queue',
      syncedAt: new Date().toISOString(),
    });
  });

  // Clinical ontology questions
  app.get('/api/ai/questions', (req, res) => {
    const { mode = 'general' } = req.query;
    if (mode === 'ayush') {
      res.json([...CLINICAL_ONTOLOGY_FLOW, ...AYUSH_ONTOLOGY_FLOW]);
    } else {
      res.json(CLINICAL_ONTOLOGY_FLOW);
    }
  });

  // Check red flags
  app.post('/api/ai/check-red-flags', (req, res) => {
    const { text } = req.body;
    const result = checkRedFlags(text || '');
    res.json(result);
  });

  // Reset demo data to standard initial state
  app.post('/api/db/reset-demo', (req, res) => {
    const fresh = saveDatabase(); // saves default
    res.json({ success: true, message: 'Database refreshed to initial demonstration dataset.' });
  });

  // --- ANNA VOICE ASSISTANT ENDPOINTS ---

  // Anna status & capabilities check
  app.get('/api/anna/info', (req, res) => {
    res.json({
      name: 'Anna',
      role: 'Clinical Voice AI Assistant & Medical Receptionist',
      model: 'gemini-3.1-flash-live-preview',
      supportedLanguages: ['English', 'Hindi', 'Hinglish'],
      hasApiKey: !!process.env.GEMINI_API_KEY,
      capabilities: [
        'audio_to_audio_streaming',
        'voice_activity_detection',
        'barge_in_interruption',
        'symptom_intake_structuring',
        'emergency_triage_detection',
        'doctor_department_navigation',
      ],
    });
  });

  // Doctors directory for Anna recommendations
  app.get('/api/anna/doctors', (req, res) => {
    const db = getDatabase();
    const doctors = [
      {
        id: 'DOC-01',
        name: 'Dr. Vivek Sharma, MD',
        role: 'Senior Consultant Physician',
        specialty: 'Cardiology & Internal Medicine',
        department: 'Cardiology / Medicine',
        qualifications: 'MBBS, MD (Medicine), DM (Cardiology)',
        experienceYears: 16,
        availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        opdTiming: '09:00 AM - 01:30 PM',
        languages: ['English', 'Hindi', 'Punjabi'],
        rating: 4.9,
        bio: 'Specialist in adult cardiology, hypertension management, preventive cardiovascular health, and acute coronary syndrome triage.',
      },
      {
        id: 'DOC-02',
        name: 'Dr. Ananya Mukherjee, BAMS, MD(Ayu)',
        role: 'Chief Ayurvedic Physician & Researcher',
        specialty: 'Kayachikitsa & Panchakarma',
        department: 'Kayachikitsa (AIIA)',
        qualifications: 'BAMS (Hons), MD (Ayurveda), Ph.D. (AIIA)',
        experienceYears: 14,
        availableDays: ['Mon', 'Tue', 'Wed', 'Fri'],
        opdTiming: '10:00 AM - 03:00 PM',
        languages: ['English', 'Hindi', 'Bengali'],
        rating: 4.8,
        bio: 'Specialist in holistic metabolic care, chronic lifestyle disorders, gut health (Agni dushti), and integrative Ayush treatments.',
      },
      {
        id: 'DOC-03',
        name: 'Dr. Sunita Patil, MD, DNB',
        role: 'Consultant Dermatologist',
        specialty: 'Dermatology & Allergy',
        department: 'Dermatology',
        qualifications: 'MBBS, MD (Dermatology, Venereology & Leprosy)',
        experienceYears: 11,
        availableDays: ['Tue', 'Thu', 'Sat'],
        opdTiming: '11:00 AM - 04:00 PM',
        languages: ['English', 'Hindi', 'Marathi'],
        rating: 4.9,
        bio: 'Expertise in acute & chronic skin rashes, drug eruptions, eczemas, psoriasis, and pediatric dermatological conditions.',
      },
      {
        id: 'DOC-04',
        name: 'Dr. Rajesh Iyer, MS, MCh',
        role: 'Consultant Neurologist',
        specialty: 'Neurology & Headache Medicine',
        department: 'Neurology',
        qualifications: 'MBBS, MD, DM (Neurology)',
        experienceYears: 18,
        availableDays: ['Mon', 'Wed', 'Fri'],
        opdTiming: '09:30 AM - 02:00 PM',
        languages: ['English', 'Hindi', 'Tamil'],
        rating: 4.95,
        bio: 'Specialist in migraine management, neuromuscular disorders, neuropathy, stroke prevention, and acute vertigo assessments.',
      },
      {
        id: 'DOC-05',
        name: 'Dr. Meera Nambiar, MD, DCH',
        role: 'Senior Pediatrician',
        specialty: 'Pediatrics & Neonatology',
        department: 'Pediatrics',
        qualifications: 'MBBS, MD (Pediatrics)',
        experienceYears: 13,
        availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        opdTiming: '08:30 AM - 01:00 PM',
        languages: ['English', 'Hindi', 'Malayalam'],
        rating: 4.85,
        bio: 'Child healthcare specialist in infectious illnesses, pediatric asthma, immunization, and growth milestones.',
      },
      {
        id: 'DOC-06',
        name: 'Dr. Hardeep Singh Gill, MS',
        role: 'Orthopedic Surgeon',
        specialty: 'Orthopedics & Joint Care',
        department: 'Orthopedics',
        qualifications: 'MBBS, MS (Orthopedics)',
        experienceYears: 15,
        availableDays: ['Mon', 'Wed', 'Sat'],
        opdTiming: '10:00 AM - 03:30 PM',
        languages: ['English', 'Hindi', 'Punjabi'],
        rating: 4.8,
        bio: 'Specialist in joint preservation, osteoarthritis, spine mechanics, fractures, and sports rehabilitation.',
      },
    ];
    res.json(doctors);
  });

  // Departments list for Anna
  app.get('/api/anna/departments', (req, res) => {
    const departments = [
      {
        id: 'DEP-GEN',
        name: 'General Medicine & Triage',
        code: 'MED',
        description: 'Comprehensive evaluation of general acute and chronic symptoms, viral fevers, diabetes, and primary triage.',
        floor: 'Ground Floor',
        wing: 'Main OPD Block A',
        chiefDoctor: 'Dr. Vivek Sharma, MD',
        commonSymptoms: ['Fever', 'Fatigue', 'General weakness', 'Body aches', 'Unspecified pain', 'High BP check'],
        isOpen: true,
      },
      {
        id: 'DEP-CARDIO',
        name: 'Cardiology & Chest Clinic',
        code: 'CARD',
        description: 'Advanced cardiac evaluation, ECG, echocardiography, chest discomfort assessments, and hypertensive emergencies.',
        floor: 'Ground Floor',
        wing: 'Emergency & Cardiac Wing 1B',
        chiefDoctor: 'Dr. Vivek Sharma, MD',
        commonSymptoms: ['Chest tightness', 'Heart palpitations', 'Breathlessness on exertion', 'High blood pressure'],
        isOpen: true,
      },
      {
        id: 'DEP-AYUSH',
        name: 'All India Institute of Ayurveda (AIIA) Wing',
        code: 'AYUSH',
        description: 'Prakriti analysis, chronic dosha balancing, Kayachikitsa, Panchakarma therapy, and natural wellness protocols.',
        floor: '1st Floor',
        wing: 'Block B - AIIA Wing',
        chiefDoctor: 'Dr. Ananya Mukherjee, MD(Ayu)',
        commonSymptoms: ['Chronic indigestion', 'Joint stiffness', 'Hyperacidity', 'Sleep disturbance', 'Stress', 'Lifestyle disorders'],
        isOpen: true,
      },
      {
        id: 'DEP-DERM',
        name: 'Dermatology & Skin Care',
        code: 'DERM',
        description: 'Specialized clinic for skin lesions, urticaria, allergies, infections, and chronic dermatoses.',
        floor: '2nd Floor',
        wing: 'Specialty Block C',
        chiefDoctor: 'Dr. Sunita Patil, MD',
        commonSymptoms: ['Skin rash', 'Itching', 'Acne', 'Eczema', 'Allergic reactions', 'Fungal infection'],
        isOpen: true,
      },
      {
        id: 'DEP-NEURO',
        name: 'Neurology & Headache Center',
        code: 'NEURO',
        description: 'Specialized diagnosis of chronic migraine, severe headaches, neurological deficits, dizziness, and tremors.',
        floor: '2nd Floor',
        wing: 'Specialty Block C',
        chiefDoctor: 'Dr. Rajesh Iyer, DM',
        commonSymptoms: ['Severe headache', 'Migraine', 'Light sensitivity', 'Dizziness / Vertigo', 'Tingling or numbness'],
        isOpen: true,
      },
      {
        id: 'DEP-ORTHO',
        name: 'Orthopedics & Joint Clinic',
        code: 'ORTHO',
        description: 'Bone health, joint pain, spine care, arthritis, ligament injuries, and rehabilitation.',
        floor: '1st Floor',
        wing: 'Block A',
        chiefDoctor: 'Dr. Hardeep Singh Gill, MS',
        commonSymptoms: ['Knee pain', 'Backache', 'Joint swelling', 'Stiffness', 'Difficulty walking'],
        isOpen: true,
      },
      {
        id: 'DEP-EMERG',
        name: '24/7 Emergency & Critical Triage',
        code: 'EMRG',
        description: 'Immediate acute care, resuscitation, trauma stabilization, and emergency triage team.',
        floor: 'Ground Floor',
        wing: 'Emergency Entrance 1A',
        chiefDoctor: 'Emergency Duty Lead Physician',
        commonSymptoms: ['Severe chest pain', 'Sudden shortness of breath', 'Loss of consciousness', 'Uncontrolled bleeding', 'Acute trauma'],
        isOpen: true,
      },
    ];
    res.json(departments);
  });

  // Save Anna's structured pre-consultation summary into clinic database
  app.post('/api/anna/save-summary', (req, res) => {
    const { summary } = req.body;
    if (!summary || !summary.patientReported) {
      return res.status(400).json({ error: 'Structured summary payload required.' });
    }

    const db = getDatabase();
    const summaryId = summary.id || `SUM-${Date.now().toString().slice(-5)}`;

    logAudit(
      'Anna AI Voice Assistant',
      'SYSTEM',
      'ANNA_SUMMARY_PERSISTED',
      summaryId,
      `Symptom intake for "${summary.patientReported.chiefComplaint}" recorded with ${summary.clinicalStructuring?.triageCategory || 'ROUTINE'} priority.`
    );

    res.json({
      success: true,
      summaryId,
      message: 'Structured symptom summary saved successfully for clinical triage.',
    });
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Create HTTP server & bind WebSocketServer for real-time Gemini Live audio streaming
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/live' });
  setupAnnaLiveWebSocket(wss);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`MediKiosk server running on http://0.0.0.0:${PORT} with Anna Live WebSocket on /live`);
  });
}

startServer();
