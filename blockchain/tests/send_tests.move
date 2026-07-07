#[test_only]
module cestra::send_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin;
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use cestra::send::{Self, SendConfig, SendEscrow, TxRegistry};
    use cestra::compliance::{Self, ComplianceRegistry, AdminCap};

    const SENDER: address = @0xA11CE;
    const ADMIN: address = @0xAD311;

    #[test]
    fun test_issue_refund_reverses_volume() {
        let mut scenario = ts::begin(ADMIN);
        
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000);

        compliance::init_for_testing(ts::ctx(&mut scenario));
        send::init_for_testing(ts::ctx(&mut scenario));
        ts::next_tx(&mut scenario, ADMIN);

        let mut compliance: ComplianceRegistry = ts::take_shared(&scenario);
        let mut escrow: SendEscrow<SUI>;
        let mut registry: TxRegistry = ts::take_shared(&scenario);
        let config: SendConfig = ts::take_shared(&scenario);
        let admin_cap: AdminCap = ts::take_from_sender(&scenario);
        
        compliance::set_kyc_tier(&admin_cap, &mut compliance, SENDER, compliance::tier_2(), &clock);
        
        send::create_escrow<SUI>(&admin_cap, ts::ctx(&mut scenario));
        ts::next_tx(&mut scenario, ADMIN);
        
        escrow = ts::take_shared(&scenario);
        
        ts::next_tx(&mut scenario, SENDER);
        let coin_in = coin::mint_for_testing<SUI>(10100, ts::ctx(&mut scenario));
        
        let tx_id = b"test_tx_1";
        send::send<SUI>(
            &config,
            &mut escrow,
            &mut registry,
            &mut compliance,
            coin_in,
            10000,
            b"hash",
            1,
            tx_id,
            &clock,
            ts::ctx(&mut scenario)
        );

        let derived_key = send::compute_derived_key(SENDER, tx_id);
        
        // Assert volume is 10000
        assert!(compliance::get_monthly_volume(&compliance, SENDER, &clock) == 10000, 0);

        ts::next_tx(&mut scenario, ADMIN);
        
        send::issue_refund<SUI>(
            &admin_cap,
            &mut escrow,
            &mut registry,
            &mut compliance,
            derived_key,
            1,
            &clock,
            ts::ctx(&mut scenario)
        );

        // Assert volume reversed to 0
        assert!(compliance::get_monthly_volume(&compliance, SENDER, &clock) == 0, 1);

        ts::return_shared(escrow);
        ts::return_shared(registry);
        ts::return_shared(config);
        ts::return_shared(compliance);
        ts::return_to_sender(&scenario, admin_cap);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
