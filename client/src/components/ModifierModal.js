import React, { useState, useEffect } from 'react';
import { modifiersAPI } from '../api';
import {
  X,
  Plus,
  Minus,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';

const ModifierModal = ({
  product,
  quantity: initialQuantity = 1,
  onAdd,
  onClose,
  darkMode = false,
  currencySymbol = '$'
}) => {
  const [modifiers, setModifiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [specialRequest, setSpecialRequest] = useState('');
  const [quantity, setQuantity] = useState(initialQuantity);
  const [error, setError] = useState(null);

  // Theme classes
  const surfaceClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const textClass = darkMode ? 'text-white' : 'text-slate-900';
  const mutedClass = darkMode ? 'text-slate-400' : 'text-slate-500';
  const borderClass = darkMode ? 'border-slate-700' : 'border-slate-200';
  const bgClass = darkMode ? 'bg-slate-700' : 'bg-slate-100';
  const inputClass = darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900';

  useEffect(() => {
    loadModifiers();
  }, [product.id]);

  const loadModifiers = async () => {
    setLoading(true);
    try {
      const response = await modifiersAPI.getForProduct(product.id);
      const mods = response.data.modifiers || [];
      setModifiers(mods);

      // Initialize selected options with defaults
      const defaults = {};
      mods.forEach(mod => {
        if (mod.type === 'radio' && mod.options.length > 0) {
          // Select first option as default for radio
          defaults[mod.id] = mod.options[0];
        } else if (mod.type === 'checkbox') {
          defaults[mod.id] = [];
        } else if (mod.type === 'text') {
          defaults[mod.id] = '';
        }
      });
      setSelectedOptions(defaults);
    } catch (err) {
      console.error('Failed to load modifiers:', err);
      setError('Failed to load options');
    } finally {
      setLoading(false);
    }
  };

  const handleRadioChange = (modifierId, option) => {
    setSelectedOptions(prev => ({
      ...prev,
      [modifierId]: option
    }));
  };

  const handleCheckboxChange = (modifierId, option) => {
    setSelectedOptions(prev => {
      const current = prev[modifierId] || [];
      const isSelected = current.some(o => o.label === option.label);

      if (isSelected) {
        return {
          ...prev,
          [modifierId]: current.filter(o => o.label !== option.label)
        };
      } else {
        return {
          ...prev,
          [modifierId]: [...current, option]
        };
      }
    });
  };

  const handleTextChange = (modifierId, value) => {
    setSelectedOptions(prev => ({
      ...prev,
      [modifierId]: value
    }));
  };

  const calculateModifierPrice = () => {
    let total = 0;
    modifiers.forEach(mod => {
      const selected = selectedOptions[mod.id];
      if (mod.type === 'radio' && selected) {
        total += selected.price || 0;
      } else if (mod.type === 'checkbox' && Array.isArray(selected)) {
        selected.forEach(opt => {
          total += opt.price || 0;
        });
      }
    });
    return total;
  };

  const getItemTotal = () => {
    return (product.sellingPrice + calculateModifierPrice()) * quantity;
  };

  const validateRequired = () => {
    for (const mod of modifiers) {
      if (mod.isRequired) {
        const selected = selectedOptions[mod.id];
        if (mod.type === 'radio' && !selected) {
          return `Please select a ${mod.name}`;
        }
        if (mod.type === 'checkbox' && (!selected || selected.length === 0)) {
          return `Please select at least one ${mod.name}`;
        }
        if (mod.type === 'text' && (!selected || selected.trim() === '')) {
          return `Please enter ${mod.name}`;
        }
      }
    }
    return null;
  };

  const handleAdd = () => {
    const validationError = validateRequired();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Build modifiers array for the order
    const selectedModifiers = [];
    modifiers.forEach(mod => {
      const selected = selectedOptions[mod.id];
      if (mod.type === 'radio' && selected) {
        selectedModifiers.push({
          name: mod.name,
          value: selected.label,
          price: selected.price || 0
        });
      } else if (mod.type === 'checkbox' && Array.isArray(selected) && selected.length > 0) {
        selected.forEach(opt => {
          selectedModifiers.push({
            name: mod.name,
            value: opt.label,
            price: opt.price || 0
          });
        });
      } else if (mod.type === 'text' && selected && selected.trim()) {
        selectedModifiers.push({
          name: mod.name,
          value: selected.trim(),
          price: 0
        });
      }
    });

    onAdd({
      product,
      quantity,
      modifiers: selectedModifiers,
      specialRequest: specialRequest.trim() || null,
      modifierPrice: calculateModifierPrice()
    });
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol}${amount.toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`${surfaceClass} rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl`}>
        {/* Header */}
        <div className={`p-4 border-b ${borderClass} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            {product.image && (
              <img
                src={product.image}
                alt={product.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            )}
            <div>
              <h2 className={`text-lg font-black ${textClass}`}>{product.name}</h2>
              <p className="text-accent-500 font-bold">{formatCurrency(product.sellingPrice)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${bgClass} ${mutedClass} hover:text-red-500 transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className={`w-8 h-8 animate-spin ${mutedClass}`} />
            </div>
          ) : modifiers.length === 0 ? (
            <div className={`text-center py-8 ${mutedClass}`}>
              <p>No customization options available</p>
            </div>
          ) : (
            <div className="space-y-6">
              {modifiers.map(modifier => (
                <div key={modifier.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className={`font-bold ${textClass}`}>{modifier.name}</h3>
                    {modifier.isRequired && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                        Required
                      </span>
                    )}
                  </div>

                  {/* Radio Options */}
                  {modifier.type === 'radio' && (
                    <div className="space-y-2">
                      {modifier.options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleRadioChange(modifier.id, option)}
                          className={`w-full p-3 border rounded-xl flex items-center justify-between transition-all ${
                            selectedOptions[modifier.id]?.label === option.label
                              ? 'border-accent-500 bg-accent-50'
                              : `${borderClass} hover:border-accent-300`
                          } ${darkMode && selectedOptions[modifier.id]?.label === option.label ? 'bg-accent-900/30' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedOptions[modifier.id]?.label === option.label
                                ? 'border-accent-500 bg-accent-500'
                                : borderClass
                            }`}>
                              {selectedOptions[modifier.id]?.label === option.label && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <span className={`font-medium ${textClass}`}>{option.label}</span>
                          </div>
                          {option.price > 0 && (
                            <span className="text-accent-500 font-bold">
                              +{formatCurrency(option.price)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Checkbox Options */}
                  {modifier.type === 'checkbox' && (
                    <div className="space-y-2">
                      {modifier.options.map((option, idx) => {
                        const isSelected = (selectedOptions[modifier.id] || []).some(
                          o => o.label === option.label
                        );
                        return (
                          <button
                            key={idx}
                            onClick={() => handleCheckboxChange(modifier.id, option)}
                            className={`w-full p-3 border rounded-xl flex items-center justify-between transition-all ${
                              isSelected
                                ? 'border-accent-500 bg-accent-50'
                                : `${borderClass} hover:border-accent-300`
                            } ${darkMode && isSelected ? 'bg-accent-900/30' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'border-accent-500 bg-accent-500' : borderClass
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className={`font-medium ${textClass}`}>{option.label}</span>
                            </div>
                            {option.price > 0 && (
                              <span className="text-accent-500 font-bold">
                                +{formatCurrency(option.price)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Text Input */}
                  {modifier.type === 'text' && (
                    <input
                      type="text"
                      value={selectedOptions[modifier.id] || ''}
                      onChange={(e) => handleTextChange(modifier.id, e.target.value)}
                      placeholder={`Enter ${modifier.name.toLowerCase()}`}
                      className={`w-full p-3 border rounded-xl ${inputClass} focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none`}
                    />
                  )}
                </div>
              ))}

              {/* Special Request */}
              <div>
                <h3 className={`font-bold ${textClass} mb-3`}>Special Request</h3>
                <textarea
                  value={specialRequest}
                  onChange={(e) => setSpecialRequest(e.target.value)}
                  placeholder="Any special instructions..."
                  rows={2}
                  className={`w-full p-3 border rounded-xl ${inputClass} focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none resize-none`}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-xl flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${borderClass}`}>
          {/* Quantity Selector */}
          <div className="flex items-center justify-between mb-4">
            <span className={`font-bold ${textClass}`}>Quantity</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className={`w-10 h-10 rounded-lg ${bgClass} flex items-center justify-center ${mutedClass} hover:text-accent-500 transition-colors`}
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className={`text-xl font-black ${textClass} w-8 text-center`}>{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className={`w-10 h-10 rounded-lg ${bgClass} flex items-center justify-center ${mutedClass} hover:text-accent-500 transition-colors`}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Add Button */}
          <button
            onClick={handleAdd}
            disabled={loading}
            className="w-full py-4 bg-accent-500 text-white rounded-xl font-black text-sm uppercase hover:bg-accent-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>Add to Order</span>
            <span className="px-2 py-1 bg-white/20 rounded-lg">
              {formatCurrency(getItemTotal())}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModifierModal;
