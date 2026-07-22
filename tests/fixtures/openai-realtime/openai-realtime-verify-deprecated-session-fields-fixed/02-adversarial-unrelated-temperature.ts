// Adversarial: a 'temperature' field on an unrelated object that is not a
// Realtime session.update payload (different `type`, no nested `session`).
const thermostatConfigMsg = {
  type: 'thermostat.update',
  session: {
    temperature: 0.6,
  },
};

export default thermostatConfigMsg;
