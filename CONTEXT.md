# Unmask

Unmask helps a person decide whether a message they received is a scam, verify it safely, and respond if they already engaged. This glossary fixes the vocabulary used across the analysis pipeline, UI and docs.

## Inputs

**Submission**:
Everything one person sends in one check: some combination of message text, a URL, raw email headers and one screenshot.
_Avoid_: Request, query, upload

**Exhibit**:
The suspicious message itself as Unmask shows it back, with red flags marked in place. A screenshot's exhibit is the text pulled out of it.
_Avoid_: Original, source text

**Evidence**:
The normalized, redacted facts taken from a Submission: exhibit text, URLs, phone numbers, email header fields and visual cues from a screenshot.
_Avoid_: Data, context, payload

**Visual Cue**:
Something only visible in a screenshot that bears on legitimacy, such as a brand logo, a fake "verified" badge or a spoofed app UI.

**Redaction**:
Masking a sensitive value (card number, SSN, account number, one-time code) in the Evidence before any model sees it.
_Avoid_: Anonymization, scrubbing

## Assessment

**Signal**:
One deterministic, explainable observation about the Evidence, for example "domain is a lookalike of paypal.com" or "asks for payment in gift cards". Each Signal has a severity.
_Avoid_: Rule, heuristic, indicator

**Hard Signal**:
A Signal strong enough that, alone, it means the Submission cannot be Likely safe; two of them mean Scam.

**Red Flag**:
A reason the message looks fraudulent, tied to an exact quote from the Exhibit and a plain-language explanation. It can come from a Signal or from the model.
_Avoid_: Warning, issue, finding

**Claimed Identity**:
Who the sender pretends or claims to be (a bank, a government agency, a boss, a grandchild).
_Avoid_: Sender, impersonated party

**Scam Type**:
The category of fraud from a fixed list: bank impersonation, government impersonation, delivery, tech support, job, romance, crypto investment, invoice/CEO fraud, family emergency, prize/lottery, account takeover/OTP theft, other, or none (no scam pattern found).

**Risk Score**:
A number from 0 to 100 that says how likely the Submission is to be fraudulent.

**Verdict**:
The final answer for a Submission: **Scam**, **Suspicious** or **Likely safe**. It comes with a Risk Score, Red Flags, a Claimed Identity, a Scam Type, a Verification Plan and Recovery Steps. "Likely safe" never means "safe".
_Avoid_: Result, classification, prediction

**Signal Floor**:
The minimum Risk Score that Hard Signals impose on a Verdict, whatever the model says.
_Avoid_: Override, clamp

**Degraded Verdict**:
A Verdict built from Signals alone because the model was unavailable. It is always labeled as such.
_Avoid_: Fallback result, offline mode

## Response

**Verification Plan**:
Ordered steps to confirm the Claimed Identity through an Independent Channel before doing anything the message asks.

**Independent Channel**:
A way to reach the real organization or person that the user found themselves (the number on the back of a card, the official app, a known phone number) and that is never taken from the message.
_Avoid_: Official contact, callback number

**Recovery Steps**:
Ordered actions for someone who already engaged, keyed to what they did: clicked, paid, shared credentials, shared a code, or installed software.
_Avoid_: Remediation, incident response

**Safe Word**:
A memorable phrase a family agrees on offline, used to check that an urgent call or message really comes from them.
_Avoid_: Password, passphrase
