-- Rename the survey step (critique #212): drop the "Level 2 or Level 3" detail
-- from the step name (it's now captured inside the confirm) and call it a
-- "private survey" to distinguish it from the lender's valuation. The agent
-- Steps tab personalises "Buyer has " -> "{names} has/have " at render time.
UPDATE "MilestoneDefinition"
SET "name" = 'Buyer has booked their private survey',
    "summaryTemplate" = '{agent} confirmed {purchasers} booked their private survey'
WHERE "code" = 'PM9';
