/** Cron endpoint — triggered by an external cron (e.g. Render Cron Job or GitHub Actions) */
import { Router } from 'express';
import { requireCronSecret } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { sendBroadcast, processFollowUps } from '../services/broadcastSender.js';

const router = Router();

/** POST /cron/scheduled-broadcasts — send broadcasts whose scheduled_at has passed */
router.post('/scheduled-broadcasts', requireCronSecret, async (req, res, next) => {
  try {
    const { data } = await supabase
      .from('broadcasts')
      .select('id')
      .eq('status', 'SCHEDULED')
      .lte('scheduled_at', new Date().toISOString());

    res.json({ triggered: data?.length ?? 0 });

    // Fire and forget
    for (const bc of data ?? []) {
      sendBroadcast(bc.id).catch(err =>
        logger.error({ err, broadcastId: bc.id }, 'Scheduled broadcast failed')
      );
    }
  } catch (err) {
    next(err);
  }
});

/** POST /cron/follow-ups — process pending follow-ups */
router.post('/follow-ups', requireCronSecret, async (req, res, next) => {
  try {
    res.json({ status: 'processing' });
    processFollowUps().catch(err => logger.error({ err }, 'Follow-ups processing failed'));
  } catch (err) {
    next(err);
  }
});

export default router;

