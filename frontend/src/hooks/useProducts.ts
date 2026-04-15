// frontend/src/hooks/useProducts.ts

import { useCallback, useEffect, useState } from "react";
import { Product, fetchProducts } from "../api/productApi";

interface UseProductsState {
  products: Product[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useProducts = (): UseProductsState => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProducts();
      setProducts(data.filter((p) => p.is_active === 1)); // Filter active products
    } catch (err) {
      console.error("Failed to load products:", err);
      setError(
        err instanceof Error ? err.message : "Error fetching product data.",
      );
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { products, loading, error, refresh: loadData };
};
