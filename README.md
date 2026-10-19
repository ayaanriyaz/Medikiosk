# MediKiosk: AI-Powered Clinical Intake Platform

A multilingual, voice-guided patient intake web app that collects a patient's history before the consultation and prepares a structured summary for the doctor. Built for **Smart India Hackathon 2026** (Problem Statement SIH26047: Patient Case-Taking Software, Ministry of Ayush / AIIA).

**Live demo:** https://medikiosk-uptti.ai.studio

[View screenshot: Home page with Anna Voice AI](https://drive.google.com/file/d/1-xz9wFHJZpqBJ7HP2ciMKsGMI-RPwGak/view?usp=drive_link)

## Problem

In busy OPDs, doctors spend a large part of each consultation just collecting basic history. Patients often carry old paper reports that are hard to read quickly. MediKiosk moves history taking before the consultation so the doctor starts with a clear, organised summary.

## What it does

- **Conversational intake (Anna Voice AI):** an AI assistant asks adaptive questions by voice and touch, in English and Hindi.
- **Medical OCR:** digitises prescriptions, lab reports and discharge summaries so past records can be reviewed.
- **Doctor-ready summary:** produces a structured draft summary of the patient's history. The doctor can edit, verify and approve it.
- **Three portals:** Patient mode, Doctor Portal and Hospital Portal, each with its own login and registration.
- **Demo hospitals:** AIIA Delhi and MediCare Kanpur, to show how different hospitals use the platform.

## Screenshots

- [Hospital Portal screenshot](https://drive.google.com/file/d/1127V1W7E4H_LetD5v-f9I2OaUX3o5SlX/view?usp=drive_link)
- [Doctor Portal screenshot](https://drive.google.com/file/d/1cuBbS9gBM-8g5X68X7mfsY8C68sRq6vH/view?usp=drive_link)
- [Home page screenshot](https://drive.google.com/file/d/1-xz9wFHJZpqBJ7HP2ciMKsGMI-RPwGak/view?usp=drive_link)

## Tech stack

- **AI:** Google Gemini API (voice interview, prompts and document understanding)
- **Deployment:** Google AI Studio
- **Frontend:** HTML, CSS, JavaScript
<!-- Add React, TypeScript, Node/Express or other tools here only if the code in this repo really uses them. -->

## My role

I was the **team lead** of a 6-member team. I integrated the Gemini API (including writing and testing the prompts) and handled deployment. The project was selected in our college's internal round of SIH 2026. Parts of the code were written with AI-assisted development tools.

## Try the demo

Open the live link and use the demo accounts shown on the login pages. These are demo-only credentials with no real patient data.

| Portal | Email | Password |
|---|---|---|
| Hospital | admin@aiia.gov.in | Hospital@123 |
| Doctor | dr.ananya@medikiosk.demo | Doctor@123 |

## Important note on safety

Anna is a pre-consultation assistant. It is **not a substitute for a licensed doctor**, and all AI-generated summaries are drafts that a doctor must review, edit and approve. In an emergency, call 112 or 108.

## Current limitations

- This is a hackathon prototype, not a production medical system.
- Integration with national health standards (ABDM, HL7 FHIR R4) is part of the design goal; check the code before assuming a full live integration.
- The AI can make mistakes, which is why doctor verification is built into the flow.

## Team

Smart India Hackathon 2026, UPTTI. Team lead: Ayaan Riyaz ([GitHub](https://github.com/ayaanriyaz)).
