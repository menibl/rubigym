// Capture historical prices only at checkout creation. Never reconstruct them
// from the current catalog when rendering an old receipt.
export function purchaseBreakdown(body, purchase, catalog = []) {
  const total = Number(purchase.amount);
  const credit = Number(purchase.creditAmount || 0);
  const money = n => Math.round(n * 100) / 100;
  let lines;
  if (purchase.groupLines?.length) {
    lines = purchase.groupLines.map(line => ({ memberId: line.memberId, memberName: line.memberName,
      membershipType: line.membershipType, label: line.label, quantity: line.includedSessions || 1,
      unitPrice: money(line.baseAmount / (line.includedSessions || 1)), baseAmount: line.baseAmount,
      discountAmount: line.discountAmount, netAmount: line.amount }));
  } else {
    const selections = purchase.familyMemberPlans?.length ? purchase.familyMemberPlans
      .filter(member => !member.participation || member.participation === 'INCLUDED')
      .flatMap(member => [member, ...(member.additionalPlans || [])].map(plan => ({ ...plan,
        memberId: member.memberId, memberName: member.memberName })))
      : [{ memberId: purchase.beneficiaryId || body.userId, memberName: body.userName,
        membershipType: body.membershipType, trainingSessionsCount: purchase.includedSessions }];
    lines = selections.map(selection => {
      const plan = catalog.find(item => item.id === selection.membershipType);
      const quantity = selection.trainingSessionsCount || 1;
      const unitPrice = typeof plan?.price === 'number' && Number.isFinite(plan.price) ? plan.price : undefined;
      return { memberId: selection.memberId, memberName: selection.memberName,
        membershipType: selection.membershipType, label: plan?.label || purchase.label,
        quantity, unitPrice, baseAmount: unitPrice === undefined ? undefined : money(unitPrice * quantity) };
    });
  }
  if (!purchase.familyMemberPlans?.length && lines.length === 1 && typeof purchase.baseAmount === 'number' && Number.isFinite(purchase.baseAmount)) {
    lines[0].baseAmount = purchase.baseAmount;
    lines[0].unitPrice = money(purchase.baseAmount / lines[0].quantity);
  }
  if (!Number.isFinite(total) || !Number.isFinite(credit) || credit < 0 || lines.length > 30) return undefined;
  const complete = lines.every(line => Number.isFinite(line.baseAmount) && line.baseAmount >= 0);
  const subtotal = complete ? money(lines.reduce((sum, line) => sum + line.baseAmount, 0)) : undefined;
  const discountAmount = subtotal === undefined ? undefined : money(subtotal - total - credit);
  // Special package pricing/legacy variants must not produce invented discounts.
  if (discountAmount !== undefined && discountAmount < 0) return { version: 1,
    lines: lines.map(({ unitPrice, baseAmount, ...line }) => line), total };
  if (lines.length === 1 && discountAmount !== undefined) Object.assign(lines[0], {
    discountAmount, netAmount: money(subtotal - discountAmount)
  });
  return { version: 1, lines, subtotal, discountAmount, creditAmount: credit, total };
}
