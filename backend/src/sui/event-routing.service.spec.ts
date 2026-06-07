import { Test, TestingModule } from '@nestjs/testing';
import { EventRoutingService } from './event-routing.service';
import { OnChainMonitorService, OnChainEventType, ParsedEvent } from './on-chain-monitor.service';
import { StateSyncService } from './state-sync.service';

describe('EventRoutingService', () => {
  let service: EventRoutingService;
  let mockOnChainMonitor: any;
  let mockStateSync: any;

  beforeEach(async () => {
    mockOnChainMonitor = {
      onEvent: jest.fn(),
    };

    mockStateSync = {
      onEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventRoutingService,
        {
          provide: OnChainMonitorService,
          useValue: mockOnChainMonitor,
        },
        {
          provide: StateSyncService,
          useValue: mockStateSync,
        },
      ],
    }).compile();

    service = module.get<EventRoutingService>(EventRoutingService);
  });

  describe('initialization', () => {
    it('should register handlers on module init', () => {
      service.onModuleInit();

      expect(mockOnChainMonitor.onEvent).toHaveBeenCalled();
    });

    it('should register handlers for all module event types', async () => {
      await service.onModuleInit();

      const allHandlers = service.getAllHandlers();

      // Should have handlers for all 13 event types
      expect(allHandlers.length).toBeGreaterThanOrEqual(13);

      // Verify all event types are registered
      expect(service.hasHandler(OnChainEventType.SEND_EVENT)).toBe(true);
      expect(service.hasHandler(OnChainEventType.POOL_CREATED)).toBe(true);
      expect(service.hasHandler(OnChainEventType.YIELD_DEPOSITED)).toBe(true);
      expect(service.hasHandler(OnChainEventType.CIRCLE_CREATED)).toBe(true);
      expect(service.hasHandler(OnChainEventType.RATELOCK_CREATED)).toBe(true);
      expect(service.hasHandler(OnChainEventType.BRIDGE_CCTP_COMPLETED)).toBe(
        true,
      );
    });
  });

  describe('handler registration', () => {
    it('should retrieve handler by event type', async () => {
      await service.onModuleInit();

      const handler = service.getHandler(OnChainEventType.SEND_EVENT);

      expect(handler).toBeDefined();
      expect(handler?.eventType).toBe(OnChainEventType.SEND_EVENT);
      expect(handler?.module).toBe('send');
    });

    it('should return undefined for unknown event type', async () => {
      await service.onModuleInit();

      const handler = service.getHandler('unknown::event::type');

      expect(handler).toBeUndefined();
    });
  });

  describe('handler discovery', () => {
    it('should discover all module handlers', async () => {
      await service.onModuleInit();

      const allHandlers = service.getAllHandlers();
      const modules = new Set(allHandlers.map((h) => h.module));

      // Verify all modules are represented
      expect(modules.has('send')).toBe(true);
      expect(modules.has('pool')).toBe(true);
      expect(modules.has('yield')).toBe(true);
      expect(modules.has('circle')).toBe(true);
      expect(modules.has('ratelock')).toBe(true);
      expect(modules.has('bridge')).toBe(true);
    });

    it('should have multiple handlers for some modules', async () => {
      await service.onModuleInit();

      const allHandlers = service.getAllHandlers();
      const poolHandlers = allHandlers.filter((h) => h.module === 'pool');

      // Pool module should have 3 handlers
      expect(poolHandlers.length).toBe(3);

      const yieldHandlers = allHandlers.filter((h) => h.module === 'yield');

      // Yield module should have 2 handlers
      expect(yieldHandlers.length).toBe(2);
    });
  });

  describe('handler queries', () => {
    it('should check if handler exists', async () => {
      await service.onModuleInit();

      expect(service.hasHandler(OnChainEventType.SEND_EVENT)).toBe(true);
      expect(service.hasHandler('nonexistent::event')).toBe(false);
    });

    it('should get all handlers', async () => {
      await service.onModuleInit();

      const handlers = service.getAllHandlers();

      expect(Array.isArray(handlers)).toBe(true);
      expect(handlers.length).toBeGreaterThan(0);
      handlers.forEach((h) => {
        expect(h.eventType).toBeDefined();
        expect(h.module).toBeDefined();
        expect(h.handler).toBeDefined();
      });
    });
  });

  describe('event type coverage', () => {
    it('should have handlers for all Send module events', async () => {
      await service.onModuleInit();

      expect(service.hasHandler(OnChainEventType.SEND_EVENT)).toBe(true);
    });

    it('should have handlers for all Pool module events', async () => {
      await service.onModuleInit();

      expect(service.hasHandler(OnChainEventType.POOL_CREATED)).toBe(true);
      expect(service.hasHandler(OnChainEventType.POOL_CONTRIBUTED)).toBe(true);
      expect(service.hasHandler(OnChainEventType.POOL_EXECUTED)).toBe(true);
    });

    it('should have handlers for all Yield module events', async () => {
      await service.onModuleInit();

      expect(service.hasHandler(OnChainEventType.YIELD_DEPOSITED)).toBe(true);
      expect(service.hasHandler(OnChainEventType.YIELD_ACCRUED)).toBe(true);
    });

    it('should have handlers for all Circle module events', async () => {
      await service.onModuleInit();

      expect(service.hasHandler(OnChainEventType.CIRCLE_CREATED)).toBe(true);
      expect(service.hasHandler(OnChainEventType.CIRCLE_PAYOUT_TRIGGERED)).toBe(
        true,
      );
    });

    it('should have handlers for all RateLock module events', async () => {
      await service.onModuleInit();

      expect(service.hasHandler(OnChainEventType.RATELOCK_CREATED)).toBe(true);
      expect(service.hasHandler(OnChainEventType.RATELOCK_FILLED)).toBe(true);
      expect(service.hasHandler(OnChainEventType.RATELOCK_EXPIRED)).toBe(true);
    });

    it('should have handlers for all Bridge module events', async () => {
      await service.onModuleInit();

      expect(service.hasHandler(OnChainEventType.BRIDGE_CCTP_COMPLETED)).toBe(
        true,
      );
      expect(
        service.hasHandler(OnChainEventType.BRIDGE_WORMHOLE_COMPLETED),
      ).toBe(true);
    });
  });
});
