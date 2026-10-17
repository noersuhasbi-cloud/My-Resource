import React, { useState, useMemo } from 'react';
import { PRODUCTS } from '../data/mockData';
import type { Product, ProductCategory, CartItem, StoreLocation } from '../types/index.ts';
import { formatIDR } from '../utils/formatters';
import { Plus, Minus, Check, Star, Search, Filter, Info, Eye, X, ShoppingBag } from 'lucide-react';
import { SafeImage } from './SafeImage';

interface ProductCatalogProps {
  cartItems: CartItem[];
  onAddToCart: (product: Product, quantity?: number) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  selectedStore?: StoreLocation;
  onShowToast?: (title: string, message: string, image?: string) => void;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  cartItems,
  onAddToCart,
  onUpdateQuantity,
  selectedStore,
  onShowToast,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterOrganicOnly, setFilterOrganicOnly] = useState<boolean>(false);
  const [filterFarmDirectOnly, setFilterFarmDirectOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: 'All Aisles' },
    { id: 'produce', label: 'Fresh Produce' },
    { id: 'bakery', label: 'Artisan Bakery' },
    { id: 'dairy_eggs', label: 'Dairy & Farm Eggs' },
    { id: 'meat_seafood', label: 'Butchery & Catch' },
    { id: 'pantry_coffee', label: 'Pantry & Roasts' },
  ];

  const filteredProducts = useMemo(() => {
    let result = PRODUCTS.filter((p) => {
      const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchOrganic = !filterOrganicOnly || p.isOrganic;
      const matchFarmDirect = !filterFarmDirectOnly || p.isFarmDirect;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.origin.toLowerCase().includes(q) ||
        (p.farmPartner && p.farmPartner.toLowerCase().includes(q)) ||
        p.description.toLowerCase().includes(q);
      return matchCategory && matchOrganic && matchFarmDirect && matchSearch;
    });

    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    }

    return result;
  }, [selectedCategory, filterOrganicOnly, filterFarmDirectOnly, searchQuery, sortBy]);

  const getCartQuantity = (productId: string) => {
    const item = cartItems.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  const handleAddWithFeedback = (product: Product) => {
    onAddToCart(product, 1);
    if (onShowToast) {
      onShowToast(
        `Added to Cart: ${product.name}`,
        `${formatIDR(product.price)} · ${product.unit}`,
        product.image
      );
    }
  };

  return (
    <section id="catalog" className="py-14 sm:py-24 bg-stone-50 border-t border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-stone-200">
          <div>
            <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-1">
              Online Grocery Order & Fulfillment
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 font-display">
              Artisan Groceries & Daily Farm Harvest
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-stone-600">
              {selectedStore
                ? `Browsing fresh inventory fulfilled from ${selectedStore.name}`
                : 'Selected for 1-hour chilled express delivery or neighborhood store pickup'}
            </p>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search groceries, farms..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-2 px-3 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 transition-all"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Category Tabs & Filter Toggles */}
        <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Interactive Category Segmented Control */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-200/70 rounded-xl overflow-x-auto pb-1 sm:pb-1">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] ${
                    isSelected
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/40'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Quick Dietary Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterOrganicOnly(!filterOrganicOnly)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer min-h-[36px] ${
                filterOrganicOnly
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              Organic Only
            </button>
            <button
              onClick={() => setFilterFarmDirectOnly(!filterFarmDirectOnly)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer min-h-[36px] ${
                filterFarmDirectOnly
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              Farm Direct Only
            </button>
          </div>
        </div>

        {/* Product Grid (Mobile 2-column & Desktop 4-column) */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {filteredProducts.map((product) => {
            const quantityInCart = getCartQuantity(product.id);

            return (
              <div
                key={product.id}
                className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:border-stone-300 hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Product Image Slot with SafeImage Fallback */}
                  <div className="relative aspect-4/3 bg-stone-100 overflow-hidden">
                    <SafeImage
                      src={product.image}
                      alt={product.name}
                      category={product.category}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      containerClassName="w-full h-full"
                    />
                    
                    {/* Quick view button */}
                    <button
                      onClick={() => setQuickViewProduct(product)}
                      className="absolute top-2 right-2 sm:top-3 sm:right-3 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 backdrop-blur-xs text-stone-700 hover:text-emerald-800 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs cursor-pointer z-10"
                      title="Quick View Details"
                    >
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>

                    {/* Quiet provenance tag */}
                    {product.isOrganic && (
                      <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 px-1.5 sm:px-2 py-0.5 rounded bg-emerald-950/80 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-semibold tracking-wide z-10">
                        Organic
                      </div>
                    )}
                  </div>

                  {/* Product Metadata */}
                  <div className="p-3 sm:p-5">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-stone-500 font-medium mb-1">
                      <span className="truncate">{product.categoryLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[90px] sm:max-w-[130px]">{product.origin}</span>
                    </div>

                    <h3 className="text-xs sm:text-base font-bold text-stone-900 group-hover:text-emerald-800 transition-colors line-clamp-2 leading-snug">
                      {product.name}
                    </h3>

                    <div className="mt-2 flex items-center justify-between text-[10px] sm:text-xs">
                      <div className="flex items-center gap-1 text-amber-700 font-medium">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="tabular-nums font-mono">{product.rating}</span>
                      </div>
                      <span className="text-stone-500 truncate max-w-[80px]">{product.unit}</span>
                    </div>
                  </div>
                </div>

                {/* Pricing & Add To Cart Module */}
                <div className="p-3 sm:p-5 pt-0">
                  <div className="pt-2 sm:pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div>
                      <span className="text-[10px] text-stone-400 block font-normal sm:hidden">Price</span>
                      <span className="text-xs sm:text-base font-bold text-stone-900 font-mono tabular-nums">
                        {formatIDR(product.price)}
                      </span>
                    </div>

                    {quantityInCart === 0 ? (
                      <button
                        onClick={() => handleAddWithFeedback(product)}
                        className="w-full sm:w-auto py-1.5 sm:py-2 px-2.5 sm:px-3.5 bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white text-[11px] sm:text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[34px]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-2 bg-stone-100 rounded-lg p-0.5 sm:p-1 border border-stone-200">
                        <button
                          onClick={() => onUpdateQuantity(product.id, quantityInCart - 1)}
                          className="w-6 h-6 rounded flex items-center justify-center text-stone-700 hover:bg-white transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono text-xs font-bold text-stone-900 px-1 tabular-nums">
                          {quantityInCart}
                        </span>
                        <button
                          onClick={() => handleAddWithFeedback(product)}
                          className="w-6 h-6 rounded flex items-center justify-center text-stone-700 hover:bg-white transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 mt-6">
            <ShoppingBag className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="text-stone-900 font-semibold text-sm">No Products Found</p>
            <p className="text-stone-500 text-xs mt-1">
              Try clearing your search keyword or relaxing filters.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
                setFilterOrganicOnly(false);
                setFilterFarmDirectOnly(false);
              }}
              className="mt-4 px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Product Quick View Modal */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-stone-200 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div className="rounded-xl overflow-hidden aspect-square bg-stone-100 border border-stone-200">
                <SafeImage
                  src={quickViewProduct.image}
                  alt={quickViewProduct.name}
                  category={quickViewProduct.category}
                  className="w-full h-full object-cover"
                  containerClassName="w-full h-full"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs text-stone-500 font-medium mb-1">
                  <span>{quickViewProduct.categoryLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{quickViewProduct.origin}</span>
                </div>

                <h3 className="text-xl font-bold text-stone-900 font-display">
                  {quickViewProduct.name}
                </h3>

                <p className="mt-2 text-lg font-bold text-emerald-900 font-mono tabular-nums">
                  {formatIDR(quickViewProduct.price)} <span className="text-xs font-normal text-stone-500">/ {quickViewProduct.unit}</span>
                </p>

                <p className="mt-3 text-xs text-stone-600 leading-relaxed">
                  {quickViewProduct.description}
                </p>

                {quickViewProduct.storageTip && (
                  <div className="mt-4 p-3 bg-stone-50 rounded-lg border border-stone-100 text-xs text-stone-600">
                    <span className="font-semibold text-stone-800">Storage Tip: </span>
                    {quickViewProduct.storageTip}
                  </div>
                )}

                {quickViewProduct.nutritionHighlights && (
                  <div className="mt-3 space-y-1">
                    {quickViewProduct.nutritionHighlights.map((n) => (
                      <div key={n} className="flex items-center gap-1.5 text-xs text-stone-600">
                        <Check className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                        <span>{n}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => {
                      handleAddWithFeedback(quickViewProduct);
                      setQuickViewProduct(null);
                    }}
                    className="flex-1 py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[42px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add to Shopping Bag</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
