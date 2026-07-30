import express from 'express';
import { verifyPassword, issueSession } from './auth-service';

// False-positive regression (audit: 662/706 FPs): a completely generic login
// route reading req.body. There is no Twilio evidence anywhere — flagging
// this for webhook signature validation was the dominant FP pattern.
const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await verifyPassword(email, password);
  if (!user) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const token = await issueSession(user.id);
  res.json({ token });
});

export default router;
