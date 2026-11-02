# Day 5 log: Hidden Text Finder

Notes from the build, 2 November 2026. This replaces Refund Clock, which only covered Nigeria's CBN refund rules.

## Before building

- **The evidence is fresh:**
  - The 2026 USENIX Security study scanned 196,682 resumes and found hidden injections in about 1%. It names four methods: tinted, around one point, off the page, and an unpainted layer.
  - ManpowerGroup, in the New York Times, says about 10% of AI-screened US resumes. Recruiters in Czechia, India and the US report it.
- **What exists:**
  - a Python script with no users yet
  - a Windows app
  - web services that need the CV uploaded, which means a stranger's personal data goes to a third party
- **The edge:**
  - it runs entirely in the browser
  - batch checking
  - hidden text shown in place
  - wording that's fair to candidates

## Design

- **The style:** the draw dealt *framed-sheet* and *achromatic-ledger*. Framed-sheet fits a document inspector: the frame holds the batch, and the sheet holds the work. It also keeps Day 5 from looking like Day 1.
- **The screen's question:** "Is anything in this CV hidden from me?" The answer is the subline, and the page with its reveal is the biggest block.

## Building

- **Libraries:** pdf.js 6.4.299 was chosen over 6.5.438, which came out the day before, because this tool opens untrusted files. It runs with `isEvalSupported: false`, and its JavaScript sandbox files are left out.
- **The test files:** reportlab and python-docx build made-up CVs with each trick, and clean ones with grey text and small footnotes that must not be flagged.
- **First run:** the Word reader passed everything at once. The PDF reader failed on `doc.destroy()`, which pdf.js 6 replaced with destroying the loading task.
- **Text off the page:** pdf.js leaves text that sits wholly off the page out of its text listing, so the "Highly qualified…" line placed 700 points to the left wasn't there. The fix walks the page's drawing operations, keeping the graphics and text matrices, and places every string. It's found now.
- **Merged findings:** the text under a white box merged into the invisible line 20 points above it. Grouping now only joins pieces on the same or the next line.

## What the screenshots caught

- **The menu button showed on desktop.** `.btn` beat `.menu-btn` on specificity.
- **The microscopic text's callout covered the invisible line below it.** Small text is now written out in a band below the page.
- **On a phone, the bands lay over the page.** The page is now a frame: a top band, then the drawing with its boxes, then a foot band.
- **"made with anonymous".** Junk creator values are skipped, and the producer is used instead.
- **The long explanation repeated on every card.** It now shows once per kind.
- **The inspector failed text under 11 px.** The revealed text was live text at the CV's own size. It's now painted onto a canvas over the page, because it's part of the page picture, and every word stays readable in the findings list.
- **Placeholder emails (example.com) in the samples.** Replaced with a location line.
- **Switching the view also reset the theme control.** It was updating every segmented control on the page. Now it only touches its own.

## Checks at the end

- **Tests:** the browser test passes 18 of 18 checks, including white text on a dark band and on shaded Word paragraphs, which aren't flagged. The Node tests pass 4 of 4.
- **Click-through:** no console errors under the security policy, and an offline reload works.
- **Lint:** 0 FAIL, 0 WARN.
- **Inspector:** 0 FAIL on every screen. One WARN, defensible: a three-file list leaves the lower screen empty.

## Still to do with a real person

- Give it a folder of real CVs from a small employer. CVs exported from Canva, LaTeX and Google Docs will test the colour check on designed backgrounds.
- Ask a recruiter whether the wording ("a reason to look, not proof") is fair enough to use with candidates.
- Try real designed CVs with photos behind the text. The synthetic dark-band test passes, but a photograph is a harder background.
- Install it and open a PDF from the file manager on Windows and Android.
