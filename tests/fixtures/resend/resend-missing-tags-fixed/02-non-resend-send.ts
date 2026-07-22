// Adversarial: a non-Resend `.send` call with no tags. It is not a Resend
// emails.send / batch.send, so it must not be flagged.
const queue = {
  send(_payload: unknown) {},
};

export function enqueueJob() {
  queue.send({ job: 'reindex', priority: 1 });
}
