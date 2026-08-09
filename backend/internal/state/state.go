package state

const (
	EntryJoining         = "JOINING"
	EntryWaiting         = "WAITING"
	EntryGranted         = "GRANTED"
	EntryCheckoutPending = "CHECKOUT_PENDING"
	EntryPurchased       = "PURCHASED"
	EntryExpired         = "EXPIRED"
	EntryPaymentFailed   = "PAYMENT_FAILED"
	EntrySoldOut         = "SOLD_OUT"
	EntryCancelled       = "CANCELLED"
	EntryError           = "ERROR"
)

const (
	GrantActive          = "ACTIVE"
	GrantCheckoutPending = "CHECKOUT_PENDING"
	GrantPurchased       = "PURCHASED"
	GrantExpired         = "EXPIRED"
	GrantFailed          = "FAILED"
	GrantCancelled       = "CANCELLED"
)

const (
	UnitAvailable = "AVAILABLE"
	UnitReserved  = "RESERVED"
	UnitSold      = "SOLD"
)

var queueEntryTransitions = map[string]map[string]bool{
	EntryJoining: {
		EntryWaiting:   true,
		EntryGranted:   true,
		EntrySoldOut:   true,
		EntryCancelled: true,
		EntryError:     true,
	},
	EntryWaiting: {
		EntryGranted:   true,
		EntryCancelled: true,
		EntrySoldOut:   true,
		EntryError:     true,
	},
	EntryGranted: {
		EntryCheckoutPending: true,
		EntryExpired:         true,
		EntryCancelled:       true,
		EntryError:           true,
	},
	EntryCheckoutPending: {
		EntryPurchased:     true,
		EntryPaymentFailed: true,
		EntryError:         true,
	},
	EntryPurchased:     {},
	EntryExpired:       {},
	EntryPaymentFailed: {},
	EntrySoldOut:       {},
	EntryCancelled:     {},
	EntryError:         {},
}

var grantTransitions = map[string]map[string]bool{
	GrantActive: {
		GrantCheckoutPending: true,
		GrantExpired:         true,
		GrantFailed:          true,
		GrantCancelled:       true,
	},
	GrantCheckoutPending: {
		GrantPurchased: true,
		GrantFailed:    true,
	},
	GrantPurchased: {},
	GrantExpired:   {},
	GrantFailed:    {},
	GrantCancelled: {},
}

var unitTransitions = map[string]map[string]bool{
	UnitAvailable: {UnitReserved: true, UnitSold: true},
	UnitReserved:  {UnitAvailable: true, UnitSold: true},
	UnitSold:      {},
}

func CanTransitionQueueEntry(from, to string) bool {
	return queueEntryTransitions[from][to]
}

func CanTransitionGrant(from, to string) bool {
	return grantTransitions[from][to]
}

func CanTransitionUnit(from, to string) bool {
	return unitTransitions[from][to]
}

func IsTerminalQueueEntry(status string) bool {
	switch status {
	case EntryPurchased, EntryExpired, EntryPaymentFailed, EntrySoldOut, EntryCancelled:
		return true
	default:
		return false
	}
}

func IsActiveQueueEntry(status string) bool {
	switch status {
	case EntryJoining, EntryWaiting, EntryGranted, EntryCheckoutPending, EntryError:
		return true
	default:
		return false
	}
}

func IsActiveGrant(status string) bool {
	return status == GrantActive
}

func ValidQueueEntryStatus(status string) bool {
	return queueEntryTransitions[status] != nil
}

func ValidGrantStatus(status string) bool {
	return grantTransitions[status] != nil
}
