package products

import "context"

const alternativesLimit = 5

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

type View struct {
	Product
	Inventory InventorySummary
}

func (s *Service) List(ctx context.Context) ([]View, error) {
	products, err := s.repo.ListActive()
	if err != nil {
		return nil, err
	}
	views := make([]View, 0, len(products))
	for _, product := range products {
		inventory, err := s.repo.CountInventory(s.repo.db.WithContext(ctx), product.ID)
		if err != nil {
			return nil, err
		}
		views = append(views, View{Product: product, Inventory: inventory})
	}
	return views, nil
}

func (s *Service) Get(ctx context.Context, productID string) (*View, error) {
	product, err := s.repo.GetByID(productID)
	if err != nil {
		return nil, err
	}
	inventory, err := s.repo.CountInventory(s.repo.db.WithContext(ctx), productID)
	if err != nil {
		return nil, err
	}
	return &View{Product: *product, Inventory: inventory}, nil
}

func (s *Service) Alternatives(ctx context.Context, productID string) ([]View, error) {
	product, err := s.repo.GetByID(productID)
	if err != nil {
		return nil, err
	}
	products, err := s.repo.FindAlternatives(productID, product.Category, string(product.Price), alternativesLimit)
	if err != nil {
		return nil, err
	}
	views := make([]View, 0, len(products))
	for _, alternative := range products {
		inventory, err := s.repo.CountInventory(s.repo.db.WithContext(ctx), alternative.ID)
		if err != nil {
			return nil, err
		}
		views = append(views, View{Product: alternative, Inventory: inventory})
	}
	return views, nil
}
