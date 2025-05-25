import { useState, useEffect } from "react";

export function useSidebarState() {
  const [leftExpanded, setLeftExpanded] = useState(() => {
    const saved = localStorage.getItem('leftSidebarExpanded');
    return saved ? JSON.parse(saved) : true;
  });

  const [rightExpanded, setRightExpanded] = useState(() => {
    const saved = localStorage.getItem('rightSidebarExpanded');
    return saved ? JSON.parse(saved) : false;
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('leftSidebarExpanded', JSON.stringify(leftExpanded));
  }, [leftExpanded]);

  useEffect(() => {
    localStorage.setItem('rightSidebarExpanded', JSON.stringify(rightExpanded));
  }, [rightExpanded]);

  const toggleLeft = () => setLeftExpanded(prev => !prev);
  const toggleRight = () => setRightExpanded(prev => !prev);

  // Handle mobile behavior - close one when opening the other
  const toggleLeftMobile = () => {
    if (window.innerWidth < 768 && rightExpanded) {
      setRightExpanded(false);
    }
    setLeftExpanded(prev => !prev);
  };

  const toggleRightMobile = () => {
    if (window.innerWidth < 768 && leftExpanded) {
      setLeftExpanded(false);
    }
    setRightExpanded(prev => !prev);
  };

  // Use mobile-aware toggles on mobile devices
  const isMobile = window.innerWidth < 768;
  
  return {
    leftExpanded,
    rightExpanded,
    toggleLeft: isMobile ? toggleLeftMobile : toggleLeft,
    toggleRight: isMobile ? toggleRightMobile : toggleRight,
    setLeftExpanded,
    setRightExpanded,
  };
}
