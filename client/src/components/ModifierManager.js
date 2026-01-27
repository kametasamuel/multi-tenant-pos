import React, { useState, useEffect } from 'react';
import { modifiersAPI } from '../api';
import {
  X,
  Plus,
  Edit3,
  Trash2,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';

const ModifierManager = ({
  product,
  onClose,
  darkMode = false,
  currencySymbol = '$'
}) => {
  const [modifiers, setModifiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingModifier, setEditingModifier] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'checkbox',
    isRequired: false,
    options: [{ label: '', price: 0 }]
  });

  // Theme classes
  const surfaceClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const textClass = darkMode ? 'text-white' : 'text-slate-900';
  const mutedClass = darkMode ? 'text-slate-400' : 'text-slate-500';
  const borderClass = darkMode ? 'border-slate-700' : 'border-slate-200';
  const inputClass = darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-900';

  useEffect(() => {
    loadModifiers();
  }, [product.id]);

  const loadModifiers = async () => {
    setLoading(true);
    try {
      const response = await modifiersAPI.getForProduct(product.id);
      setModifiers(response.data.modifiers || []);
    } catch (err) {
      console.error('Failed to load modifiers:', err);
      showToast('Failed to load modifiers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'checkbox',
      isRequired: false,
      options: [{ label: '', price: 0 }]
    });
    setShowAddForm(false);
    setEditingModifier(null);
  };

  const handleAddOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, { label: '', price: 0 }]
    }));
  };

  const handleRemoveOption = (index) => {
    if (formData.options.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleOptionChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) =>
        i === index ? { ...opt, [field]: field === 'price' ? parseFloat(value) || 0 : value } : opt
      )
    }));
  };

  const handleSaveModifier = async () => {
    // Validate
    if (!formData.name.trim()) {
      showToast('Please enter a modifier name', 'error');
      return;
    }

    if (formData.type !== 'text') {
      const validOptions = formData.options.filter(opt => opt.label.trim());
      if (validOptions.length === 0) {
        showToast('Please add at least one option', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const data = {
        name: formData.name.trim(),
        type: formData.type,
        isRequired: formData.isRequired,
        options: formData.type === 'text' ? [] : formData.options.filter(opt => opt.label.trim())
      };

      if (editingModifier) {
        await modifiersAPI.update(editingModifier.id, data);
        showToast('Modifier updated');
      } else {
        await modifiersAPI.create(product.id, data);
        showToast('Modifier added');
      }

      await loadModifiers();
      resetForm();
    } catch (err) {
      console.error('Failed to save modifier:', err);
      showToast('Failed to save modifier', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModifier = async (modifier) => {
    if (!window.confirm(`Delete "${modifier.name}"?`)) return;

    try {
      await modifiersAPI.delete(modifier.id);
      showToast('Modifier deleted');
      await loadModifiers();
    } catch (err) {
      console.error('Failed to delete modifier:', err);
      showToast('Failed to delete modifier', 'error');
    }
  };

  const handleEditModifier = (modifier) => {
    setFormData({
      name: modifier.name,
      type: modifier.type,
      isRequired: modifier.isRequired,
      options: modifier.options.length > 0 ? modifier.options : [{ label: '', price: 0 }]
    });
    setEditingModifier(modifier);
    setShowAddForm(true);
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol}${(amount || 0).toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`${surfaceClass} rounded-[32px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border ${borderClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 border-b ${borderClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-xl font-black uppercase ${textClass}`}>Manage Modifiers</h2>
              <p className={`text-sm ${mutedClass}`}>{product.name}</p>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl ${mutedClass} hover:text-red-500 transition-colors`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-8 h-8 animate-spin ${mutedClass}`} />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Existing Modifiers */}
              {modifiers.length === 0 && !showAddForm ? (
                <div className={`text-center py-8 ${mutedClass}`}>
                  <p className="mb-4">No modifiers yet. Add size options, add-ons, or special requests.</p>
                </div>
              ) : (
                modifiers.map((modifier) => (
                  <div
                    key={modifier.id}
                    className={`p-4 border ${borderClass} rounded-2xl`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className={`font-bold ${textClass}`}>{modifier.name}</h3>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                          modifier.type === 'radio' ? 'bg-blue-100 text-blue-600' :
                          modifier.type === 'checkbox' ? 'bg-green-100 text-green-600' :
                          'bg-purple-100 text-purple-600'
                        }`}>
                          {modifier.type === 'radio' ? 'Single Choice' : modifier.type === 'checkbox' ? 'Multiple Choice' : 'Text Input'}
                        </span>
                        {modifier.isRequired && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-lg uppercase">
                            Required
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditModifier(modifier)}
                          className={`p-2 rounded-lg ${mutedClass} hover:text-blue-500 transition-colors`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteModifier(modifier)}
                          className={`p-2 rounded-lg ${mutedClass} hover:text-red-500 transition-colors`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {modifier.type !== 'text' && modifier.options.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {modifier.options.map((opt, idx) => (
                          <span
                            key={idx}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${textClass}`}
                          >
                            {opt.label}
                            {opt.price > 0 && (
                              <span className="text-green-500 ml-1">+{formatCurrency(opt.price)}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Add/Edit Form */}
              {showAddForm && (
                <div className={`p-4 border-2 border-dashed ${borderClass} rounded-2xl space-y-4`}>
                  <h4 className={`font-bold ${textClass}`}>
                    {editingModifier ? 'Edit Modifier' : 'New Modifier'}
                  </h4>

                  {/* Name */}
                  <div>
                    <label className={`text-[10px] font-bold uppercase ${mutedClass} block mb-2`}>
                      Modifier Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Size, Add-ons, Spice Level"
                      className={`w-full px-4 py-3 rounded-xl border ${inputClass} focus:outline-none focus:border-blue-500`}
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className={`text-[10px] font-bold uppercase ${mutedClass} block mb-2`}>
                      Type
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'radio', label: 'Single Choice', desc: 'Customer picks one' },
                        { value: 'checkbox', label: 'Multiple Choice', desc: 'Customer picks many' },
                        { value: 'text', label: 'Text Input', desc: 'Customer types custom' }
                      ].map(type => (
                        <button
                          key={type.value}
                          onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                          className={`flex-1 p-3 rounded-xl border transition-all text-left ${
                            formData.type === type.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : `${borderClass} hover:border-blue-300`
                          }`}
                        >
                          <p className={`text-sm font-bold ${textClass}`}>{type.label}</p>
                          <p className={`text-[10px] ${mutedClass}`}>{type.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Required Toggle */}
                  <div className="flex items-center justify-between">
                    <label className={`text-sm font-medium ${textClass}`}>
                      Required
                    </label>
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, isRequired: !prev.isRequired }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        formData.isRequired ? 'bg-blue-500' : darkMode ? 'bg-slate-600' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        formData.isRequired ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Options (only for radio/checkbox) */}
                  {formData.type !== 'text' && (
                    <div>
                      <label className={`text-[10px] font-bold uppercase ${mutedClass} block mb-2`}>
                        Options
                      </label>
                      <div className="space-y-2">
                        {formData.options.map((option, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input
                              type="text"
                              value={option.label}
                              onChange={(e) => handleOptionChange(idx, 'label', e.target.value)}
                              placeholder="Option name"
                              className={`flex-1 px-3 py-2 rounded-xl border ${inputClass} focus:outline-none focus:border-blue-500 text-sm`}
                            />
                            <div className="relative w-32">
                              <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedClass}`}>
                                {currencySymbol}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={option.price || ''}
                                onChange={(e) => handleOptionChange(idx, 'price', e.target.value)}
                                placeholder="0.00"
                                className={`w-full px-3 py-2 pl-7 rounded-xl border ${inputClass} focus:outline-none focus:border-blue-500 text-sm`}
                              />
                            </div>
                            <button
                              onClick={() => handleRemoveOption(idx)}
                              disabled={formData.options.length <= 1}
                              className={`p-2 rounded-xl ${mutedClass} hover:text-red-500 disabled:opacity-30 disabled:hover:text-inherit`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleAddOption}
                        className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-xl ${mutedClass} hover:text-blue-500 text-sm`}
                      >
                        <Plus className="w-4 h-4" />
                        Add Option
                      </button>
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={resetForm}
                      className={`flex-1 py-3 rounded-xl border ${borderClass} ${mutedClass} font-bold text-xs uppercase`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveModifier}
                      disabled={saving}
                      className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold text-xs uppercase hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {editingModifier ? 'Update' : 'Add'}
                    </button>
                  </div>
                </div>
              )}

              {/* Add New Button */}
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className={`w-full py-4 border-2 border-dashed ${borderClass} rounded-2xl ${mutedClass} hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2 font-bold text-sm`}
                >
                  <Plus className="w-5 h-5" />
                  Add Modifier
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${borderClass}`}>
          <button
            onClick={onClose}
            className={`w-full py-3 ${darkMode ? 'bg-slate-700' : 'bg-slate-800'} text-white rounded-xl font-bold text-xs uppercase`}
          >
            Done
          </button>
        </div>

        {/* Toast */}
        {toast.show && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
            <div className={`px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 ${
              toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-white text-slate-900 dark:bg-slate-700 dark:text-white'
            }`}>
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <Check className="w-4 h-4 text-green-500" />
              )}
              <span className="text-sm font-bold">{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModifierManager;
