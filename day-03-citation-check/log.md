# Day 3 log: Citation Check

Notes from the build, 2 November 2026. This replaces Lender Check, which only covered Nigeria's FCCPC register.

## Before building

- **What already exists:** reference checkers are mostly paid or tied to one publisher.
- **The plan's sources:** Crossref (DOI registry, browser-friendly API), OpenAlex (an open index) and CourtListener's citation lookup.
- **CourtListener:** it needs a personal API token and takes POST requests only. So court citations link to CourtListener's citation pages instead of being checked in the app; a lookup inside the app would need every user to get a token.
- **A blocked environment:** this cloud environment blocks api.crossref.org, api.openalex.org and their documentation sites. The code follows the services' documented response formats, and the browser test answers from fixtures in those formats. The live call is the one thing left to try in a normal browser.

## Design

- **The style:** the draw for "report" dealt only styles already used on Days 1 and 5, so I drew for "workspace" and took *editorial-greeting*.
- **The face:** the verdict is the serif heading, set from the data ("8 references. 2 can't be found.").
- **Colour:** teal for what checks out, red only for the failing fact.

## Building

- **The thing to catch is a real DOI on the wrong paper,** a common invented-reference pattern. A DOI that exists isn't enough: the work it points to is compared with the title, authors and year as written.
- **DOIs can contain brackets** (Lancet DOIs such as 10.1016/S0140-6736(20)30183-5). A closing bracket is only trimmed when it's unbalanced.
- **Close matches say what differs** ("You wrote 2017; the record says 2015"). This is the usual shape of a citation copied from an AI answer.
- **A failed lookup is "Couldn't check", never "Not found",** so a blocked or offline request can't accuse anyone.

## Checks at the end

- **Node tests:** 5 of 5 pass.
- **Browser runs:** the sample list at 1440 and 390 px, light and dark, with all eight results right and no page errors. The offline path is tested too.
- **Lint:** 0 FAIL, 0 WARN.
- **Inspector:** the start screen shows 0 FAIL. Two WARN come from the dealt style (the 48px serif heading and the centred column).

## Still to do with a real person

- Open the live page in a normal browser and press "Try a sample list", to confirm Crossref and OpenAlex answer browser requests from GitHub Pages.
- Give it a real student essay's reference list, and a list a chatbot produced on request, and compare.
- Show it to a librarian: are the "not found" wording and the search links what they'd tell a student?
