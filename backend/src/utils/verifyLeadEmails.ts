export type VerifiableLead = {
  id: number
  email: string
  firstName: string
  lastName: string
}

export type VerifyLeadEmailsResult = {
  verifiedCount: number
  results: Array<{ leadId: number; emailVerified: boolean }>
  errors: Array<{ leadId: number; leadName: string; error: string }>
}

export type VerifyLeadEmailsDeps = {
  runVerifyEmailWorkflow: (lead: VerifiableLead) => Promise<boolean>
  persistVerification: (leadId: number, emailVerified: boolean) => Promise<void>
}

export async function verifyLeadEmailsBatch(
  leads: VerifiableLead[],
  deps: VerifyLeadEmailsDeps
): Promise<VerifyLeadEmailsResult> {
  const settled = await Promise.allSettled(
    leads.map(async (lead) => {
      const isVerified = await deps.runVerifyEmailWorkflow(lead)
      await deps.persistVerification(lead.id, Boolean(isVerified))
      return { leadId: lead.id, emailVerified: Boolean(isVerified) }
    })
  )

  const results: VerifyLeadEmailsResult['results'] = []
  const errors: VerifyLeadEmailsResult['errors'] = []

  settled.forEach((outcome, index) => {
    const lead = leads[index]
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value)
    } else {
      errors.push({
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName}`.trim(),
        error: outcome.reason instanceof Error ? outcome.reason.message : 'Unknown error',
      })
    }
  })

  return { verifiedCount: results.length, results, errors }
}