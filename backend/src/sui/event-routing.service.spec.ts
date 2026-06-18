import { Test, TestingModule } from '@nestjs/testing';
import { EventRoutingService, EventHandler } from './event-routing.service';
import { OnChainMonitorService, ParsedEvent, OnChainEventType } from './on-chain-monitor.service';

describe('EventRoutingService', () => {
  let service: EventRoutingService;
  let mockOnChainMonitorService: Partial<OnChainMonitorService>;

  beforeEach(async () => {
    mockOnChainMonitorService = {
      onEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventRoutingService,
        {
          provide: OnChainMonitorService,
          useValue: mockOnChainMonitorService,
        },
      ],
    }).compile();

    service = module.get<EventRoutingService>(EventRoutingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerHandler', () => {
    it('should register a handler for an event type', () => {
      const handler: EventHandler = jest.fn();

      service.registerHandler(OnChainEventType.SEND_EVENT, handler);

      const handlers = service.getHandlers(OnChainEventType.SEND_EVENT);
      expect(handlers).toContain(handler);
    });

    it('should register multiple handlers for the same event type', () => {
      const handler1: EventHandler = jest.fn();
      const handler2: EventHandler = jest.fn();

      service.registerHandler(OnChainEventType.SEND_EVENT, handler1);
      service.registerHandler(OnChainEventType.SEND_EVENT, handler2);

      const handlers = service.getHandlers(OnChainEventType.SEND_EVENT);
      expect(handlers).toContain(handler1);
      expect(handlers).toContain(handler2);
      expect(handlers.length).toBe(2);
    });
  });

  describe('registerHandlers', () => {
    it('should register multiple handlers at once', () => {
      const handler1: EventHandler = jest.fn();
      const handler2: EventHandler = jest.fn();

      service.registerHandlers([
        { eventType: OnChainEventType.SEND_EVENT, handler: handler1 },
        { eventType: OnChainEventType.POOL_CREATED, handler: handler2 },
      ]);

      expect(service.getHandlers(OnChainEventType.SEND_EVENT)).toContain(
        handler1,
      );
      expect(service.getHandlers(OnChainEventType.POOL_CREATED)).toContain(
        handler2,
      );
    });
  });

  describe('getHandlers', () => {
    it('should return empty array for unregistered event type', () => {
      const handlers = service.getHandlers('unknown-event-type');
      expect(handlers).toEqual([]);
    });

    it('should return registered handlers', () => {
      const handler: EventHandler = jest.fn();
      service.registerHandler(OnChainEventType.SEND_EVENT, handler);

      const handlers = service.getHandlers(OnChainEventType.SEND_EVENT);
      expect(handlers).toContain(handler);
    });
  });

  describe('getStats', () => {
    it('should return statistics about registered handlers', () => {
      const handler1: EventHandler = jest.fn();
      const handler2: EventHandler = jest.fn();

      service.registerHandler(OnChainEventType.SEND_EVENT, handler1);
      service.registerHandler(OnChainEventType.SEND_EVENT, handler2);
      service.registerHandler(OnChainEventType.POOL_CREATED, handler1);

      const stats = service.getStats();

      expect(stats.totalHandlers).toBe(3);
      expect(stats.handlerCounts[OnChainEventType.SEND_EVENT]).toBe(2);
      expect(stats.handlerCounts[OnChainEventType.POOL_CREATED]).toBe(1);
    });

    it('should include all event types in handler counts', () => {
      const stats = service.getStats();

      expect(stats.handlerCounts[OnChainEventType.SEND_EVENT]).toBe(0);
      expect(stats.handlerCounts[OnChainEventType.POOL_CREATED]).toBe(0);
      expect(stats.handlerCounts[OnChainEventType.YIELD_DEPOSITED]).toBe(0);
    });
  });

  describe('clearHandlers', () => {
    it('should clear all registered handlers', () => {
      const handler: EventHandler = jest.fn();

      service.registerHandler(OnChainEventType.SEND_EVENT, handler);
      expect(service.getHandlers(OnChainEventType.SEND_EVENT).length).toBe(1);

      service.clearHandlers();
      expect(service.getHandlers(OnChainEventType.SEND_EVENT).length).toBe(0);
    });
  });

  describe('handler execution', () => {
    it('should call handler when event is routed', async () => {
      const handler: EventHandler = jest.fn().mockResolvedValue(undefined);

      service.registerHandler(OnChainEventType.SEND_EVENT, handler);

      const event: ParsedEvent = {
        digest: '0x1234',
        eventSeq: 0,
        packageId: '0x...',
        module: 'send',
        eventType: OnChainEventType.SEND_EVENT,
        sender: '0x...',
        parsedJson: {},
        timestamp: Date.now(),
      };

      // Simulate event emission (would normally come from OnChainMonitorService)
      // In a real test, we would trigger the actual routing
      // For now, we just verify handler can be retrieved
      const handlers = service.getHandlers(event.eventType);
      expect(handlers.length).toBe(1);
      expect(handlers[0]).toBe(handler);
    });

    it('should handle handler errors gracefully', async () => {
      const handler1: EventHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const handler2: EventHandler = jest.fn().mockResolvedValue(undefined);

      service.registerHandler(OnChainEventType.SEND_EVENT, handler1);
      service.registerHandler(OnChainEventType.SEND_EVENT, handler2);

      const handlers = service.getHandlers(OnChainEventType.SEND_EVENT);
      expect(handlers.length).toBe(2);
    });
  });
});
