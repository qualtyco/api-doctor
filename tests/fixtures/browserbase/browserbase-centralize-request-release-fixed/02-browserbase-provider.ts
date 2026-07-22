// Adversarial: this inline sessions.update(..., { status: 'REQUEST_RELEASE' })
// call looks like the exact pattern other rules flag — but this file (named
// to match the provider/abstraction convention) is the one designated place
// this call is meant to live; every other call site should route through it.
import Browserbase from '@browserbasehq/sdk';

export class BrowserbaseRemoteProvider {
  private bb: Browserbase;

  constructor(apiKey: string) {
    this.bb = new Browserbase({ apiKey });
  }

  async requestStop(sessionId: string, projectId: string) {
    await this.bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE', projectId });
  }
}
