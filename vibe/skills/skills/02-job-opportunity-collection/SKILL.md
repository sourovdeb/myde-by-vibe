---
name: 02-job-opportunity-collection
description: Skill to Collect and Verify Job Opportunities Across Réunion 974
---

# Skill to Collect and Verify Job Opportunities Across Réunion 974

**Domain:** Career  
**Engine:** web_search + project_knowledge_search + Gmail:search_threads

**Live browser:** When a source page needs the real Chrome (JS-rendered listings, logged-in LinkedIn, clicks, downloads), use the `browser-harness` skill — it controls Sourov's actual Chrome with logged-in sessions. If Chrome is not running, launch it detached with `powershell.exe -Command "Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe'"`. Extract listings with `js(...)`, and verify any downloaded file by byte size and content before adding rows.

## Purpose
Build a structured CSV of verified job opportunities filtered by sector and certification requirement.

## Steps
1. Search: France Travail, GRETA, CCI Réunion 974, LinkedIn, APEC, organisational sites
2. Filter: language requirement = English, sectors = ELT / aviation / medical / hospitality / public service
3. Cross-reference with existing `CAREER_OPPORTUNITIES_CSV_COMPREHENSIVE.csv` (61 rows, 10 columns)
4. Add new rows: Organisation, Type, Location, Contact_Sector, Position_Title, Language_Requirements, Certification_Required, Status, Date_Found, Source
5. Mark Status = "Verified" only when official address confirmed

## Output
CSV, 10 columns, UTF-8, no guessed contacts
