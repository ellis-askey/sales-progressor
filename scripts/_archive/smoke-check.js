const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Test 5: brand-new transaction — Brixton (Agency A, new stage)
  const newTx = await prisma.propertyTransaction.findFirst({
    where: { propertyAddress: { contains: 'Cavendish Road' } },
    select: { id: true, propertyAddress: true },
  });

  const newDefs = await prisma.$queryRawUnsafe(`
    SELECT md.code, mc.state FROM "MilestoneCompletion" mc
    JOIN "MilestoneDefinition" md ON md.id = mc."milestoneDefinitionId"
    WHERE mc."transactionId" = '${newTx.id}'
    AND md.code IN ('VM1','VM2','VM3','VM4','VM5','VM6','VM7','PM1','PM2','PM3','PM4','VM18','PM25')
    ORDER BY md.side, md."orderIndex"
  `);
  console.log('Test 5 — Brand-new:', newTx.propertyAddress);
  console.log('  Expected: VM1/VM2/PM1/PM2 available, downstream locked, VM18/PM25 locked');
  newDefs.forEach(r => console.log(' ', r.code.padEnd(5), r.state));

  // Test 6: post-exchange transaction — Birchwood Lane (Agency A, post_exchange)
  const postTx = await prisma.propertyTransaction.findFirst({
    where: { propertyAddress: { contains: 'Birchwood Lane' } },
    select: { id: true, propertyAddress: true },
  });

  const postCodes = await prisma.$queryRawUnsafe(`
    SELECT md.code, mc.state, mc."eventDate", mc."reconciledAtExchange"
    FROM "MilestoneCompletion" mc
    JOIN "MilestoneDefinition" md ON md.id = mc."milestoneDefinitionId"
    WHERE mc."transactionId" = '${postTx.id}'
    AND md.code IN ('VM10','VM11','VM12','PM14','PM15','VM18','PM25','VM19','PM26','VM20','PM27')
    ORDER BY md.side, md."orderIndex"
  `);
  console.log('\nTest 6 — Post-exchange:', postTx.propertyAddress);
  console.log('  Expected: VM19 complete with eventDate, PM26 complete with eventDate, VM10/11/12/PM14/15 reconciledAtExchange=true, VM20/PM27 locked');
  postCodes.forEach(r => {
    const ev = r.eventDate ? 'eventDate=' + new Date(r.eventDate).toISOString().split('T')[0] : '';
    const rec = r.reconciledAtExchange ? 'reconciledAtExchange=true' : '';
    console.log(' ', r.code.padEnd(5), r.state.padEnd(12), ev, rec);
  });

  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
