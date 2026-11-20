/**
 * Secure Serverless Audit Logging Engine
 * Records all privileged administrator and owner actions with actor identification,
 * workspace tenant scoping, and immutable timestamping.
 */
export async function logAdminAction(supabaseAdmin, {
  workspaceId,
  actorId,
  action,
  resource = 'workspace',
  metadata = {}
}) {
  if (!supabaseAdmin || !workspaceId || !actorId || !action) return

  try {
    await supabaseAdmin.from('audit_logs').insert({
      workspace_id: workspaceId,
      actor_id: actorId,
      action,
      resource,
      metadata: typeof metadata === 'object' ? metadata : { raw: metadata },
      created_at: new Date().toISOString()
    })
  } catch (err) {
    console.warn('[Audit Log Notice]', err?.message || err)
  }
}
