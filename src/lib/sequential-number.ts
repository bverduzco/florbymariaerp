// src/lib/sequential-number.ts — generate unique sequential business IDs.
//
// The old pattern in many API routes was:
//
//   const count = await db.quote.count()
//   const quoteNumber = `QTE-${String(count + 1).padStart(4, "0")}`
//
// This breaks as soon as any record is deleted (leaving a gap in the
// sequence), or when seed data doesn't start at 1, or when seed data
// has gaps. The new pattern finds the MAX existing number with the
// given prefix and increments that — so we never reuse a number that
// was previously assigned (and possibly referenced elsewhere).
//
// Example: if the Quote table has QTE-0002, QTE-0003, QTE-0007 (QTE-0001
// was deleted, QTE-0004/5/6 were never created), the helper returns
// "QTE-0008" — not "QTE-0004" (which count+1 would have produced, and
// which doesn't collide here, but the count+1 logic would generate
// "QTE-0007" → collision).
//
// The helper is race-tolerant: if a concurrent request inserts the
// same number between our read and our write, the caller catches the
// unique-constraint error and retries (up to 5 times) with the next
// number.

type SequentialDbModel = {
  findFirst: (args: {
    where: { quoteNumber?: { startsWith: string }; expenseNumber?: { startsWith: string }; paymentNumber?: { startsWith: string }; lossNumber?: { startsWith: string }; executionNumber?: { startsWith: string }; adhocNumber?: { startsWith: string }; staffNumber?: { startsWith: string }; markerId?: { startsWith: string }; poNumber?: { startsWith: string }; orderNumber?: { startsWith: string } }
    orderBy: Record<string, "desc">
    select: Record<string, true>
  }) => Promise<{ [field: string]: string } | null>
}

/**
 * Generate the next sequential business ID by finding the MAX existing
 * number with the given prefix and incrementing it.
 *
 * @param db      Prisma client (typed loosely to avoid coupling).
 * @param model   Prisma model delegate name (e.g. "quote", "expense").
 * @param field   The unique field name on the model (e.g. "quoteNumber").
 * @param prefix  The string prefix (e.g. "QTE-", "EXP-", "PAY-").
 * @param padding Zero-pad width (default 4 → "0001").
 *
 * @returns The next sequential ID, e.g. "QTE-0008".
 *
 * If no existing records match the prefix, returns `${prefix}0001`.
 */
export async function generateSequentialNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  model: string,
  field: string,
  prefix: string,
  padding = 4,
): Promise<string> {
  // Find the max existing number with this prefix.
  // Prisma's findFirst with orderBy: { field: "desc" } returns the row
  // with the highest value when values sort lexicographically. As long
  // as we zero-pad consistently (QTE-0001, QTE-0002, ..., QTE-9999),
  // lexicographic order matches numeric order. Once you exceed 9999
  // you'd need a wider padding, but that's not a concern here.
  //
  // Using `where: { field: { startsWith: prefix } }` filters out any
  // rows whose number doesn't match our pattern (e.g. legacy rows with
  // a different prefix, or null values).
  const where = { [field]: { startsWith: prefix } }
  const last = await db[model].findFirst({
    where,
    orderBy: { [field]: "desc" },
    select: { [field]: true },
  })

  if (!last || !last[field]) {
    return `${prefix}${String(1).padStart(padding, "0")}`
  }

  // Parse the numeric suffix. The number might be embedded anywhere
  // in the string; we extract the trailing digits.
  const lastValue: string = last[field]
  const match = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`).exec(lastValue)
  if (!match) {
    // Last row's number doesn't match our pattern (e.g. was hand-edited).
    // Fall back to count + 1, which is the best we can do without
    // knowing the intended sequence.
    const fallbackCount = await db[model].count({ where })
    return `${prefix}${String(fallbackCount + 1).padStart(padding, "0")}`
  }

  const lastNum = parseInt(match[1], 10)
  return `${prefix}${String(lastNum + 1).padStart(padding, "0")}`
}

/**
 * Generate a sequential number with retry on unique-constraint failure.
 *
 * Use this when you need to insert a row immediately after generating
 * the number, and you want to tolerate the small race window where a
 * concurrent request might insert the same number first.
 *
 * The `insert` callback receives the candidate number and should attempt
 * the Prisma create. If it throws with a UNIQUE constraint error on
 * the target field, this helper retries with the next number.
 *
 * @returns The result of the successful `insert` call.
 */
export async function generateAndInsert<T>(
  generate: () => Promise<string>,
  insert: (number: string) => Promise<T>,
  options: { maxAttempts?: number; uniqueField?: string } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 5
  const uniqueField = options.uniqueField ?? ""
  let lastErr: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = await generate()
    try {
      return await insert(candidate)
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      // Prisma's unique-constraint error message contains the field
      // name and the constraint name. Match on either.
      const isUniqueConstraint =
        msg.includes("UNIQUE constraint") ||
        msg.includes("Unique constraint") ||
        msg.includes("already exists") ||
        (uniqueField && msg.includes(uniqueField))
      if (!isUniqueConstraint) throw e
      // Otherwise, fall through and retry with the next number.
    }
  }
  throw lastErr
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
