import { createContext, useContext, useState } from 'react';

const CanteenFilterContext = createContext(null);

/**
 * CanteenFilterProvider — global filter state for the canteen module.
 * Lives inside CanteenLayout so all child pages share the same state.
 */
export function CanteenFilterProvider({ children }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [vegOnly, setVegOnly] = useState(false); // false = all, true = veg only
  const [nonVegOnly, setNonVegOnly] = useState(false);
  const [selectedCanteenId, setSelectedCanteenId] = useState(null);
  const [showAvailableOnly, setShowAvailableOnly] = useState(true);

  function toggleVeg() {
    setVegOnly(v => !v);
    setNonVegOnly(false);
  }

  function toggleNonVeg() {
    setNonVegOnly(v => !v);
    setVegOnly(false);
  }

  const value = {
    search, setSearch,
    category, setCategory,
    vegOnly, toggleVeg,
    nonVegOnly, toggleNonVeg,
    selectedCanteenId, setSelectedCanteenId,
    showAvailableOnly, setShowAvailableOnly,
  };

  return (
    <CanteenFilterContext.Provider value={value}>
      {children}
    </CanteenFilterContext.Provider>
  );
}

export function useCanteenFilter() {
  const ctx = useContext(CanteenFilterContext);
  if (!ctx) throw new Error('useCanteenFilter must be used within CanteenFilterProvider');
  return ctx;
}
