package state

import "testing"

func TestAllowedQueueEntryTransitions(t *testing.T) {
	allowed := map[string][]string{
		EntryWaiting:         {EntryGranted, EntryCancelled, EntrySoldOut, EntryError},
		EntryGranted:         {EntryCheckoutPending, EntryExpired, EntryCancelled, EntryError},
		EntryCheckoutPending: {EntryPurchased, EntryPaymentFailed, EntryError},
		EntryPurchased:       {},
		EntryExpired:         {},
		EntryPaymentFailed:   {},
		EntrySoldOut:         {},
		EntryCancelled:       {},
	}
	for from, tos := range allowed {
		for _, to := range tos {
			if !CanTransitionQueueEntry(from, to) {
				t.Errorf("transition %s -> %s should be allowed", from, to)
			}
		}
	}
}

func TestForbiddenQueueEntryTransitions(t *testing.T) {
	forbidden := [][2]string{
		{EntryWaiting, EntryPurchased},
		{EntryWaiting, EntryExpired},
		{EntryGranted, EntryPurchased},
		{EntryGranted, EntryPaymentFailed},
		{EntryCheckoutPending, EntryExpired},
		{EntryCheckoutPending, EntryCancelled},
		{EntryPurchased, EntryWaiting},
		{EntryExpired, EntryWaiting},
		{EntrySoldOut, EntryWaiting},
		{EntryCancelled, EntryWaiting},
		{EntryError, EntryWaiting},
	}
	for _, pair := range forbidden {
		if CanTransitionQueueEntry(pair[0], pair[1]) {
			t.Errorf("transition %s -> %s should be forbidden", pair[0], pair[1])
		}
	}
}

func TestAllowedGrantTransitions(t *testing.T) {
	allowed := map[string][]string{
		GrantActive:          {GrantCheckoutPending, GrantExpired, GrantFailed, GrantCancelled},
		GrantCheckoutPending: {GrantPurchased, GrantFailed},
		GrantPurchased:       {},
		GrantExpired:         {},
		GrantFailed:          {},
		GrantCancelled:       {},
	}
	for from, tos := range allowed {
		for _, to := range tos {
			if !CanTransitionGrant(from, to) {
				t.Errorf("grant transition %s -> %s should be allowed", from, to)
			}
		}
	}
}

func TestForbiddenGrantTransitions(t *testing.T) {
	forbidden := [][2]string{
		{GrantActive, GrantPurchased},
		{GrantCheckoutPending, GrantExpired},
		{GrantCheckoutPending, GrantCancelled},
		{GrantPurchased, GrantActive},
		{GrantExpired, GrantActive},
	}
	for _, pair := range forbidden {
		if CanTransitionGrant(pair[0], pair[1]) {
			t.Errorf("grant transition %s -> %s should be forbidden", pair[0], pair[1])
		}
	}
}

func TestUnitTransitions(t *testing.T) {
	if !CanTransitionUnit(UnitAvailable, UnitReserved) || !CanTransitionUnit(UnitAvailable, UnitSold) {
		t.Error("available unit must be reservable and sellable")
	}
	if !CanTransitionUnit(UnitReserved, UnitAvailable) || !CanTransitionUnit(UnitReserved, UnitSold) {
		t.Error("reserved unit must be releasable and sellable")
	}
	if CanTransitionUnit(UnitSold, UnitAvailable) {
		t.Error("sold unit must never become available again")
	}
}

func TestIsTerminalQueueEntry(t *testing.T) {
	for _, status := range []string{EntryPurchased, EntryExpired, EntryPaymentFailed, EntrySoldOut, EntryCancelled} {
		if !IsTerminalQueueEntry(status) {
			t.Errorf("%s must be terminal", status)
		}
	}
	for _, status := range []string{EntryJoining, EntryWaiting, EntryGranted, EntryCheckoutPending, EntryError} {
		if IsTerminalQueueEntry(status) {
			t.Errorf("%s must not be terminal", status)
		}
	}
}
