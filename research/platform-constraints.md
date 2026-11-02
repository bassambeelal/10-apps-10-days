# Platform constraints

Collected 2026-11-01.

## Summary

Search limitation: WebSearch was unavailable for this run. The shared search budget was already used up, so no search results came back. Every fact below comes from official or vendor pages fetched directly on 2026-11-01, using URLs I already knew. No community reports were collected, so real-world timings are missing. Summaries came from a page-reading model; all URLs below loaded.

Main conclusions:
1. A new personal Play account cannot reach production inside a 10-day challenge. It takes 12 testers for 14 continuous days plus a review that usually takes up to 7 days, so 21+ days after the closed test starts. Google does not say whether later apps on the same account must repeat this, so assume each app does.
2. The routes that work within 24 hours are a PWA (no account, no review), a direct APK (GitHub Releases), Firebase App Distribution (free, 500 testers, Google sign-in), and Play internal testing (100 testers, builds arrive in minutes, but needs the $25 account verified first). F-Droid is not a 24-hour route.
3. Developer verification does not touch direct sideloading yet. Since 30 Sep 2026 it applies only to seven named stores, including Google Play, in Brazil, Indonesia, Singapore and Thailand. It expands globally in 2027, after which unregistered apps need a one-time advanced flow with a 24-hour wait, or ADB.
4. Sideloading does not escape the restricted permissions. Play Protect blocks internet-sourced installs that declare SMS, notification listener or accessibility in select markets (countries not listed). Reject ideas that depend on those three, for both Play and direct APK.
5. Web stack: Cloudflare is the safest free base, with unlimited static requests, 100k Worker requests/day, D1 and R2. Vercel Hobby bans commercial use and locks you out for up to 30 days after exceeding limits. Netlify Free pauses all sites when 300 credits run out, and each production deploy costs 15. Supabase Free allows 2 active projects, pauses after a week idle, and its built-in email is 2 messages/hour to team addresses only. Neon (100 projects) fits 10 separate databases better. Firebase Spark has no Functions, no Cloud Storage and no phone auth.
6. AI: Gemini's free tier is the main option, but Google may train on the data and humans may review it. Its terms say not to send sensitive or personal information, and EEA/UK/Swiss users require paid services. Cheap paid models are very low cost: at $0.10/$0.50 per million tokens, a call of 2,000 input and 500 output tokens costs about $0.00045 (my arithmetic), so $5 covers about 11,000 calls. Never ship a key in an APK. On-device LLMs cover too few phones to be the only path; classic ML Kit is the safer on-device choice.

Budget floor (my estimate): $0 is possible with PWAs, direct APKs, free subdomains and free AI tiers. A sensible minimum is about $40 to $50: $25 Play, about $12 domain, $5 to $10 AI credit.

Open gaps:
- Real-world Play identity verification time. Google publishes none, only that payment verification can take up to 5 days.
- Whether the closed test repeats per app.
- Gemini free-tier RPM/RPD numbers (shown only in AI Studio).
- Groq free-tier numbers (shown only in account settings).
- Play Protect's country list.
- Whether Android 17 has reached stable.
- Whether Play has its own rule for notification access.
- Limited distribution device cap: official pages conflict, 20 vs 50. Plan on 20.

A follow-up with search budget could fill these.

## Facts

### Play: account fee and eligibility

Google Play registration is a one-time US$25 fee. Applicant must be 18+. Prepaid cards are not accepted. A government ID and credit card under your legal name may be needed. The fee is not refunded if your information is judged invalid.

**What it means:** Needs a real non-prepaid card in the developer's legal name. Check this before Day 1, because a name mismatch costs the $25 and stalls Android distribution.

- https://support.google.com/googleplay/android-developer/answer/6112435

### Play: identity and device verification timing

Google states no turnaround for identity review. Payment method verification can take up to 5 days. New personal accounts must verify access to a real Android device through the Play Console mobile app before making an app available. You must verify before submitting apps. Documents must exactly match the payments profile.

**What it means:** Open the account at least a week before Day 1 and treat the wait as unknown. Keep a real Android phone ready. Do not plan any Play step on the same day as account creation.

- https://support.google.com/googleplay/android-developer/answer/10841920
- https://support.google.com/googleplay/android-developer/answer/13628312

### Play: closed testing requirement

Personal accounts created after 13 Nov 2023 must run a closed test with at least 12 testers opted in continuously for the preceding 14 days. A tester who opts out and back in restarts their count. Production and pre-registration stay disabled until this is met. You then apply with a questionnaire covering testers, engagement, feedback, audience and readiness. Review usually takes seven days or less but can run longer, and you may be told to keep testing if engagement is insufficient.

**What it means:** Play production cannot happen inside a 10-day window for a new personal account: 14 days + up to 7 days = 21+ days after the closed test starts. With no audience, recruiting 12 engaged testers is itself a task. The series should show this honestly: launch on web/APK during the 10 days and treat Play production as a later milestone for the 1 or 2 best apps. Starting a closed test now would finish after the challenge ends unless the challenge start is delayed by about 3 weeks.

- https://support.google.com/googleplay/android-developer/answer/14151465

### Play: per-app or per-account testing, and the organization route

The testing page frames the rule around each app ('run a closed test for their app') and does not say whether a second app on the same account must repeat it. Organization accounts need a D-U-N-S number, which is free but can take up to 30 days. The requirement page scopes testing to personal accounts.

**What it means:** Assume 10 Android apps could mean 10 separate closed tests until confirmed with Play support. An organization account is not a shortcut for this challenge because of the D-U-N-S lead time and because it needs a real organization.

- https://support.google.com/googleplay/android-developer/answer/14151465
- https://support.google.com/googleplay/android-developer/answer/13628312

### Play: review times

Google gives no fixed review time. Updates publish 'as soon as possible', and some apps get extended review of up to 7 days or longer in rare cases. Managed publishing lets you choose go-live after approval. Closed and open test links can take several hours after the first publish.

**What it means:** Never schedule an episode on a Play approval landing. Any Play step needs a buffer of about a week.

- https://support.google.com/googleplay/android-developer/answer/9859751
- https://support.google.com/googleplay/android-developer/answer/9845334

### Play: target API level

New apps and updates must target Android 16 (API 36) or higher, effective 31 Aug 2026. The extension period ran only to 1 Nov 2026, which is today. Separately, Play Protect shows an 'App Compatibility Too Low' warning for apps whose target SDK is more than two API levels behind.

**What it means:** Set targetSdk 36 in the shared project template from the start, including for direct APK builds.

- https://support.google.com/googleplay/android-developer/answer/11926878
- https://developers.google.com/android/play-protect/warning-dev-guidance

### Play: paperwork per app

The Data safety form is needed for apps on closed, open or production tracks, and it requires a linked privacy policy even if no data is collected. Apps active only on internal testing are exempt. Apps with accounts need an in-app deletion path plus a web page for requesting deletion.

**What it means:** Create one privacy policy template and one account-deletion page pattern on Day 0. Internal-only testing avoids this paperwork during the challenge.

- https://support.google.com/googleplay/android-developer/answer/10787469
- https://support.google.com/googleplay/android-developer/answer/13327111

### Play: spam, webview and minimum functionality

Play bans multiple apps with highly similar functionality, content or experience from one developer, and repetitive content that adds no value. Webview apps need permission from the website's owner, and wrapping a site to drive traffic is restricted. Apps with only limited functionality are not allowed.

**What it means:** Ten apps from one account must each do a distinct job. Reskins of one template are an account risk. A TWA of your own site passes the ownership test but still needs real functionality.

- https://support.google.com/googleplay/android-developer/answer/9899034
- https://support.google.com/googleplay/android-developer/answer/9898783

### Play: AI-generated content policy

The policy covers apps where a chatbot is central and apps that generate images or voice/video of real people. It does not cover, at this time, apps that only summarize non-AI content or productivity apps that use AI to improve an existing feature. Developers are responsible for preventing offensive output. The fetched page did not mention an in-app reporting requirement.

**What it means:** This favors the brief: an app doing one specific job with AI inside avoids this policy, while a chatbot-style app takes it on.

- https://support.google.com/googleplay/android-developer/answer/14094294

### Developer verification: dates and countries

Since 30 Sep 2026, registration is required for installs from participating stores in Brazil, Indonesia, Singapore and Thailand on certified Android 7+ devices. The seven stores are Google Play, HONOR App Market, OPPO App Market, Galaxy Store, Palm Store, V-Appstore and GetApps. Global expansion is planned for 2027. Play registered over 99% of apps automatically.

**What it means:** Already in force. A verified Play account covers the Play path. Publishing to Samsung, Xiaomi or similar stores for those four countries requires registration.

- https://android-developers.googleblog.com/2026/06/android-developer-verification.html
- https://developer.android.com/developer-verification
- https://developer.android.com/developer-verification/guides

### Developer verification: direct sideloading today

The FAQ says the 30 Sep deadline applies only to participating stores, and that verification does not apply yet to other stores or to apps users sideload directly. It also says install experience won't change in September. An earlier March post was worded more broadly and the June post narrowed it to participating stores. The FAQ and June post are the newer scope.

**What it means:** Direct APK from a website works without verification during this challenge, in all countries, on the FAQ's wording. Re-check on launch day because this is the rule most likely to change.

- https://developer.android.com/developer-verification/guides/faq
- https://android-developers.googleblog.com/2026/03/android-developer-verification-rolling-out-to-all-developers.html

### Developer verification: advanced flow and ADB

The advanced flow for unverified apps is a one-time setup: enable developer mode, confirm no one is coaching you, restart and reauthenticate, wait one day, then confirm with biometrics or PIN. Access then lasts 7 days or indefinitely, with a warning at install. ADB installs are unchanged and skip the wait. With the advanced flow off, updates to unregistered apps fail.

**What it means:** Apps in the series that are still unregistered when enforcement reaches a viewer's country will be close to uninstallable for normal users. Register any app you plan to keep before the 2027 rollout.

- https://developer.android.com/developer-verification/guides/faq
- https://android-developers.googleblog.com/2026/03/android-developer-verification.html

### Developer verification: account types and cost

Full distribution costs $25 and requires government photo ID and proof of address, and takes about 10 minutes with documents ready. Play Console accounts can also register off-Play apps. Limited distribution is free, needs no government ID, but needs 2-step verification and a linked Google payments profile. Recipients authorize via QR code or link plus on-device consent. It can upgrade but not downgrade. Device cap conflict: the overview, FAQ and blog posts say 20 devices, while the limited distribution page (updated 2026-10-28) says 50.

**What it means:** The $25 Play account covers both Play and off-Play registration, so do not pay twice. Plan on 20 devices. Limited distribution suits a closed friends group, not public viewers.

- https://developer.android.com/developer-verification/guides/full-distribution
- https://developer.android.com/developer-verification/guides/limited-distribution
- https://developer.android.com/developer-verification/guides/faq
- https://developer.android.com/developer-verification/guides

### 24-hour route: PWA

Chrome on devices with Google Mobile Services, and Samsung Internet on Samsung devices, install PWAs as WebAPKs with launcher icon and no developer signing. Other browsers such as Firefox, Edge, Opera and Brave create shortcuts instead. Chrome's install promotion needs HTTPS, a manifest with name, 192px and 512px icons, start_url and display, plus a tap and 30 seconds of viewing.

**What it means:** This is the fastest route to a real person's phone: no account, fee or review. Choose PWA for any app that does not need native-only access. Write install instructions for the browser fallback case.

- https://web.dev/learn/pwa/installation
- https://web.dev/articles/install-criteria

### 24-hour route: direct APK

GitHub Releases allows files under 2 GiB, with no cap on total release size or bandwidth. Cloudflare Pages limits each asset to 25 MiB. Direct install remains outside verification for now. Play Protect may warn on or recommend scanning apps it has not seen, and it may send them to Google for a code-level check.

**What it means:** Host APKs on GitHub Releases, or R2 if larger than 25 MiB. Cover the unknown-app install prompt and Play Protect warning in each video so viewers are not scared off.

- https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- https://developers.cloudflare.com/pages/platform/limits/
- https://support.google.com/googleplay/answer/2812853

### 24-hour route: Play internal testing

Internal testing takes up to 100 testers per app. New bundles reach testers within minutes, and first uploads are available immediately. Testers are added by email list and opt in through a link. Internal tests might not get standard policy review. New personal accounts cannot use production or pre-registration, but Google recommends starting with an internal test.

**What it means:** Best Play-based route within a day, once the account is verified. Limited to testers you know by email, so it does not suit an open public release. Internal testing is not the same as the required closed test.

- https://support.google.com/googleplay/android-developer/answer/9845334

### 24-hour route: Play internal app sharing

Upload an APK or AAB and share a link. Up to 100 users can download per link, and links expire after 60 days. Any signing key and debuggable builds are allowed. Testers must first tap the Play Store version 7 times in settings and turn on internal app sharing.

**What it means:** Fine for a few helpers. The tapping step is too much friction for public viewers.

- https://support.google.com/googleplay/android-developer/answer/9844679

### 24-hour route: Firebase App Distribution

App Distribution is listed as no-cost. Limits are 500 testers per project and 200 per group, with no-cost increases on request. Releases last 150 days, with 1,000 per app. Testers have 30 days to accept an invitation, invitations work once, and any Google account works. AAB releases also need the internal app sharing toggle.

**What it means:** Ship APKs, not AABs, to avoid the 7-tap step. Good for 10 to 500 known testers, with install analytics useful for the series. Whether Play Protect's internet-source block treats App Tester as a safe source is not documented on the pages read.

- https://firebase.google.com/pricing
- https://firebase.google.com/docs/app-distribution
- https://firebase.google.com/docs/app-distribution/troubleshooting
- https://firebase.google.com/docs/app-distribution/get-set-up-as-a-tester?platform=android

### Route: F-Droid

Submission is a merge request to fdroiddata. Staff review has no stated timeframe, and apps appear about 24 to 48 hours after merge. Source must be public with a FOSS license, built from source. Firebase, Google Play Services, Crashlytics and proprietary ad or tracking SDKs are banned unless a clean build flavor is offered.

**What it means:** Not a 24-hour route, and the ban conflicts with a Firebase-based stack. Only consider it as a post-challenge bonus for an open source, offline app.

- https://f-droid.org/docs/Inclusion_How-To/
- https://f-droid.org/docs/Inclusion_Policy/

### Route: Trusted Web Activity

A TWA shows your own site full screen through the user's browser, with Chrome support since version 72. Bubblewrap needs Node and produces a signed APK. Digital Asset Links (assetlinks.json) must match the signing key, or the browser bar stays visible.

**What it means:** One web app can become an Android APK the same day, and later reach Play without a rewrite. This suits a mixed web and Android challenge. Budget time for the common key-mismatch failure.

- https://developer.chrome.com/docs/android/trusted-web-activity
- https://developer.chrome.com/docs/android/trusted-web-activity/quick-start

### Permissions: sideloading does not escape them

In select markets (not listed), Play Protect blocks installation of apps from internet sources such as browsers, messaging apps or file managers if they declare SMS, notification listener or accessibility permissions. Consumer help says it may stop unverified apps that use sensitive permissions scammers target. Separately, Android 13+ restricted settings can lock settings such as accessibility until the user allows them in App info.

**What it means:** This matters most for idea selection. An idea built on SMS parsing, notification reading or accessibility fails on Play and may fail on direct APK. Reject these for the challenge unless the app works without them.

- https://developers.google.com/android/play-protect/warning-dev-guidance
- https://support.google.com/googleplay/answer/2812853
- https://support.google.com/android/answer/12623953

### Permissions: SMS and Call Log

Play allows these only for default SMS, Phone or Assistant handlers, with a Permissions Declaration Form. Exceptions are case by case for uses such as caller ID and spam detection, backup and restore, and companion apps. No review time is given. From 27 Jan 2027, phone-call account verification stops being a permitted READ_CALL_LOG use.

**What it means:** Bank-SMS parsers and call-log tools are not feasible on Play in the challenge. For login OTP use the SMS Retriever or User Consent API, which need no SMS permission.

- https://support.google.com/googleplay/android-developer/answer/10208820
- https://support.google.com/googleplay/android-developer/answer/16558241

### Permissions: Android 17 OTP SMS delay

Android 17 extends a three-hour delay to WebOTP-format messages for apps that hold SMS read permission but are not the intended recipient. Apps targeting Android 17 get the protection on standard SMS too. Google advises OTP extractors to move to SMS Retriever or User Consent. The docs page did not confirm whether Android 17 is stable.

**What it means:** Another reason not to build on reading SMS, even for sideloaded apps.

- https://developer.android.com/about/versions/17/behavior-changes-all

### Permissions: Accessibility

Play restricts AccessibilityService to helping people with disabilities. isAccessibilityTool is for apps with that core purpose. Others need in-app prominent disclosure, consent and a Play declaration with video. Deterministic rule-based automation is permitted, but autonomous AI-driven action is banned for non-exempt apps. Automation tools, assistants, monitoring apps, cleaners and launchers are not accessibility tools.

**What it means:** Rules out screen-reading AI agents and auto-tap tools on Play. A real assistive app is possible but needs a demo video and declaration, which do not fit one day.

- https://support.google.com/googleplay/android-developer/answer/10964491
- https://support.google.com/googleplay/android-developer/answer/16558241

### Permissions: notification access

Android 15 stops untrusted NotificationListenerService apps from reading unredacted content in notifications where an OTP is detected. Play Protect allows uses such as relaying to wearables or aggregating for focus, but disallows reading content without consent, and notification listener is in the sensitive-permission block. The fetched part of Play's sensitive permissions policy did not mention notification access, and that page was truncated.

**What it means:** Treat this as high risk for direct APK. On Play it may be less restricted than SMS, but this is unconfirmed, so check before committing an app to it.

- https://developer.android.com/about/versions/15/behavior-changes-all
- https://developers.google.com/android/play-protect/warning-dev-guidance
- https://support.google.com/googleplay/android-developer/answer/16558241

### Permissions: All Files Access

MANAGE_EXTERNAL_STORAGE is limited to core purposes such as file management, backup and restore, anti-virus, document management, on-device file search, encryption and device migration. It needs a Play declaration and approval. Accessing media files or letting users pick files are invalid uses.

**What it means:** Use MediaStore or the Storage Access Framework. Most ideas do not need this permission.

- https://support.google.com/googleplay/android-developer/answer/10467955

### Permissions: foreground services

Apps targeting Android 14+ must declare a foreground service type and matching permission. Play Console needs a declaration per type with description, impact, use case and a video link. Limits include shortService at about 3 minutes and mediaProcessing at about 6 of every 24 hours. Apps targeting Android 15+ cannot start dataSync from BOOT_COMPLETED. specialUse needs a justification reviewers see.

**What it means:** Avoid foreground services where WorkManager or normal in-app flow will do. Each type adds a video and a review item on Play.

- https://developer.android.com/develop/background-work/services/fgs/service-types
- https://support.google.com/googleplay/android-developer/answer/13392821

### Permissions: other Play restrictions with dates

READ_MEDIA_IMAGES and READ_MEDIA_VIDEO need a declaration and are allowed only if the Photo Picker is not enough. QUERY_ALL_PACKAGES and REQUEST_INSTALL_PACKAGES are limited to specific core uses. From 27 Jan 2027 broad contacts access is restricted to core needs, with the Contact Picker for others, and fine location rules tighten for apps targeting API 37+.

**What it means:** Default to the Photo Picker, Contact Picker and coarse location. Then fewer declarations are needed if an app later reaches Play.

- https://support.google.com/googleplay/android-developer/answer/16558241

### Hosting: Cloudflare Pages and Workers

Static asset requests are free and unlimited. Workers Free gives 100,000 requests/day and 10 ms CPU per request, and waiting on fetch or databases does not count as CPU. There is no wall-clock limit while the client stays connected, and 50 subrequests per request. Pages Free has 500 builds/month, 100 projects, 20,000 files and 1 concurrent build. KV allows only 1,000 writes/day.

**What it means:** The best free default for 10 apps, because a viral static page costs nothing. A Worker can also proxy AI calls without exposing keys. Daily limits reset at 00:00 UTC. Do not use KV for write-heavy features.

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/pages/platform/limits/

### Hosting: Vercel Hobby

Hobby is limited to non-commercial personal use; payments, ads and affiliate-focused sites count as commercial, donations do not. It includes 100 GB transfer, 1M function invocations, 4 CPU-hours, 200 projects and 100 deployments/day. If you exceed limits you usually wait 30 days. Pro is $20 per seat per month.

**What it means:** Any app with ads or payments needs Pro or another host. A traffic spike could take a demo down for up to 30 days, which is bad timing for a video series.

- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits/fair-use-guidelines

### Hosting: Netlify Free

Free has a hard 300 credits per cycle with no top-up. Each production deploy costs 15 credits, bandwidth costs 20 credits/GB, and compute costs 10 credits/GB-hour. When credits run out, all web projects are paused and show 'Site not available'.

**What it means:** About 20 production deploys a month across all apps, so a 10-app sprint could pause every site at once. Avoid it for this challenge.

- https://www.netlify.com/pricing/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/

### Hosting: GitHub Pages and Render

GitHub Pages allows 1 GB sites and a soft 100 GB/month, but bans commercial use including SaaS and handling of passwords or card numbers. Render Free services sleep after 15 minutes and take about one minute to wake. Render Free Postgres expires after 30 days, with deletion 14 days later.

**What it means:** GitHub Pages suits landing pages and the series site only. Render's sleep and database expiry would break apps that viewers try weeks after an episode airs.

- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://render.com/docs/free

### Database: Cloudflare D1, R2 and Turso

D1 Free gives 5M rows read/day, 100k rows written/day, 5 GB and 10 databases. Over a daily limit, queries fail until 00:00 UTC. R2 gives 10 GB-months, 1M Class A and 10M Class B operations, and free egress. Turso Free gives 100 databases, 5 GB, 500M reads and 10M writes monthly.

**What it means:** D1's 10 databases match 10 apps and sit next to Workers. Show users a friendly message on quota errors. R2 suits file uploads and larger APKs.

- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://turso.tech/pricing

### Database: Neon

Neon Free gives 100 projects, 100 CU-hours per project per month, 1 GB per project and 20 GB total, 5 GB egress per project, and auth up to 60,000 MAU per project. Compute suspends after 5 minutes idle and this cannot be turned off.

**What it means:** The best fit for 10 separate Postgres databases. Expect a cold-start delay on the first request after idle.

- https://neon.com/pricing

### Database and auth: Supabase

Free gives 2 active projects, 500 MB database, 50,000 MAU, 5 GB egress, 1 GB storage, and 500k Edge Function invocations. Projects pause after 1 week without activity. Pro starts at $25/month. Built-in auth email sends 2 messages/hour and only to organization team addresses. Custom SMTP lifts this, with a default of 30 per hour.

**What it means:** Ten apps do not fit in 2 projects, and paused apps break demos weeks later. Email sign-up fails for real users without custom SMTP. Use Google sign-in or set up Resend on Day 0.

- https://supabase.com/pricing
- https://supabase.com/docs/guides/auth/auth-smtp

### Database and auth: Firebase Spark

Spark gives Auth at 50K MAU and Firestore at 1 GiB, 50K reads, 20K writes and 20K deletes/day. Hosting gets 10 GB storage and 360 MB/day transfer. Cloud Functions and phone auth SMS are not on Spark. Cloud Storage requires Blaze; access to existing buckets ended 3 Feb 2026 for Spark. Quotas apply per project.

**What it means:** Fine for login and small data, with one project per app. File uploads or server logic force Blaze, so use R2 and Workers instead. The 360 MB/day Hosting cap is thin for a viral page.

- https://firebase.google.com/pricing
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

### Auth and email: Clerk and Resend

Clerk Free gives 50,000 MRU per app and unlimited apps, up to 3 social connections and a fixed 7-day session, with no MFA, passkeys or SMS codes. Branding stays. Pro is $25/month or $20 annually. Resend Free gives 3,000 emails/month, 100/day and 3 domains. Pro is $20/month.

**What it means:** Clerk's unlimited apps suit a 10-app run if a 7-day session is acceptable. Resend pairs with any email login, but needs a domain you own, and the 100/day cap could hit a viral launch.

- https://clerk.com/pricing
- https://resend.com/pricing

### Domains

Porkbun lists .com at $11.81 with the same renewal, .app at $8.75 then $14.93, .dev at $8.75 then $12.87, and .xyz at $2.04 then $14.21. .site and .online are $1.96 then $28.84. Cloudflare Registrar sells at cost with no markup across 430+ TLDs. is-a.dev offers free subdomains through a GitHub process.

**What it means:** Buy one domain and use subdomains for all 10 apps, about $12 total. It also supports custom email and Asset Links. Avoid cheap first-year TLDs because renewals can be 10 times higher. A free subdomain works if the budget is truly $0.

- https://porkbun.com/products/domains
- https://www.cloudflare.com/products/registrar/
- https://www.is-a.dev/

### AI: Gemini free tier and legal traps

Free-tier models include 2.5 Flash-Lite, 2.5 Flash and 3.x Flash models. Free-tier content is used to improve Google's products, and human reviewers may see it. The terms say 'Do not submit sensitive, confidential, or personal information'. Apps for EEA, Swiss or UK users may use only Paid Services. Users must be 18+, and apps may not be directed at under-18s.

**What it means:** The free tier cannot honestly power apps handling personal data, health, money, documents or student users under 18. Apps open to EU/UK users need paid mode, so state this on screen in the series.

- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/terms

### AI: Gemini limits, spend and price traps

Rate limits apply per project, not per key, and daily quotas reset at midnight Pacific. Free-tier numbers are shown only in AI Studio. Tier 1 caps at $250/month across linked projects, and prepaid starts at $5. At $0 balance all keys on the billing account stop. Project spend caps are experimental, with about 10 minutes of billing lag. Paid 2.5 Flash-Lite is $0.10/$0.40 per million tokens. Gemini 3.6 and 3.8 Flash rise from $0.75/$3.75 to $1.50/$7.50 on 1 Jan 2027. Search grounding costs $14 per 1,000 after 5,000/month on Gemini 3+.

**What it means:** Use a separate project per app so one viral app does not exhaust all quotas. Use prepaid as a hard ceiling. Avoid the 3.6 and 3.8 Flash models for now and keep the model name configurable. Avoid grounding unless the job needs it.

- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/billing
- https://ai.google.dev/gemini-api/docs/pricing

### AI: Groq

Groq has Free and Developer tiers. The docs table shows Developer plan base limits, such as 30 RPM, 1K RPD, 8K TPM and 200K TPD for gpt-oss-120b. Free numbers are in account settings. Limits apply per organization. Whisper large-v3-turbo costs $0.04/hour, is billed at a 10-second minimum, and has a 25 MB file limit on free.

**What it means:** Very cheap transcription, which suits voice-note ideas. All 10 apps share one organization limit, and short clips cost more than their length suggests.

- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/billing-faqs
- https://console.groq.com/docs/speech-to-text

### AI: OpenRouter, Cerebras and Hugging Face free options

OpenRouter free models allow 20 RPM and 50 requests/day, rising to 1,000/day after buying at least 10 credits. Cerebras has no permanent free tier, only $5 of credits expiring after 30 days, with 5 RPM. Hugging Face free users get no monthly Inference Provider credits, and PRO gets $2.

**What it means:** 50 requests a day only suits demos, not real users. Cerebras credit is a trial that would expire soon after the challenge. Do not plan on Hugging Face for free inference.

- https://openrouter.ai/docs/api-reference/limits
- https://inference-docs.cerebras.ai/support/rate-limits
- https://huggingface.co/docs/inference-providers/pricing

### AI: Cloudflare Workers AI

Workers AI gives 10,000 Neurons/day free, resetting at 00:00 UTC, then $0.011 per 1,000 Neurons on Workers Paid. Examples: llama-3.2-1b at $0.027/$0.201 per million tokens, Whisper at $0.0005 per audio minute, flux-1-schnell at $0.0000528 per 512x512 tile.

**What it means:** The simplest AI option on a Cloudflare stack, with no separate key to ship. Good for small classification, extraction and transcription jobs. The small models are weaker, so test on the real task.

- https://developers.cloudflare.com/workers-ai/platform/pricing/

### AI: cheap paid APIs

Prices per million input/output tokens. Claude Haiku 5.5 is $0.10/$0.50 for prompts up to 100k tokens, and $0.05/$0.25 with Batch; web search is $10 per 1,000. OpenAI gpt-5-nano is $0.05/$0.40 and gpt-4o-mini-transcribe is $0.003/minute, with no text free tier listed. DeepSeek Flash is $0.15/$0.60 off-peak and $0.30/$1.20 peak, with no free tier. Anthropic gives new users a small free credit.

**What it means:** $5 of credit covers about 11,000 calls of 2,000 input and 500 output tokens at $0.10/$0.50 (my arithmetic). For apps with personal data, a small paid budget is the honest choice. Watch per-model tokenizers, because Claude's newer models produce about 30% more tokens for the same text.

- https://platform.claude.com/docs/en/about-claude/pricing
- https://developers.openai.com/api/docs/pricing
- https://api-docs.deepseek.com/quick_start/pricing

### AI: protecting keys in client apps

Firebase AI Logic lets apps call Gemini through a proxy that keeps the key on the server, with App Check and configurable per-user rate limits. On the Gemini API, keys have no separate billing settings and all keys in a project share its cap.

**What it means:** Never put an API key in an APK or front-end bundle. Use a Worker proxy with per-device rate limits, or Firebase AI Logic. Show this in the series as a best-practice moment.

- https://firebase.google.com/docs/ai-logic
- https://ai.google.dev/gemini-api/docs/billing

### On-device AI: Gemini Nano via ML Kit GenAI

ML Kit GenAI runs on Gemini Nano through AICore, with no server cost per call and local processing. It is limited by a per-app quota (ErrorCode.BUSY), and a longer-term battery quota can also apply. Inference works only in the foreground. Summarize, proofread and rewrite have a narrower device list of mostly recent flagships. The Prompt API is in beta with no SLA. A Firebase hybrid fallback to cloud exists.

**What it means:** Privacy story is great for video, but most low and mid-range phones will not run it. Do not build a real-problem app on it alone, especially with an unknown target country. Always add a cloud or non-AI fallback.

- https://developers.google.com/ml-kit/genai
- https://developer.android.com/ai/gemini-nano
- https://developers.google.com/ml-kit/genai/prompt/android

### On-device AI: classic ML Kit

ML Kit processes on-device. Vision APIs include text recognition, barcode scanning, document scanner, face detection, pose detection and subject segmentation. Language APIs include translation, language ID, entity extraction and smart reply. Text recognition covers Latin, Chinese, Devanagari, Japanese and Korean. The fetched pages did not state pricing.

**What it means:** Offline scanning, OCR and translation need no API bill and do not depend on Gemini Nano device lists. This is the safer on-device base for Android apps. Check the pricing or terms note before claiming it is free.

- https://developers.google.com/ml-kit
- https://developers.google.com/ml-kit/vision/text-recognition/v2

### On-device AI: LiteRT-LM and MediaPipe

MediaPipe LLM Inference is in maintenance mode, with migration to LiteRT-LM recommended. It is optimized for high-end phones such as Pixel 8 and Samsung S23 or later, and emulators are unreliable. Models are too large to bundle in an APK and must be downloaded at runtime. LiteRT-LM supports Android, iOS, web and desktop with Gemma models.

**What it means:** Bundling your own LLM adds a large first-run download and needs a high-end phone. It can eat a full build day, so skip it unless privacy is the whole point of an app.

- https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference/android
- https://developers.google.com/edge/litert-lm

### On-device AI: web

Chrome built-in AI foundation APIs do not support Chrome for Android, and need 22 GB free plus more than 4 GB VRAM, or 16 GB RAM with 4+ cores. Transformers.js runs models in the browser via WASM or WebGPU, covering transcription, embeddings, summarization and classification. WebGPU is still experimental in many browsers.

**What it means:** Chrome built-in AI is desktop-only, so skip it for phone users. Transformers.js is the practical way to run small models with no server cost, but test on a mid-range phone before showing it.

- https://developer.chrome.com/docs/ai/get-started
- https://huggingface.co/docs/transformers.js/index
