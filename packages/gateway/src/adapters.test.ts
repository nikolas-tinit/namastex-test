import { describe, expect, test } from 'bun:test';
import { OmniToBrainAdapter } from './omni-to-brain.js';
import { BrainToOmniAdapter } from './brain-to-omni.js';
import type { ProcessResponse } from '@namastex/contracts';

describe('OmniToBrainAdapter', () => {
  test('adapts a full Omni payload', () => {
    const omniPayload = {
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: {
        correlationId: 'corr-123',
        instanceId: 'inst-1',
        channelType: 'whatsapp-baileys',
        chatId: 'chat-1',
        chatType: 'dm',
        personId: 'person-1',
        platformUserId: '5511999999999@s.whatsapp.net',
        senderName: 'João',
        isGroup: false,
        messageId: 'msg-1',
      },
      sessionData: {
        sessionId: 'sess-1',
        context: { previousAgent: 'support' },
      },
      stream: false,
      timeout: 20000,
    };

    const result = OmniToBrainAdapter.adapt(omniPayload);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content).toBe('Hello');
    expect(result.metadata.correlationId).toBe('corr-123');
    expect(result.metadata.channelType).toBe('whatsapp-baileys');
    expect(result.metadata.senderName).toBe('João');
    expect(result.sessionData?.sessionId).toBe('sess-1');
    expect(result.stream).toBe(false);
    expect(result.timeout).toBe(20000);
  });

  test('fills defaults for missing metadata', () => {
    const omniPayload = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const result = OmniToBrainAdapter.adapt(omniPayload);

    expect(result.metadata.instanceId).toBe('unknown');
    expect(result.metadata.channelType).toBe('unknown');
    expect(result.metadata.senderName).toBe('Unknown User');
    expect(result.metadata.isGroup).toBe(false);
    expect(result.metadata.correlationId).toBeTruthy(); // auto-generated
  });

  test('handles messages with files', () => {
    const omniPayload = {
      messages: [{
        role: 'user',
        content: 'Check this image',
        files: [{ name: 'photo.jpg', mimeType: 'image/jpeg', url: 'https://example.com/photo.jpg' }],
      }],
    };

    const result = OmniToBrainAdapter.adapt(omniPayload);
    expect(result.messages[0].files).toHaveLength(1);
    expect(result.messages[0].files![0].name).toBe('photo.jpg');
  });
});

describe('BrainToOmniAdapter', () => {
  const brainResponse: ProcessResponse = {
    response: 'Olá! Como posso ajudar?',
    metadata: {
      correlationId: 'corr-123',
      agentUsed: 'support',
      intent: 'greeting',
      confidence: 0.95,
      processingTimeMs: 1200,
      tokensUsed: 150,
      reviewPassed: true,
      model: 'claude-sonnet-4-20250514',
    },
    sessionUpdate: {
      context: { currentAgent: 'support', messageCount: 1 },
    },
  };

  test('adapts Brain response to Omni format', () => {
    const result = BrainToOmniAdapter.adapt(brainResponse);

    expect(result.response).toBe('Olá! Como posso ajudar?');
    expect(result.metadata.agentUsed).toBe('support');
    expect(result.metadata.intent).toBe('greeting');
    expect(result.metadata.confidence).toBe(0.95);
    expect(result.metadata.reviewPassed).toBe(true);
    expect(result.sessionUpdate?.context.currentAgent).toBe('support');
  });

  test('extracts simple text response', () => {
    const result = BrainToOmniAdapter.adaptSimple(brainResponse);
    expect(result).toBe('Olá! Como posso ajudar?');
  });
});
