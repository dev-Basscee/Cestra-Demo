import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ModuleConfig {
  name: string;
  packageId: string;
  functions: Record<string, string>;
  gasbudget?: number;
}

export interface BlockchainConfig {
  network: string;
  rpcUrl: string;
  packageId: string;
  modules: Record<string, ModuleConfig>;
  defaultGasBudget: number;
}

@Injectable()
export class BlockchainConfigService {
  private readonly logger = new Logger(BlockchainConfigService.name);
  private readonly config: BlockchainConfig;

  constructor(private configService: ConfigService) {
    this.config = this.initializeConfig();
  }

  private initializeConfig(): BlockchainConfig {
    const network = this.configService.get<string>('SUI_NETWORK', 'testnet');
    const rpcUrl = this.configService.get<string>('SUI_RPC_URL');
    const packageId = this.configService.get<string>('SUI_PACKAGE_ID');

    if (!rpcUrl || !packageId) {
      throw new Error(
        'SUI_RPC_URL and SUI_PACKAGE_ID must be configured in environment variables',
      );
    }

    const defaultGasBudget = 10_000_000; // 10 million MIST (~0.01 SUI)

    const config: BlockchainConfig = {
      network,
      rpcUrl,
      packageId,
      defaultGasBudget,
      modules: {
        send: {
          name: 'send',
          packageId,
          functions: {
            sendPayment: 'send_payment',
          },
          gasbudget: defaultGasBudget,
        },
        pool: {
          name: 'pool',
          packageId,
          functions: {
            createPool: 'create_pool',
            contribute: 'contribute',
            execute: 'execute',
            refund: 'refund',
          },
          gasbudget: defaultGasBudget,
        },
        yield: {
          name: 'yield',
          packageId,
          functions: {
            deposit: 'deposit',
            withdraw: 'withdraw',
            accrueInterest: 'accrue_interest',
          },
          gasbudget: defaultGasBudget,
        },
        circle: {
          name: 'circle',
          packageId,
          functions: {
            createCircle: 'create_circle',
            contribute: 'contribute',
            triggerPayout: 'trigger_payout',
          },
          gasbudget: defaultGasBudget,
        },
        ratelock: {
          name: 'ratelock',
          packageId,
          functions: {
            createRateLock: 'create_rate_lock',
            expireLock: 'expire_lock',
          },
          gasbudget: defaultGasBudget,
        },
        bridge: {
          name: 'bridge',
          packageId,
          functions: {
            completeCctpReceive: 'complete_cctp_receive',
            completeWormholeReceive: 'complete_wormhole_receive',
          },
          gasbudget: defaultGasBudget,
        },
        compliance: {
          name: 'compliance',
          packageId,
          functions: {
            validateKyc: 'validate_kyc',
          },
          gasbudget: defaultGasBudget,
        },
      },
    };

    this.logger.log(
      `Blockchain configuration initialized for ${network} network at ${rpcUrl}`,
    );

    return config;
  }

  /**
   * Get the complete blockchain configuration
   */
  getConfig(): BlockchainConfig {
    return this.config;
  }

  /**
   * Get configuration for a specific module
   */
  getModuleConfig(moduleName: string): ModuleConfig {
    const moduleConfig = this.config.modules[moduleName];
    if (!moduleConfig) {
      throw new Error(`Module configuration not found: ${moduleName}`);
    }
    return moduleConfig;
  }

  /**
   * Get a specific function address within a module
   */
  getFunctionPath(moduleName: string, functionKey: string): string {
    const moduleConfig = this.getModuleConfig(moduleName);
    const functionName = moduleConfig.functions[functionKey];

    if (!functionName) {
      throw new Error(
        `Function not found in module ${moduleName}: ${functionKey}`,
      );
    }

    return `${moduleConfig.packageId}::${moduleName}::${functionName}`;
  }

  /**
   * Get the network identifier
   */
  getNetwork(): string {
    return this.config.network;
  }

  /**
   * Get the RPC URL
   */
  getRpcUrl(): string {
    return this.config.rpcUrl;
  }

  /**
   * Get the package ID
   */
  getPackageId(): string {
    return this.config.packageId;
  }

  /**
   * Get default gas budget
   */
  getDefaultGasBudget(): number {
    return this.config.defaultGasBudget;
  }
}
