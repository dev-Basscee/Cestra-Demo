#[test_only]
module cestra::circle_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use cestra::circle::{Self, Circle};
    use cestra::compliance::{Self, ComplianceRegistry, AdminCap};

    const ADMIN: address = @0xAD311;
    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;
    const CHARLIE: address = @0xCAFE;

    #[test]
    fun test_circle_recipient_excluded_refund() {
        let mut scenario = ts::begin(ALICE);
        
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000);

        // Initialize compliance as ALICE, so ALICE receives AdminCap
        compliance::init_for_testing(ts::ctx(&mut scenario));
        ts::next_tx(&mut scenario, ALICE);

        let mut compliance: ComplianceRegistry = ts::take_shared(&scenario);
        let admin_cap: AdminCap = ts::take_from_sender(&scenario);
        
        compliance::set_kyc_tier(&admin_cap, &mut compliance, ALICE, compliance::tier_2(), &clock);
        compliance::set_kyc_tier(&admin_cap, &mut compliance, BOB, compliance::tier_2(), &clock);
        compliance::set_kyc_tier(&admin_cap, &mut compliance, CHARLIE, compliance::tier_2(), &clock);
        
        // Alice creates a circle
        circle::create_circle<SUI>(
            &compliance,
            3,
            10_000,
            604_800_000,
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::next_tx(&mut scenario, BOB);
        let mut circle: Circle<SUI> = ts::take_shared(&scenario);
        circle::join_circle(&mut circle, &compliance, &clock, ts::ctx(&mut scenario));
        
        ts::next_tx(&mut scenario, CHARLIE);
        circle::join_circle(&mut circle, &compliance, &clock, ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, ADMIN);
        // Use admin_cap held by ALICE but passed directly here for simplicity (in a real scenario, ALICE is admin here)
        circle::start_circle(&admin_cap, &mut circle, &clock);
        
        // Period 0 (Alice is recipient)
        // Alice forgets to pay. Bob and Charlie pay.
        ts::next_tx(&mut scenario, BOB);
        let coin_bob = coin::mint_for_testing<SUI>(10_000, ts::ctx(&mut scenario));
        circle::contribute_period(&mut circle, &mut compliance, coin_bob, &clock, ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, CHARLIE);
        let coin_charlie = coin::mint_for_testing<SUI>(10_000, ts::ctx(&mut scenario));
        circle::contribute_period(&mut circle, &mut compliance, coin_charlie, &clock, ts::ctx(&mut scenario));

        // Advance time past deadline
        clock::set_for_testing(&mut clock, 1000 + 604_800_001);

        ts::next_tx(&mut scenario, ADMIN);
        circle::payout_period(&admin_cap, &mut circle, &clock, ts::ctx(&mut scenario));
        
        // Assert circle pot balance is 0 since it refunded to Bob and Charlie
        assert!(circle::pot_balance(&circle) == 0, 0);
        // Assert Alice is excluded
        assert!(circle::is_member_excluded(&circle, ALICE), 1);

        ts::return_shared(circle);
        ts::return_shared(compliance);
        // Revert to ALICE to return AdminCap properly
        ts::next_tx(&mut scenario, ALICE);
        ts::return_to_sender(&scenario, admin_cap);
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
