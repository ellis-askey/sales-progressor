-- Item 9: hold an agent "Send to us" sale that arrives while the progression
-- business is in the day-7 "no card" blocked stage, until the owner adds a card.
-- Additive, nullable — safe. Cleared by releaseHeldSales on card-add.
ALTER TABLE "PropertyTransaction" ADD COLUMN "heldPendingCardAt" TIMESTAMP(3);
