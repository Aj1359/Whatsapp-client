import { pool } from '../db/pool.js';
import { logger } from '../config/logger.js';

/**
 * Evaluates sequence follow-ups for contacts:
 * Sequences: active boolean, trigger_campaign_id
 * Steps: sequence_id, step_no, delay_hours, template_id, condition:
 *        'always' | 'no_reply' | 'delivered_not_read' | 'read_no_reply' | 'failed'
 * Sequence State: contact_id, sequence_id, current_step, next_run_at, status:
 *                 'active' | 'completed' | 'exited_reply' | 'exited_optout' | 'exited_manual'
 */
export async function processFollowUpSequences(): Promise<number> {
  let client;
  let triggeredCount = 0;
  try {
    client = await pool.connect();

    // 1. Exit sequences for contacts who opted out
    await client.query(`
      UPDATE sequence_state ss
      SET status = 'exited_optout'
      FROM contacts c
      WHERE ss.contact_id = c.id
        AND c.status = 'opted_out'
        AND ss.status = 'active'
    `);

    // 2. Exit sequences for contacts who replied after their sequence started
    await client.query(`
      UPDATE sequence_state ss
      SET status = 'exited_reply'
      FROM inbound_messages im
      WHERE ss.contact_id = im.contact_id
        AND im.received_at >= ss.next_run_at - INTERVAL '7 days'
        AND ss.status = 'active'
    `);

    // 3. Find due active sequence states
    const { rows: dueStates } = await client.query(`
      SELECT ss.contact_id, ss.sequence_id, ss.current_step,
             s.org_id, s.trigger_campaign_id,
             step.id as step_id, step.template_id, step.condition, step.delay_hours, step.variables,
             c.whatsapp_e164, c.status as contact_status,
             set.weekly_cap_per_contact
      FROM sequence_state ss
      JOIN sequences s ON ss.sequence_id = s.id
      JOIN sequence_steps step ON s.id = step.sequence_id AND step.step_no = ss.current_step
      JOIN contacts c ON ss.contact_id = c.id
      LEFT JOIN settings set ON s.org_id = set.org_id
      WHERE ss.status = 'active'
        AND s.active = true
        AND ss.next_run_at <= NOW()
        AND c.status = 'active'
      LIMIT 50
    `);

    for (const state of dueStates) {
      // Check weekly cap per contact
      const weeklyCap = state.weekly_cap_per_contact || 3;
      const { rows: weekCount } = await client.query(
        `SELECT COUNT(*)::int as count FROM messages
         WHERE contact_id = $1 AND org_id = $2 AND sent_at >= NOW() - INTERVAL '7 days'`,
        [state.contact_id, state.org_id]
      );

      if ((weekCount[0]?.count || 0) >= weeklyCap) {
        // Postpone next run by 24h due to weekly cap
        await client.query(
          `UPDATE sequence_state SET next_run_at = NOW() + INTERVAL '24 hours'
           WHERE contact_id = $1 AND sequence_id = $2`,
          [state.contact_id, state.sequence_id]
        );
        continue;
      }

      // Evaluate step condition against latest message in trigger campaign
      const { rows: lastMsg } = await client.query(
        `SELECT status FROM messages
         WHERE campaign_id = $1 AND contact_id = $2
         ORDER BY id DESC LIMIT 1`,
        [state.trigger_campaign_id, state.contact_id]
      );

      const msgStatus = lastMsg[0]?.status; // sent, delivered, read, failed
      let conditionMet = false;

      switch (state.condition) {
        case 'always':
          conditionMet = true;
          break;
        case 'no_reply':
          // Confirmed no reply already checked above in step 2
          conditionMet = true;
          break;
        case 'delivered_not_read':
          conditionMet = msgStatus === 'delivered';
          break;
        case 'read_no_reply':
          conditionMet = msgStatus === 'read';
          break;
        case 'failed':
          conditionMet = msgStatus === 'failed';
          break;
        default:
          conditionMet = false;
      }

      if (conditionMet) {
        // Queue the follow-up message
        const idempotencyKey = `seq_${state.sequence_id}_step_${state.current_step}_c_${state.contact_id}`;
        await client.query(
          `INSERT INTO messages (
             org_id, campaign_id, contact_id, step_id, idempotency_key, status, next_attempt_at
           ) VALUES ($1, $2, $3, $4, $5, 'queued', NOW())
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [state.org_id, state.trigger_campaign_id, state.contact_id, state.step_id, idempotencyKey]
        );
        triggeredCount++;
      }

      // Check if there is a next step
      const { rows: nextStep } = await client.query(
        `SELECT step_no, delay_hours FROM sequence_steps
         WHERE sequence_id = $1 AND step_no = $2 + 1`,
        [state.sequence_id, state.current_step]
      );

      if (nextStep.length > 0) {
        const nextDelay = nextStep[0].delay_hours || 24;
        await client.query(
          `UPDATE sequence_state
           SET current_step = current_step + 1,
               next_run_at = NOW() + ($1 || ' hours')::interval
           WHERE contact_id = $2 AND sequence_id = $3`,
          [nextDelay, state.contact_id, state.sequence_id]
        );
      } else {
        await client.query(
          `UPDATE sequence_state SET status = 'completed'
           WHERE contact_id = $1 AND sequence_id = $2`,
          [state.contact_id, state.sequence_id]
        );
      }
    }

    return triggeredCount;
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error processing follow-up sequences');
    return 0;
  } finally {
    if (client) client.release();
  }
}

