import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { OnChainMonitorService, ParsedEvent, OnChainEventType } from './on-chain-monitor.service';
import { StateSyncService } from './state-sync.service';

/**
 * EventRoutingService maps events to their corresponding handlers
 * based on event type and module.
 *
 * This service provides a centralized registry for event handlers
 * and routes parsed events to the appropriate handler for processing.
 */

export interface EventHandler {
  eventType: string;
  module: string;
  handler: (event: ParsedEvent) => Promise<void>;
}

@Injectable()
export class EventRoutingService implements OnModuleInit {
  private readonly logger = new Logger(EventRoutingService.name);
  private handlers: Map<string, EventHandler> = new Map();

  constructor(
    @Inject(OnChainMonitorService)
    private onChainMonitor: OnChainMonitorService,
    @Inject(StateSyncService)
    private stateSync: StateSyncService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing EventRoutingService');

    // Register all handlers
    this.registerHandlers();

    this.logger.log(`Registered ${this.handlers.size} event handlers`);
  }

  /**
   * Register all event handlers
   */
  private registerHandlers(): void {
    // Send module handlers
    this.registerHandler({
      eventType: OnChainEventType.SEND_EVENT,
      module: 'send',
      handler: (event) => this.handleSendEvent(event),
    });

    // Pool module handlers
    this.registerHandler({
      eventType: OnChainEventType.POOL_CREATED,
      module: 'pool',
      handler: (event) => this.handlePoolCreatedEvent(event),
    });

    this.registerHandler({
      eventType: OnChainEventType.POOL_CONTRIBUTED,
      module: 'pool',
      handler: (event) => this.handlePoolContributedEvent(event),
    });

    this.registerHandler({
      eventType: OnChainEventType.POOL_EXECUTED,
      module: 'pool',
      handler: (event) => this.handlePoolExecutedEvent(event),
    });

    // Yield module handlers
    this.registerHandler({
      eventType: OnChainEventType.YIELD_DEPOSITED,
      module: 'yield',
      handler: (event) => this.handleYieldDepositedEvent(event),
    });

    this.registerHandler({
      eventType: OnChainEventType.YIELD_ACCRUED,
      module: 'yield',
      handler: (event) => this.handleYieldAccruedEvent(event),
    });

    // Circle module handlers
    this.registerHandler({
      eventType: OnChainEventType.CIRCLE_CREATED,
      module: 'circle',
      handler: (event) => this.handleCircleCreatedEvent(event),
    });

    this.registerHandler({
      eventType: OnChainEventType.CIRCLE_PAYOUT_TRIGGERED,
      module: 'circle',
      handler: (event) => this.handleCirclePayoutTriggeredEvent(event),
    });

    // RateLock module handlers
    this.registerHandler({
      eventType: OnChainEventType.RATELOCK_CREATED,
      module: 'ratelock',
      handler: (event) => this.handleRateLockCreatedEvent(event),
    });

    this.registerHandler({
      eventType: OnChainEventType.RATELOCK_FILLED,
      module: 'ratelock',
      handler: (event) => this.handleRateLockFilledEvent(event),
    });

    this.registerHandler({
      eventType: OnChainEventType.RATELOCK_EXPIRED,
      module: 'ratelock',
      handler: (event) => this.handleRateLockExpiredEvent(event),
    });

    // Bridge module handlers
    this.registerHandler({
      eventType: OnChainEventType.BRIDGE_CCTP_COMPLETED,
      module: 'bridge',
      handler: (event) => this.handleBridgeCctpCompletedEvent(event),
    });

    this.registerHandler({
      eventType: OnChainEventType.BRIDGE_WORMHOLE_COMPLETED,
      module: 'bridge',
      handler: (event) => this.handleBridgeWormholeCompletedEvent(event),
    });
  }

  /**
   * Register an event handler
   */
  private registerHandler(handler: EventHandler): void {
    this.handlers.set(handler.eventType, handler);

    // Subscribe to this event type on the monitor
    this.onChainMonitor.onEvent(
      handler.eventType,
      (event: ParsedEvent) => this.routeEvent(event, handler),
    );

    this.logger.debug(`Registered handler: ${handler.eventType}`);
  }

  /**
   * Route event to appropriate handler
   */
  private async routeEvent(
    event: ParsedEvent,
    handler: EventHandler,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Routing event: ${event.eventType} -> ${handler.module}`,
      );

      await handler.handler(event);

      this.logger.debug(
        `Event handled successfully: ${event.eventType}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling event ${event.eventType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Send module handlers
   */
  private async handleSendEvent(event: ParsedEvent): Promise<void> {
    this.logger.debug(`Handling SendEvent: ${event.digest}`);
    // Handler is delegated to StateSyncService
  }

  /**
   * Pool module handlers
   */
  private async handlePoolCreatedEvent(event: ParsedEvent): Promise<void> {
    this.logger.debug(`Handling PoolCreatedEvent: ${event.digest}`);
  }

  private async handlePoolContributedEvent(event: ParsedEvent): Promise<void> {
    this.logger.debug(`Handling PoolContributedEvent: ${event.digest}`);
  }

  private async handlePoolExecutedEvent(event: ParsedEvent): Promise<void> {
    this.logger.debug(`Handling PoolExecutedEvent: ${event.digest}`);
  }

  /**
   * Yield module handlers
   */
  private async handleYieldDepositedEvent(event: ParsedEvent): Promise<void> {
    this.logger.debug(`Handling YieldDepositedEvent: ${event.digest}`);
  }

  private async handleYieldAccruedEvent(event: ParsedEvent): Promise<void> {
    this.logger.debug(`Handling YieldAccruedEvent: ${event.digest}`);
  }

  /**
   * Circle module handlers
   */
  private async handleCircleCreatedEvent(event: ParsedEvent): Promise<void> {
    this.logger.debug(`Handling CircleCreatedEvent: ${event.digest}`);
  }

  private async handleCirclePayoutTriggeredEvent(
    event: ParsedEvent,
  ): Promise<void> {
    this.logger.debug(
      `Handling CirclePayoutTriggeredEvent: ${event.digest}`,
    );
  }

  /**
   * RateLock module handlers
   */
  private async handleRateLockCreatedEvent(event: ParsedEvent): Promise<void> {
    this.logger.debug(`Handling RateLockCreatedEvent: ${event.digest}`);
  }

  private async handleRateLockFilledEvent(event: ParsedEvent): Promise<void> {
    this.logger.debug(`Handling RateLockFilledEvent: ${event.digest}`);
  }

  private async handleRateLockExpiredEvent(event: ParsedEvent): Promise<void> {
    this.logger.debug(`Handling RateLockExpiredEvent: ${event.digest}`);
  }

  /**
   * Bridge module handlers
   */
  private async handleBridgeCctpCompletedEvent(
    event: ParsedEvent,
  ): Promise<void> {
    this.logger.debug(`Handling BridgeCctpCompletedEvent: ${event.digest}`);
  }

  private async handleBridgeWormholeCompletedEvent(
    event: ParsedEvent,
  ): Promise<void> {
    this.logger.debug(
      `Handling BridgeWormholeCompletedEvent: ${event.digest}`,
    );
  }

  /**
   * Get handler for event type
   */
  public getHandler(eventType: string): EventHandler | undefined {
    return this.handlers.get(eventType);
  }

  /**
   * Get all registered handlers
   */
  public getAllHandlers(): EventHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Check if handler exists for event type
   */
  public hasHandler(eventType: string): boolean {
    return this.handlers.has(eventType);
  }
}
