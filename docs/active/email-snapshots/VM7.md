# VM7 — Seller's solicitor has issued the draft contract pack

Generated from `lib/email-skeletons/vm7.ts` by `scripts/render-email-snapshot.ts`. Every recipient × shape (× route × direction for bilateral) combination assembled and rendered as it would land in the inbox.

---

## Purchaser — hand-off nudge (Default direction (natural first-actor confirmed first))

Direction-stable, varies by **tenure × purchaseType** (2 × 3 = 6 bodies).

### Freehold × Mortgage

**Subject:** Contract pack on its way to your solicitor, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by the seller's side, and it's on its way to your solicitor.

When your solicitor lets you know it's landed, open your portal and tap the highlighted confirm button. That logs receipt on the file and triggers the next steps. Takes about ten seconds.

→ Open your portal
```

### Freehold × Cash buyer

**Subject:** Contract pack on its way to your solicitor, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by the seller's side, and it's on its way to your solicitor.

When your solicitor lets you know it's landed, open your portal and tap the highlighted confirm button. That logs receipt on the file and triggers the next steps. Takes about ten seconds.

→ Open your portal
```

### Freehold × Cash from proceeds

**Subject:** Contract pack on its way to your solicitor, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by the seller's side, and it's on its way to your solicitor.

When your solicitor lets you know it's landed, open your portal and tap the highlighted confirm button. That logs receipt on the file and triggers the next steps. Takes about ten seconds.

→ Open your portal
```

### Leasehold × Mortgage

**Subject:** Contract pack on its way to your solicitor, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by the seller's side, and it's on its way to your solicitor.

When your solicitor lets you know it's landed, open your portal and tap the highlighted confirm button. That logs receipt on the file and triggers the next steps. Takes about ten seconds.

→ Open your portal
```

### Leasehold × Cash buyer

**Subject:** Contract pack on its way to your solicitor, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by the seller's side, and it's on its way to your solicitor.

When your solicitor lets you know it's landed, open your portal and tap the highlighted confirm button. That logs receipt on the file and triggers the next steps. Takes about ten seconds.

→ Open your portal
```

### Leasehold × Cash from proceeds

**Subject:** Contract pack on its way to your solicitor, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by the seller's side, and it's on its way to your solicitor.

When your solicitor lets you know it's landed, open your portal and tap the highlighted confirm button. That logs receipt on the file and triggers the next steps. Takes about ten seconds.

→ Open your portal
```

---

## Vendor — acted-side acknowledgement

Varies by **direction × route × tenure × purchaseType** (2 × 3 × 2 × 3 = 36 bodies). Natural-order copy fires when this code confirms first in its pair; inverse-order copy fires when the counterpart confirmed first.

### Direction: Natural order (this code confirmed first) (`default`)

#### Route: Buyer/seller via portal (`client_portal`)

##### Freehold × Mortgage

**Subject:** You've confirmed the contract pack has gone out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed that your solicitor's sent the draft contract pack across to the buyer's side.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, and the property information forms you completed (TA6 and TA10).

The buyer's solicitor will now review everything and raise enquiries about anything they want clarified. Their first round typically lands with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Freehold × Cash buyer

**Subject:** You've confirmed the contract pack has gone out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed that your solicitor's sent the draft contract pack across to the buyer's side.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, and the property information forms you completed (TA6 and TA10).

The buyer's solicitor will now review everything and raise enquiries about anything they want clarified. Their first round typically lands with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Freehold × Cash from proceeds

**Subject:** You've confirmed the contract pack has gone out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed that your solicitor's sent the draft contract pack across to the buyer's side.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, and the property information forms you completed (TA6 and TA10).

The buyer's solicitor will now review everything and raise enquiries about anything they want clarified. Their first round typically lands with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Leasehold × Mortgage

**Subject:** You've confirmed the contract pack has gone out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed that your solicitor's sent the draft contract pack across to the buyer's side.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, the property information forms you completed (TA6, TA10, and TA7), and the management pack from your freeholder once that's in.

The buyer's solicitor will now review everything and raise enquiries about anything they want clarified. Their first round typically lands with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Leasehold × Cash buyer

**Subject:** You've confirmed the contract pack has gone out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed that your solicitor's sent the draft contract pack across to the buyer's side.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, the property information forms you completed (TA6, TA10, and TA7), and the management pack from your freeholder once that's in.

The buyer's solicitor will now review everything and raise enquiries about anything they want clarified. Their first round typically lands with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Leasehold × Cash from proceeds

**Subject:** You've confirmed the contract pack has gone out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed that your solicitor's sent the draft contract pack across to the buyer's side.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, the property information forms you completed (TA6, TA10, and TA7), and the management pack from your freeholder once that's in.

The buyer's solicitor will now review everything and raise enquiries about anything they want clarified. Their first round typically lands with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

#### Route: Agent on behalf (`agent`)

##### Freehold × Mortgage

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, and the property information forms you completed (TA6 and TA10).

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Freehold × Cash buyer

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, and the property information forms you completed (TA6 and TA10).

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Freehold × Cash from proceeds

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, and the property information forms you completed (TA6 and TA10).

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Leasehold × Mortgage

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, the property information forms you completed (TA6, TA10, and TA7), and the management pack from your freeholder once that's in.

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Leasehold × Cash buyer

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, the property information forms you completed (TA6, TA10, and TA7), and the management pack from your freeholder once that's in.

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Leasehold × Cash from proceeds

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, the property information forms you completed (TA6, TA10, and TA7), and the management pack from your freeholder once that's in.

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

#### Route: Sales Progressor on behalf (`sales_progressor`)

##### Freehold × Mortgage

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, and the property information forms you completed (TA6 and TA10).

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Freehold × Cash buyer

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, and the property information forms you completed (TA6 and TA10).

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Freehold × Cash from proceeds

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, and the property information forms you completed (TA6 and TA10).

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Leasehold × Mortgage

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, the property information forms you completed (TA6, TA10, and TA7), and the management pack from your freeholder once that's in.

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Leasehold × Cash buyer

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, the property information forms you completed (TA6, TA10, and TA7), and the management pack from your freeholder once that's in.

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

##### Leasehold × Cash from proceeds

**Subject:** Contract pack issued to the buyer's side, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, the property information forms you completed (TA6, TA10, and TA7), and the management pack from your freeholder once that's in.

The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.

→ View your portal
```

### Direction: Inverse order (counterpart confirmed first) (`inverse`)

#### Route: Buyer/seller via portal (`client_portal`)

##### Freehold × Mortgage

**Subject:** You've confirmed the contract pack went out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed your solicitor sent the contract pack across, and the buyer's side has already logged receipt on their end.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, title documents, and the property forms you completed.

Because the buyer's solicitor already has it, they'll be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Freehold × Cash buyer

**Subject:** You've confirmed the contract pack went out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed your solicitor sent the contract pack across, and the buyer's side has already logged receipt on their end.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, title documents, and the property forms you completed.

Because the buyer's solicitor already has it, they'll be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Freehold × Cash from proceeds

**Subject:** You've confirmed the contract pack went out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed your solicitor sent the contract pack across, and the buyer's side has already logged receipt on their end.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, title documents, and the property forms you completed.

Because the buyer's solicitor already has it, they'll be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Leasehold × Mortgage

**Subject:** You've confirmed the contract pack went out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed your solicitor sent the contract pack across, and the buyer's side has already logged receipt on their end.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, title documents, the property forms you completed, and the management pack from your freeholder.

Because the buyer's solicitor already has it, they'll be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Leasehold × Cash buyer

**Subject:** You've confirmed the contract pack went out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed your solicitor sent the contract pack across, and the buyer's side has already logged receipt on their end.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, title documents, the property forms you completed, and the management pack from your freeholder.

Because the buyer's solicitor already has it, they'll be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Leasehold × Cash from proceeds

**Subject:** You've confirmed the contract pack went out, 22 Example Road, London SW1A 1AA

```
Hi Alex,

Thanks. You've confirmed your solicitor sent the contract pack across, and the buyer's side has already logged receipt on their end.

The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, title documents, the property forms you completed, and the management pack from your freeholder.

Because the buyer's solicitor already has it, they'll be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

#### Route: Agent on behalf (`agent`)

##### Freehold × Mortgage

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Freehold × Cash buyer

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Freehold × Cash from proceeds

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Leasehold × Mortgage

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Leasehold × Cash buyer

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Leasehold × Cash from proceeds

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

#### Route: Sales Progressor on behalf (`sales_progressor`)

##### Freehold × Mortgage

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Freehold × Cash buyer

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Freehold × Cash from proceeds

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Leasehold × Mortgage

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Leasehold × Cash buyer

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

##### Leasehold × Cash from proceeds

**Subject:** Contract pack issuance logged, 22 Example Road, London SW1A 1AA

```
Hi Alex,

The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.

The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.

→ View your portal
```

---

## Progressor — internal log (shape-stable)

**Subject:** VM7 complete: Contract pack issued — 22 Example Road, London SW1A 1AA

```
Hi Alex,

Logged on 22 Example Road, London SW1A 1AA.

Seller's solicitor has confirmed issue of draft contract pack to buyer's solicitor.

→ View transaction
```

---
