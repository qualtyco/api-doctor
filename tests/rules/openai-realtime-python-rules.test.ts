import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lintPythonFixture } from '../helpers/lint-python-rule.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/openai-realtime');

describe('openai-realtime-migrate-beta-to-ga (python)', () => {
  it('flags websockets.connect() sending the deprecated OpenAI-Beta header', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-migrate-beta-to-ga-broken'), [
      'openai-realtime-migrate-beta-to-ga',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-realtime-migrate-beta-to-ga').length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag GA connections or a non-OpenAI socket reusing the header name', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-migrate-beta-to-ga-fixed'), [
      'openai-realtime-migrate-beta-to-ga',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-realtime-migrate-beta-to-ga')).toHaveLength(0);
  });
});

describe('openai-realtime-send-safety-identifier (python)', () => {
  it('flags connections with no OpenAI-Safety-Identifier header', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-send-safety-identifier-broken'), [
      'openai-realtime-send-safety-identifier',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'openai-realtime-send-safety-identifier').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag a connection with the header present or a non-OpenAI socket', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-send-safety-identifier-fixed'), [
      'openai-realtime-send-safety-identifier',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-realtime-send-safety-identifier')).toHaveLength(0);
  });
});

describe('openai-realtime-avoid-dated-preview-snapshots (python)', () => {
  it('flags a URL pinned to a dated preview model snapshot', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-avoid-dated-preview-snapshots-broken'), [
      'openai-realtime-avoid-dated-preview-snapshots',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'openai-realtime-avoid-dated-preview-snapshots').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag the GA alias or a dated (non-preview) GA snapshot', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-avoid-dated-preview-snapshots-fixed'), [
      'openai-realtime-avoid-dated-preview-snapshots',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-realtime-avoid-dated-preview-snapshots')).toHaveLength(0);
  });
});

describe('openai-realtime-verify-deprecated-session-fields (python)', () => {
  it('flags session.update payloads that set temperature', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-verify-deprecated-session-fields-broken'), [
      'openai-realtime-verify-deprecated-session-fields',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'openai-realtime-verify-deprecated-session-fields').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag a session with no temperature or temperature on an unrelated object', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-verify-deprecated-session-fields-fixed'), [
      'openai-realtime-verify-deprecated-session-fields',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-realtime-verify-deprecated-session-fields')).toHaveLength(0);
  });
});

describe('openai-realtime-transcription-model-choice (python)', () => {
  it('flags input_audio_transcription configured with whisper-1', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-transcription-model-choice-broken'), [
      'openai-realtime-transcription-model-choice',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'openai-realtime-transcription-model-choice').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag the streaming model or whisper-1 on an unrelated payload', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-transcription-model-choice-fixed'), [
      'openai-realtime-transcription-model-choice',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-realtime-transcription-model-choice')).toHaveLength(0);
  });
});

describe('openai-realtime-no-log-raw-message-payloads (python)', () => {
  it('flags raw message payloads logged verbatim', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-no-log-raw-message-payloads-broken'), [
      'openai-realtime-no-log-raw-message-payloads',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'openai-realtime-no-log-raw-message-payloads').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag logging a derived field or a non-OpenAI socket', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-no-log-raw-message-payloads-fixed'), [
      'openai-realtime-no-log-raw-message-payloads',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-realtime-no-log-raw-message-payloads')).toHaveLength(0);
  });
});

describe('openai-realtime-handle-error-server-event (python)', () => {
  it('flags a message loop that dispatches on type but never checks for "error"', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-handle-error-server-event-broken'), [
      'openai-realtime-handle-error-server-event',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'openai-realtime-handle-error-server-event').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag a handler with an error branch or no type dispatch at all', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-handle-error-server-event-fixed'), [
      'openai-realtime-handle-error-server-event',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-realtime-handle-error-server-event')).toHaveLength(0);
  });
});

describe('openai-realtime-reconnect-on-drop (python)', () => {
  it('flags a ConnectionClosed handler that only logs and never reconnects', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-reconnect-on-drop-broken'), [
      'openai-realtime-reconnect-on-drop',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-realtime-reconnect-on-drop').length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag a handler that reconnects, or a non-OpenAI socket', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-realtime-reconnect-on-drop-fixed'), [
      'openai-realtime-reconnect-on-drop',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-realtime-reconnect-on-drop')).toHaveLength(0);
  });
});

describe('openai-realtime-buffer-audio-until-session-ready (python)', () => {
  it('flags audio dropped instead of buffered while the socket is not open', () => {
    const diags = lintPythonFixture(
      join(fixtures, 'openai-realtime-buffer-audio-until-session-ready-broken'),
      ['openai-realtime-buffer-audio-until-session-ready'],
    );
    expect(
      diags.filter((d) => d.ruleKey === 'openai-realtime-buffer-audio-until-session-ready').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag buffered audio or an unrelated readyState check', () => {
    const diags = lintPythonFixture(
      join(fixtures, 'openai-realtime-buffer-audio-until-session-ready-fixed'),
      ['openai-realtime-buffer-audio-until-session-ready'],
    );
    expect(diags.filter((d) => d.ruleKey === 'openai-realtime-buffer-audio-until-session-ready')).toHaveLength(0);
  });
});
