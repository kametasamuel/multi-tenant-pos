import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

const DateRangePicker = ({
  dateRange,
  onDateChange,
  darkMode = false,
  surfaceClass = 'bg-white',
  textClass = 'text-slate-900',
  mutedClass = 'text-slate-500',
  borderClass = 'border-slate-200',
  presets = true, // Show preset options
  className = ''
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDates, setTempDates] = useState({
    startDate: dateRange?.startDate || new Date().toISOString().split('T')[0],
    endDate: dateRange?.endDate || new Date().toISOString().split('T')[0]
  });
  const pickerRef = useRef(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update temp dates when dateRange changes
  useEffect(() => {
    if (dateRange?.startDate && dateRange?.endDate) {
      setTempDates({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
    }
  }, [dateRange]);

  const presetOptions = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: 'week' },
    { label: 'Last 30 Days', value: 'month' },
    { label: 'This Month', value: 'thisMonth' },
    { label: 'Last Month', value: 'lastMonth' },
    { label: 'Custom', value: 'custom' }
  ];

  const getDateFromPreset = (preset) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'today':
        return { startDate: formatDate(today), endDate: formatDate(today) };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { startDate: formatDate(yesterday), endDate: formatDate(yesterday) };
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 6);
        return { startDate: formatDate(weekAgo), endDate: formatDate(today) };
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 29);
        return { startDate: formatDate(monthAgo), endDate: formatDate(today) };
      case 'thisMonth':
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: formatDate(thisMonthStart), endDate: formatDate(today) };
      case 'lastMonth':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return { startDate: formatDate(lastMonthStart), endDate: formatDate(lastMonthEnd) };
      default:
        return null;
    }
  };

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handlePresetClick = (preset) => {
    if (preset === 'custom') {
      return; // Keep picker open for custom selection
    }
    const dates = getDateFromPreset(preset);
    if (dates) {
      onDateChange(dates);
      setShowPicker(false);
    }
  };

  const handleApply = () => {
    // Validate dates
    if (new Date(tempDates.startDate) > new Date(tempDates.endDate)) {
      // Swap if start is after end
      onDateChange({
        startDate: tempDates.endDate,
        endDate: tempDates.startDate
      });
    } else {
      onDateChange(tempDates);
    }
    setShowPicker(false);
  };

  const getCurrentLabel = () => {
    const start = dateRange?.startDate;
    const end = dateRange?.endDate;

    if (!start || !end) return 'Select dates';

    // Check if matches a preset
    const today = new Date();
    const todayStr = formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

    if (start === todayStr && end === todayStr) return 'Today';

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);
    if (start === yesterdayStr && end === yesterdayStr) return 'Yesterday';

    // Check for last 7 days
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    if (start === formatDate(weekAgo) && end === todayStr) return 'Last 7 Days';

    // Check for last 30 days
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 29);
    if (start === formatDate(monthAgo) && end === todayStr) return 'Last 30 Days';

    // Otherwise show date range
    return `${formatDisplayDate(start)} - ${formatDisplayDate(end)}`;
  };

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-medium hover:border-slate-400 transition-colors`}
      >
        <Calendar className="w-4 h-4" />
        <span>{getCurrentLabel()}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Picker - Fixed on mobile, absolute on desktop */}
      {showPicker && (
        <>
          {/* Overlay for both mobile and desktop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowPicker(false)}
          />
          <div className={`
            fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
            ${surfaceClass} border ${borderClass}
            rounded-2xl shadow-xl z-50
            w-[calc(100vw-2rem)] max-w-sm max-h-[85vh] overflow-y-auto
          `}>
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b ${borderClass} sticky top-0 ${surfaceClass}`}>
            <h3 className={`text-sm font-bold ${textClass}`}>Select Date Range</h3>
            <button
              onClick={() => setShowPicker(false)}
              className={`p-1 ${mutedClass} hover:${textClass} rounded-lg`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Presets */}
            {presets && (
              <div className="grid grid-cols-2 gap-2">
                {presetOptions.filter(p => p.value !== 'custom').map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handlePresetClick(preset.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                      getCurrentLabel() === preset.label
                        ? 'bg-slate-800 text-white dark:bg-slate-600'
                        : `${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'} ${textClass}`
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            {/* Custom Date Inputs */}
            <div className={`pt-4 border-t ${borderClass}`}>
              <p className={`text-xs font-bold uppercase ${mutedClass} mb-3`}>Custom Range</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs ${mutedClass} mb-1 block`}>From</label>
                  <input
                    type="date"
                    value={tempDates.startDate}
                    onChange={(e) => setTempDates({ ...tempDates, startDate: e.target.value })}
                    max={tempDates.endDate}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                  />
                </div>
                <div>
                  <label className={`text-xs ${mutedClass} mb-1 block`}>To</label>
                  <input
                    type="date"
                    value={tempDates.endDate}
                    onChange={(e) => setTempDates({ ...tempDates, endDate: e.target.value })}
                    min={tempDates.startDate}
                    max={formatDate(new Date())}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                  />
                </div>
              </div>
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApply}
              className="w-full px-4 py-2.5 bg-slate-800 dark:bg-slate-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Apply Custom Range
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default DateRangePicker;
