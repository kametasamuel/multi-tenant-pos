import React, { createContext, useState, useContext, useEffect } from 'react';
import { branchesAPI } from '../api';
import { useAuth } from './AuthContext';

const BranchContext = createContext();

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};

export const BranchProvider = ({ children }) => {
  const { user, isOwner, isManager } = useAuth();
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && (isOwner() || isManager())) {
      loadBranches();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const response = await branchesAPI.getAll();
      const branchList = response.data.branches || [];
      setBranches(branchList);

      // Set current branch from localStorage or default to main branch
      const savedBranchId = localStorage.getItem('currentBranchId');
      const savedBranch = branchList.find(b => b.id === savedBranchId);

      if (savedBranch && savedBranch.isActive) {
        setCurrentBranch(savedBranch);
      } else {
        // Default to main branch or first active branch
        const mainBranch = branchList.find(b => b.isMain && b.isActive);
        const firstActive = branchList.find(b => b.isActive);
        setCurrentBranch(mainBranch || firstActive || null);
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchBranch = (branchId) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch && branch.isActive) {
      setCurrentBranch(branch);
      localStorage.setItem('currentBranchId', branchId);
    }
  };

  const switchToAllBranches = () => {
    setCurrentBranch(null);
    localStorage.removeItem('currentBranchId');
  };

  const refreshBranches = () => {
    loadBranches();
  };

  const getActiveBranches = () => {
    return branches.filter(b => b.isActive);
  };

  const getPendingBranches = () => {
    return branches.filter(b => !b.isActive);
  };

  const value = {
    branches,
    currentBranch,
    loading,
    switchBranch,
    switchToAllBranches,
    refreshBranches,
    getActiveBranches,
    getPendingBranches,
    isAllBranches: currentBranch === null
  };

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
};
