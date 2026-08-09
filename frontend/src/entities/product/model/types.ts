export interface InventorySummary {
    total: number;
    available: number;
    reserved: number;
    sold: number;
}

export interface Product {
    id: string;
    title: string;
    category: string;
    price: string;
    isLimited: boolean;
    queue_enabled: boolean;
    lifecycle_status: "ACTIVE" | "SOLD_OUT" | "INACTIVE";
    inventory: InventorySummary;
    image_url?: string;
    images?: string[];
    description?: string;
    location?: string;
    seller?: { name: string; rating: number; avatar?: string };
    characteristics?: { label: string; value: string }[];
}

export type IProduct = Product;
