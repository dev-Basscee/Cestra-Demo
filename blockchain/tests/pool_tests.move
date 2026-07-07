#[test_only]
module cestra::pool_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use cestra::pool::{Self, Pool};
    use cestra::compliance::{Self, ComplianceRegistry, AdminCap};

    const ADMIN: address = @0xAD311;
    const SENDER: address = @0xA11CE;

    #[test]
    fun test_pool_contribution_overshoot() {
        let mut scenario = ts::begin(ADMIN);
        
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000);

        compliance::init_for_testing(ts::ctx(&mut scenario));
        ts::next_tx(&mut scenario, ADMIN);

        let mut compliance: ComplianceRegistry = ts::take_shared(&scenario);
        let admin_cap: AdminCap = ts::take_from_sender(&scenario);
        
        compliance::set_kyc_tier(&admin_cap, &mut compliance, ADMIN, compliance::tier_2(), &clock);
        compliance::set_kyc_tier(&admin_cap, &mut compliance, SENDER, compliance::tier_2(), &clock);
        
        pool::create_pool<SUI>(
            &compliance,
            100_000,
            @0x123,
            10000,
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::next_tx(&mut scenario, SENDER);
        
        let mut pool: Pool<SUI> = ts::take_shared(&scenario);
        let coin_in = coin::mint_for_testing<SUI>(150_000, ts::ctx(&mut scenario));
        
        pool::contribute<SUI>(
            &mut pool,
            &mut compliance,
            coin_in,
            150_000,
            &clock,
            ts::ctx(&mut scenario)
        );
        
        assert!(pool::pool_balance(&pool) == 100_000, 0);

        ts::return_shared(pool);
        ts::return_shared(compliance);
        ts::next_tx(&mut scenario, ADMIN);
        ts::return_to_sender(&scenario, admin_cap);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
