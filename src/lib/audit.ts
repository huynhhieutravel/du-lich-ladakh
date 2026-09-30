export async function logAudit(
  db: any,
  actorUserId: string,
  targetUserId: string | null,
  action: string,
  ipAddress: string | null,
  userAgent: string | null,
  metadata: any = {}
) {
  try {
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO AuditLog (id, actor_user_id, target_user_id, action, ip_address, user_agent, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      actorUserId,
      targetUserId,
      action,
      ipAddress,
      userAgent,
      JSON.stringify(metadata)
    ).run();
  } catch (err) {
    console.error('AuditLog Failed:', err);
    // Silent fail for audit logs to not break business logic, 
    // but in a strict enterprise system, this might throw.
  }
}
