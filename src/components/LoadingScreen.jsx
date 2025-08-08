import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = ({ onFinish }) => {
  React.useEffect(() => {
    const timer = setTimeout(onFinish, 1800);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Načítání...</p>
    </div>
  );
};

export default LoadingScreen;
