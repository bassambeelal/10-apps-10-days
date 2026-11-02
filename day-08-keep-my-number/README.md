# Day 8: Keep My Number

**Platform:** Android 8.0+ (Kotlin, Jetpack Compose, Material 3)
**Build it:** `gradlew assembleRelease` inside `app/` (APK about 1.3 MB)

## The problem

- **Who has it:** anyone with a second SIM, an old line in a drawer, or a number they only keep for the bank.
- **What it costs them:** an unused prepaid line is deactivated and later recycled to a stranger, along with the bank OTPs, alerts, wallets and account recoveries still tied to it. One reported case lost ₦100,000 when an old number was reassigned.
- **Proof it's real:** [ICIR](https://www.icirnigeria.org/regulatory-gaps-on-phone-number-recycling-fuel-data-breaches/), [Mobile ID World](https://mobileidworld.com/nigeria-faces-security-risks-from-phone-number-recycling-as-ncc-implements-new-policies/), [Respicio (Philippines)](https://www.respicio.ph/commentaries/sim-card-expiration-and-recovery-for-filipinos-abroad).

## The rule it uses

From the NCC's guidelines, as reported by [Vanguard (June 2025)](https://www.vanguardngr.com/2025/06/fg-sets-new-rules-to-deactivating-dormant-lines/amp/):

- **What counts as activity:** a *revenue generating event*, meaning outgoing or incoming calls or SMS, charged USSD sessions, data use, or any activity on the line that generates income for the operator.
- **After over 180 days with none:** the line is **inactive**.
- **After another 180 days (360 in all):** it's **eligible for churning and recycling**.
- **A 365-day figure:** the article quotes the QoS Regulation and Business Rules 2024 as 365 days. The app uses the earlier number, to be safe.

## What it does

- **Add every line:** a name, the network, the number (optional, shown masked), how many days since you last used it, and what's tied to it (bank OTPs, BVN, NIN, wallet, WhatsApp, email recovery).
- **Each line shows its stage:**
  - **Safe** (under 150 days);
  - **Use it soon** (150 to 180);
  - **Inactive** (181 to 359);
  - **Can be recycled** (360+).
- **Each line also shows:** the exact date it becomes inactive, and a bar towards day 360.
- **"I used it today"** resets the count in one tap.
- **A daily check** (an inexact alarm, no internet) posts a notification when any line needs using. It survives a reboot.
- **Wording:** it tells you what counts ("a call, an SMS, a charged USSD code or some data"), and that recharging alone may not count.

## Limits

- **It can't see your SIM's real usage.** Reading it would need phone and SMS permissions, which Google restricts and people rightly distrust. You tap "I used it today" yourself.
- **Networks may act earlier or later than the rule.** The app warns at 150 days, so you don't cut it close.
- **The rule comes from a press report** quoting the NCC's guidelines, linked in the app. It wasn't checked against the NCC's own published document.

## Tested

- **Unit tests:** 4 tests: every stage boundary (149, 150, 180, 181, 359, 360 days), the inactive and recycle dates, number masking, and a JSON round trip.
- **Not run on a phone yet** (see Day 2).
