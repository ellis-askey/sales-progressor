# Overlay Copy Audit — Sales Progressor

**Purpose:** Voice and phrasing review of all drawers and modals.
**Date extracted:** 2026-05-19
**Surfaces in scope:** Agent app (`/agent/*`) and internal dashboard (`/dashboard`)

## Audience guide

| Role | Surface | Sees |
|---|---|---|
| Director | Agent app | All agent overlays below |
| Negotiator | Agent app | All agent overlays below |
| Sales Progressor | Internal dashboard | Feedback components only (transactions not yet visible — known platform gap) |
| Admin | Internal dashboard | Feedback components only (same gap) |

---

## Agent surface — drawers

### ChaseDrawer
*`components/chase/ChaseDrawer.tsx`*

**Titles / headings**
- `{milestoneName}` (single milestone)
- `Chase all · {N} milestones` (multi-milestone)
- `Chase #{N}` (sub-header)

**Section labels**
- `Send via`
- `Tone`
- `Auto-selected · override if needed`
- `Send to` (WhatsApp contact picker header)

**Body text**
- `Drafted for {name} ({role})`
- `✏️ Message edited from generated version`

**Buttons**
- `Email`
- `WhatsApp`
- `CC {solicitorName} (solicitor)` (toggle)
- `Generate message` / `Generating…`
- `Send chase` / `Send via WhatsApp` / `Sending…`

**Placeholders**
- `Generate a message above, or type your own…` (email)
- `Generate a WhatsApp message above, or type your own…` (WhatsApp)

**Footer status text**
- `To: {email}` / `To: {email} · CC: {email}`
- `No email on file — will be logged only`
- `We'll log this and open WhatsApp`
- `↑ Select a contact above to send`

**Errors**
- `Please select which contact to WhatsApp.`
- `No email address on file — add one to a contact before sending.`
- `Too many requests — please wait a few minutes and try again.`
- `Generation failed`
- `Something went wrong. Please try again.`
- `Failed to log communication`
- `Logged but email delivery failed: {error}`
- `Too many emails sent — please wait before sending more.`
- `Send failed. Please try again.`

**Tone options**
- `Friendly`
- `Professional`
- `Polite Yet Firm`
- `Chase Up`
- `Urgent`
- `Final Reminder`
- `Recommended` (label on auto-selected tone)

---

### EditSaleDetailsDrawer
*`components/transaction/EditSaleDetailsDrawer.tsx`*

**Titles / headings**
- `Edit sale details`

**Section labels**
- `Property`
- `Address`
- `Tenure`
- `Purchase type`
- `Price & Fees` / `Price`
- `Purchase price`
- `Agent fee`
- `Referral fee`
- `Timeline`
- `Expected exchange date`
- `Completion date`

**Body / status text**
- `{label} · unsaved` (out-of-view dirty section chip)
- `{N} unsaved section(s)` (footer)
- `Algorithm predicts: {date}`
- `(algorithm: {date})`
- `Set once exchange is confirmed`
- `Current` / `After` (percentage comparison)
- `{N} left` (milestones remaining)
- `Steps that will be skipped`
- `Steps that will be re-activated`
- `Seller` / `Buyer` (side badge on milestone delta list)
- `was complete` (badge on milestone that was complete before change)

**Buttons**
- `Use a different date`
- `Clear override`
- `Preview & save`
- `Confirm changes`
- `Back`
- `Save`
- `Cancel`
- `Save all`
- `Discard changes`
- `Keep editing`
- `Close`
- `Change address`
- `Show fewer` / `Show {N} more`
- `Checking…` / `Saving…`

**Placeholders**
- `Street address`
- `Town / city`
- `Postcode`
- `e.g. 1.5` (percentage fee)
- `1,500` (flat fee)

**Errors**
- `Save failed — tap Save again to retry`
- `Failed to load address info`
- `Failed to save address`
- `Failed to load preview`
- `Failed to save sale details`

**Options**
- `Freehold` / `Leasehold`
- `Mortgage` / `Cash buyer` / `Cash from Proceeds`
- `Fixed £` / `Percentage %`
- `+ VAT` / `Inc VAT`
- `— no referral —`

**Inline modal — Address Consequence**
- Heading: `Change address?`
- Body (records exist): `This file has {N} communication(s) and {N} completed milestone(s) logged against the current address. These records will keep their references to the old address for audit purposes.`
- Body (no records): `The current address will be updated. Any historical records will keep their references to the old address for audit purposes.`
- Buttons: `Change address` / `Cancel`

**Inline modal — Unsaved Changes**
- Heading: `Unsaved changes`
- Body: `The following section has unsaved changes:` / `The following sections have unsaved changes:`
- Buttons: `Save all` / `Discard changes` / `Keep editing`

---

### ReconciliationDrawer
*`components/milestones/ReconciliationDrawer.tsx`*

**Titles / headings**
- `Confirm exchange`
- `Confirm completion`

**Sub-headings**
- `Exchange date + outstanding milestones`
- `Completion date + outstanding milestones`

**Section labels**
- `Steps not yet confirmed`
- `Date contracts exchanged`
- `Date sale completed`
- `Expected completion date (optional)` (exchange flow only)
- `{getEventDateLabel(item.code)} (blank = exclude)` (per-milestone date label)

**Helper text**
- `Pre-filled with today — change if it was different`
- `Tick the steps below that are done. We'll check them off at exchange. Leave a step unticked to exclude it.`

**Side labels**
- `Vendor` / `Purchaser`

**Buttons**
- `Cancel`
- `Confirm exchange` / `Confirm completion`
- `Show fewer` / `Show {N} more`

---

### ChainDrawer
*`components/chain/ChainDrawer.tsx`*

**Titles / headings**
- `Chain progress`
- `Track every linked sale`

**Empty states**
- `No chain linked to this sale`
- `Create a chain to track your sale's position and invite other agents to share updates.`
- `Chain created — add the first sale`
- `Add the sale above or below this one to start tracking the chain together.`

**Body text**
- `Delete this node?`
- `{N} agent(s) ready to invite`

**Buttons**
- `+ Create chain`
- `+ Add sale above`
- `+ Add sale below`
- `Confirm` (delete)
- `Cancel`
- `Send invites` / `Sending…`

**Toast messages**
- `1 invite sent`
- `{N} invites sent`
- `Failed to send invite`
- `Failed to remove`

---

### AddNodeDrawer
*`components/chain/AddNodeDrawer.tsx`*

**Titles / headings**
- `Edit sale` (edit mode)
- `Add sale above` / `Add sale below` (add mode)

**Direction pills**
- `↑ Above`
- `↓ Below`

**Section labels**
- `Property`
- `Agency`
- `Agent contact (optional — add email to send invite)`
- `Notes (only you see this)`

**Field labels**
- `Property address`
- `Agency name`
- `Agent name`
- `Agent email`
- `Contact number`

**Placeholders**
- `e.g. 47 Oak Road, Bristol`
- `e.g. Bristol Estates`
- `e.g. Sarah Jones`
- `agent@agency.co.uk`
- `07700 900000`
- `Any context about this link…`

**Helper / hint text**
- `Property address and agency name are required`
- `No invite will be sent — you can add an email later`
- `Enter a valid email address`
- `Invite will be sent now`
- `Invite will be sent when you save the chain`

**Buttons**
- `Cancel`
- `Save changes` / `Save and add above` / `Save and add below` / `Saving…`

**Errors**
- `Enter a valid email address`
- `Something went wrong. Please try again.`

---

## Agent surface — modals

### MortgageModal
*`components/milestones/MortgageModal.tsx`*

**Heading**
- `Is this buyer now using a mortgage?`

**Body**
- `Reinstating this will re-open the mortgage steps and update the purchase type.`

**Buttons**
- `Yes — mortgage buyer`
- `Reinstate without changing purchase type`
- `Cancel`

---

### SurveyNrConfirmModal
*`components/milestones/SurveyNrConfirmModal.tsx`*

**Heading**
- `No private survey required?`

**Body**
- `Please confirm the buyer does not require a private Level 2 or Level 3 survey. The survey report step will also be skipped.`

**Buttons**
- `Cancel`
- `Yes, skip these`

---

### UndoMilestoneModal
*`components/milestones/UndoMilestoneModal.tsx`*

**Headings**
- `Undo step`
- `{milestoneName} — what would you like to do?` (cascade)
- `Are you sure you want to undo "{milestoneName}"?` (no cascade)

**Body (no cascade)**
- `This step is undone — steps that follow stay as they are.`
- `Current` / `After`

**Option labels (cascade picker)**
- `Undo this step only`
  - `This step is undone — steps that follow stay as they are.`
  - `Progress: {N}% → {N}%`
  - `Note: {N} downstream step(s) is/are complete. They/It will stay complete and may need re-checking later if this step is permanently undone.`
- `Undo this step and linked steps`
  - `This step and all completed steps that follow are undone.`
  - `Progress: {N}% → {N}%`
  - `Note: {N} step(s) confirmed during exchange reconciliation will also be reversed.`
  - `reconciled` (badge)

**Buttons**
- `Cancel`
- `Undo step`
- `Undo step and {N} linked step(s)`
- `Undoing…`
- `Show fewer` / `Show {N} more`

---

### ExchangeCelebration
*`components/milestones/ExchangeCelebration.tsx`*

**Heading**
- `Exchange confirmed`

**Body**
- `{address}`
- `Contracts are now legally exchanged. Your fee is crystallised.`

**Buttons**
- `Continue`

---

### DuplicateAddressModal
*`components/transactions-v2/DuplicateAddressModal.tsx`*

**Heading**
- `Address already exists`

**Body**
- `There's already an active file for {address}.`
- `Assigned to {assignedTo}.` (when assignee exists)

**Buttons**
- `View existing file`
- `Create anyway`
- `Cancel`

---

### NavAwayModal
*`components/transactions-v2/NavAwayModal.tsx`*

**Heading**
- `Save your draft?`

**Body**
- `You have unsaved changes. Save them as a draft to come back later.`

**Buttons**
- `Discard changes`
- `Stay here`
- `Save draft` / `Saving…`

---

### StatusControl — Status dropdown + Withdrawal modal
*`components/transaction/StatusControl.tsx`*

**Status dropdown options**
- `Active`
- `On hold`
- `Completed`
- `Withdrawn`

**Withdrawal modal**
- Heading: `Mark as Withdrawn`
- Sub-heading: `Record why this transaction fell through`
- Section label: `Reason`
- Conditional section label: `Specify reason`
- Placeholder: `Enter the reason…`
- Buttons: `Cancel` / `Confirm withdrawal`

**Fall-through reason options**
- `Buyer withdrew`
- `Seller withdrew`
- `Chain broke`
- `Mortgage / finance issue`
- `Survey issues`
- `Gazundering (price chipped)`
- `Gazumping`
- `Solicitor delays`
- `Personal circumstances changed`
- `Other`

**Error toasts**
- `Couldn't update status — please try again`
- `Cannot mark as completed…` (server message, passed through directly)

---

### AddFirmModal — solicitors
*`components/solicitors/AddFirmModal.tsx`*

**Heading**
- `Add solicitor firm`

**Section label**
- `Case handler`

**Field labels**
- `Firm name`
- `Full name`
- `Direct line`
- `Email`

**Placeholders**
- `e.g. Carter & Wells Solicitors`
- `e.g. Sarah Patel`
- `020 7946 0000`
- `s.patel@firm.co.uk`

**Errors**
- `Enter the firm name`
- `Enter the case handler's name`
- `Enter a direct line number`
- `Phone number doesn't look right`
- `Enter an email address`
- `Email address doesn't look right`
- `Something went wrong`

**Buttons**
- `Cancel`
- `Save firm` / `Saving…`

---

### AddBrokerModal
*`components/brokers/AddBrokerModal.tsx`*

**Heading**
- `Add mortgage broker`

**Section label**
- `Broker contact`

**Field labels**
- `Brokerage name`
- `Full name`
- `Contact number`
- `Email`

**Placeholders**
- `e.g. Bright Future Mortgages`
- `e.g. James Morris`
- `07700 900 000`
- `j.morris@broker.co.uk`

**Errors**
- `Enter a valid email address`
- `Failed to create brokerage`
- `Something went wrong`

**Buttons**
- `Cancel`
- `Save brokerage` / `Saving…`

---

### WelcomeModal
*`components/agent/WelcomeModal.tsx`*
*First login only*

**Heading**
- `Welcome, {firstName}`

**Body**
- `Let's get your first file set up — it takes less than a minute.`
- `You can always add files any time from the dashboard.`

**Buttons**
- `Add my first sale`
- `Explore a quick tour`

---

### AccountDangerZone — Delete modal
*`components/agent/AccountDangerZone.tsx`*

**Section heading**
- `Account`

**Body (settings page)**
- `Download a copy of your data, or permanently delete your account.`

**Buttons (settings page)**
- `Download my data` / `Preparing…`
- `Delete my account`

**Modal heading**
- `Delete account`

**Modal body**
- `This will permanently delete your account and all associated data. This cannot be undone.`

**Field label**
- `Type your email address to confirm`

**Placeholder**
- `{userEmail}`

**Modal buttons**
- `Cancel`
- `Delete permanently` / `Deleting…`

**Toast messages**
- `Export downloaded`
- `Export failed — please try again`
- `Account deleted`

---

## Both surfaces — feedback

### FeedbackButton (floating bottom-right button)
*`components/feedback/FeedbackButton.tsx`*
*Seen by: directors, negotiators, sales progressors, admins*

**Trigger**
- Aria-label / title: `Send feedback`

**Modal heading**
- `Send feedback`

**Type options**
- `Bug report` / `Something isn't working`
- `Feature idea` / `Suggest an improvement`
- `General` / `Anything else`

**Placeholder**
- `Tell us what happened or what you'd like to see…`

**Buttons**
- `Send feedback` / `Sending…`

**Success state**
- `Thanks for your feedback!`
- `We'll review it shortly.`

---

### FeedbackWidget (slide-up panel)
*`components/feedback/FeedbackWidget.tsx`*
*Seen by: directors, negotiators, sales progressors, admins*

**Trigger button**
- Label: `Help`
- Aria-label: `Open feedback widget`

**Category screen**
- Heading: `Support & Feedback`
- Sub-heading: `How can we help today?`
- `Browse Help` / `Articles and guides`
- `Report an issue` / `Something's not working`
- `Suggest an improvement` / `Share your idea`
- `Ask a question` / `Get help and advice`

**Form headings**
- `Report an issue`
- `Suggest an improvement`
- `Ask a question`
- Sub-heading: `Please provide details to help us understand`

**Bug report fields**
- `What were you trying to do?` / `Describe what you were doing…`
- `What happened instead?` / `Describe what went wrong…`

**Suggestion fields**
- `What's the suggestion?` / `Tell us what would make this better…`
- `Why would this help?` / `Optional — what problem does it solve?`

**Question field**
- `What's your question?` / `Ask away — we'll get back to you soon…`

**Screenshot upload**
- `Screenshot (optional)` / `Screenshot`
- `Click or drag to upload screenshot`
- `Only PNG, JPG, GIF or WebP accepted.`
- `Max 5 MB.`
- `{N} KB`

**Submit buttons**
- `Send report` / `Send suggestion` / `Send question` / `Sending…`

**Success state**
- `Thanks!`
- `We'll get back to you within 1 business day.`
- `Done`

**Error state**
- `Couldn't send your message`
- `Please check your connection and try again.`
- `Try again` / `Cancel`
