import { AgentMailClient } from 'agentmail';

export const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
